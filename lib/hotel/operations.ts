import { prisma } from "../db";
import { AppError } from "../api-response";
import { getSettings } from "../settings";
import {
  ReservationStatus,
  RoomStatus,
  HousekeepingTaskStatus,
  FolioStatus,
  FolioChargeSource,
  ReservationSource,
  Prisma,
} from "@prisma/client";
import { parseDateOnly, formatDateOnly, calculateStayNights } from "./date-utils";
import { computeStayPricing } from "./pricing";
import { ROLES, PermissionContextUser } from "../rbac";
import crypto from "crypto";

// -------------------------------------------------------------
// Input Types
// -------------------------------------------------------------

export interface CheckInInput {
  reservationId: string;
  roomId?: string; // Room to assign (if not assigned or changing)
  guestDetails?: {
    idType?: string;
    idNumber?: string;
    nationality?: string;
    vehiclePlate?: string;
    company?: string;
  };
  earlyCheckInApproved?: boolean;
  notes?: string;
  user: PermissionContextUser & { name?: string; email?: string };
}

export interface CheckOutInput {
  reservationId: string;
  overrideUnpaidBalance?: boolean;
  overrideReason?: string;
  notes?: string;
  user: PermissionContextUser & { name?: string; email?: string };
}

export interface CreateFrontDeskReservationInput {
  roomTypeId: string;
  roomId?: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  adults?: number;
  children?: number;
  guest: {
    name: string;
    phone: string;
    email?: string;
    nationality?: string;
    idType?: string;
    idNumber?: string;
    vehiclePlate?: string;
  };
  extras?: Array<{ extraId: string; quantity: number }>;
  depositPesewas?: number;
  notes?: string;
  user: PermissionContextUser & { name?: string; email?: string };
}

export interface UpdateHousekeepingStatusInput {
  taskId?: string;
  roomId: string;
  status: RoomStatus;
  notes?: string;
  assignedToUserId?: string;
  user: PermissionContextUser & { name?: string; email?: string };
}

export interface MoveExtendReservationInput {
  reservationRoomId: string;
  newRoomId?: string;
  newCheckIn?: string;
  newCheckOut?: string;
  user: PermissionContextUser & { name?: string; email?: string };
}

// -------------------------------------------------------------
// Check-In Service
// -------------------------------------------------------------

export async function checkInReservation(input: CheckInInput) {
  const { reservationId, roomId: requestedRoomId, guestDetails, user, earlyCheckInApproved, notes } = input;

  return await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: {
        guest: true,
        rooms: { include: { roomType: true, room: true } },
        folios: { include: { charges: true } },
      },
    });

    if (!reservation) {
      throw new AppError("Reservation not found", 404, "RESERVATION_NOT_FOUND");
    }

    if (reservation.status === ReservationStatus.CHECKED_IN) {
      throw new AppError("Reservation is already checked in", 400, "ALREADY_CHECKED_IN");
    }

    if (
      reservation.status === ReservationStatus.CHECKED_OUT ||
      reservation.status === ReservationStatus.CANCELLED
    ) {
      throw new AppError(
        `Cannot check in a reservation with status ${reservation.status}`,
        400,
        "INVALID_RESERVATION_STATUS"
      );
    }

    if (reservation.rooms.length === 0) {
      throw new AppError("No rooms attached to this reservation", 400, "NO_ROOMS_ATTACHED");
    }

    const primaryResRoom = reservation.rooms[0];
    const settings = await getSettings();

    // 1. Check early check-in
    // Check-in date & time comparison
    const now = new Date();
    const checkInDateStr = formatDateOnly(reservation.checkInDate);

    const [stdHour, stdMinute] = (settings.standardCheckInTime || "14:00").split(":").map(Number);
    const standardCheckInDateTime = new Date(reservation.checkInDate);
    standardCheckInDateTime.setUTCHours(stdHour || 14, stdMinute || 0, 0, 0);

    const isEarlyCheckIn = now.getTime() < standardCheckInDateTime.getTime();

    if (isEarlyCheckIn) {
      const isManagerOrAbove =
        user.role === ROLES.MANAGER || user.role === ROLES.OWNER_ADMIN;

      if (!isManagerOrAbove && !earlyCheckInApproved) {
        throw new AppError(
          `Early check-in before ${settings.standardCheckInTime || "14:00"} on ${checkInDateStr} requires Manager approval`,
          403,
          "EARLY_CHECKIN_MANAGER_REQUIRED"
        );
      }
    }

    // 2. Room Assignment Verification
    let targetRoomId = requestedRoomId || primaryResRoom.roomId;

    if (!targetRoomId) {
      // Auto-assign a clean or inspected room of this room type that isn't occupied or reserved
      const availableRooms = await tx.room.findMany({
        where: {
          roomTypeId: primaryResRoom.roomTypeId,
          status: { in: [RoomStatus.CLEAN, RoomStatus.INSPECTED] },
        },
        orderBy: [{ status: "asc" }, { number: "asc" }], // prefer INSPECTED or CLEAN
      });

      if (availableRooms.length === 0) {
        throw new AppError(
          "No clean or inspected rooms available for this room type. Please prepare a room before check-in.",
          409,
          "NO_AVAILABLE_ROOM"
        );
      }
      targetRoomId = availableRooms[0].id;
    }

    // Verify room existence and operational status
    const targetRoom = await tx.room.findUnique({
      where: { id: targetRoomId },
    });

    if (!targetRoom) {
      throw new AppError("Specified room not found", 404, "ROOM_NOT_FOUND");
    }

    if (targetRoom.status === RoomStatus.OUT_OF_ORDER) {
      throw new AppError(`Room ${targetRoom.number} is OUT OF ORDER`, 409, "ROOM_OUT_OF_ORDER");
    }

    // 3. Update Guest Identity Details on Customer (encrypted/masked convention)
    if (guestDetails && Object.keys(guestDetails).length > 0) {
      await tx.customer.update({
        where: { id: reservation.guestId },
        data: {
          ...(guestDetails.idType ? { idType: guestDetails.idType } : {}),
          ...(guestDetails.idNumber ? { idNumber: guestDetails.idNumber } : {}),
          ...(guestDetails.nationality ? { nationality: guestDetails.nationality } : {}),
          ...(guestDetails.vehiclePlate ? { vehiclePlate: guestDetails.vehiclePlate } : {}),
          ...(guestDetails.company ? { company: guestDetails.company } : {}),
        },
      });
    }

    // 4. Update Reservation and ReservationRoom to CHECKED_IN
    await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status: ReservationStatus.CHECKED_IN,
        notes: notes ? (reservation.notes ? `${reservation.notes} | ${notes}` : notes) : reservation.notes,
      },
    });

    await tx.reservationRoom.update({
      where: { id: primaryResRoom.id },
      data: {
        status: ReservationStatus.CHECKED_IN,
        roomId: targetRoomId,
      },
    });

    // 5. Update Room to OCCUPIED
    await tx.room.update({
      where: { id: targetRoomId },
      data: {
        status: RoomStatus.OCCUPIED,
      },
    });

    // 6. Ensure Folio is OPEN and Room Charges Exist
    let folio = reservation.folios[0];
    if (!folio) {
      folio = await tx.folio.create({
        data: {
          folioNumber: `FOL-${reservation.reference}`,
          reservationId: reservation.id,
          status: FolioStatus.OPEN,
        },
        include: { charges: true },
      });
    }

    const hasRoomCharge = folio.charges?.some((c) => c.source === FolioChargeSource.ROOM);
    if (!hasRoomCharge) {
      await tx.folioCharge.create({
        data: {
          folioId: folio.id,
          description: `Accommodation (${calculateStayNights(reservation.checkInDate, reservation.checkOutDate)} nights) - Room ${targetRoom.number}`,
          source: FolioChargeSource.ROOM,
          amountPesewas: reservation.subtotalPesewas,
          createdByUserId: user.userId,
        },
      });
    }

    // 7. Record State-Changing Audit Log
    await tx.auditLog.create({
      data: {
        userId: user.userId,
        action: "CHECK_IN",
        entityType: "RESERVATION",
        entityId: reservation.id,
        oldValues: {
          status: reservation.status,
          roomId: primaryResRoom.roomId,
          roomStatus: targetRoom.status,
        },
        newValues: {
          status: ReservationStatus.CHECKED_IN,
          roomId: targetRoomId,
          roomNumber: targetRoom.number,
          roomStatus: RoomStatus.OCCUPIED,
          isEarlyCheckIn,
          checkedInBy: user.name || user.email || user.userId,
          guestIdType: guestDetails?.idType,
          // Notice: idNumber is omitted/masked from audit log per sensitive security rules
          hasGuestIdNumber: Boolean(guestDetails?.idNumber),
        },
      },
    });

    return {
      success: true,
      reservationId: reservation.id,
      reference: reservation.reference,
      status: ReservationStatus.CHECKED_IN,
      roomNumber: targetRoom.number,
      roomId: targetRoomId,
      isEarlyCheckIn,
    };
  });
}

// -------------------------------------------------------------
// Check-Out Service
// -------------------------------------------------------------

export async function checkOutReservation(input: CheckOutInput) {
  const { reservationId, overrideUnpaidBalance, overrideReason, notes, user } = input;

  return await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: {
        guest: true,
        rooms: { include: { room: true } },
        folios: { include: { charges: true } },
      },
    });

    if (!reservation) {
      throw new AppError("Reservation not found", 404, "RESERVATION_NOT_FOUND");
    }

    if (reservation.status !== ReservationStatus.CHECKED_IN) {
      throw new AppError(
        `Cannot check out a reservation with status "${reservation.status}". Only CHECKED_IN stays can be checked out.`,
        400,
        "INVALID_RESERVATION_STATUS"
      );
    }

    // 1. Calculate Folio Balance
    const folio = reservation.folios[0];
    let totalChargesPesewas = 0;
    let totalPaymentsPesewas = 0;

    if (folio && folio.charges) {
      for (const charge of folio.charges) {
        if (charge.source === FolioChargeSource.PAYMENT) {
          totalPaymentsPesewas += charge.amountPesewas;
        } else {
          totalChargesPesewas += charge.amountPesewas;
        }
      }
    } else {
      totalChargesPesewas = reservation.totalPesewas;
      totalPaymentsPesewas = reservation.amountPaidPesewas;
    }

    const outstandingBalancePesewas = Math.max(0, totalChargesPesewas - totalPaymentsPesewas);

    // 2. Unpaid Balance Enforcement
    if (outstandingBalancePesewas > 0) {
      const isManagerOrAbove =
        user.role === ROLES.MANAGER || user.role === ROLES.OWNER_ADMIN;

      if (!isManagerOrAbove) {
        throw new AppError(
          `Cannot check out with an outstanding balance of GH₵ ${(outstandingBalancePesewas / 100).toFixed(2)}. Settlement required, or manager override required.`,
          403,
          "UNPAID_BALANCE_REQUIRES_MANAGER_OVERRIDE"
        );
      }

      if (!overrideUnpaidBalance) {
        throw new AppError(
          `Outstanding balance of GH₵ ${(outstandingBalancePesewas / 100).toFixed(2)} must be settled before checkout. Pass overrideUnpaidBalance=true with a reason to override.`,
          400,
          "UNPAID_BALANCE_CONFIRMATION_REQUIRED"
        );
      }

      if (!overrideReason || overrideReason.trim().length < 3) {
        throw new AppError(
          "A valid override reason is mandatory when checking out with an unpaid balance",
          400,
          "OVERRIDE_REASON_REQUIRED"
        );
      }
    }

    // 3. Update Reservation & ReservationRooms
    await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status: ReservationStatus.CHECKED_OUT,
        notes: notes ? (reservation.notes ? `${reservation.notes} | ${notes}` : notes) : reservation.notes,
      },
    });

    await tx.reservationRoom.updateMany({
      where: { reservationId: reservation.id },
      data: {
        status: ReservationStatus.CHECKED_OUT,
      },
    });

    // 4. Update Room(s) to DIRTY and Auto-Create HousekeepingTask
    const dirtyRooms: Array<{ id: string; number: string }> = [];

    for (const resRoom of reservation.rooms) {
      if (resRoom.roomId) {
        await tx.room.update({
          where: { id: resRoom.roomId },
          data: {
            status: RoomStatus.DIRTY,
          },
        });

        // Create Housekeeping Task
        await tx.housekeepingTask.create({
          data: {
            roomId: resRoom.roomId,
            status: HousekeepingTaskStatus.PENDING,
            notes: `Checkout turnover for stay ${reservation.reference}. Room ${resRoom.room?.number || ""}.`,
          },
        });

        dirtyRooms.push({
          id: resRoom.roomId,
          number: resRoom.room?.number || "Unknown",
        });
      }
    }

    // 5. Update Folio Status if settled
    if (folio && outstandingBalancePesewas === 0) {
      await tx.folio.update({
        where: { id: folio.id },
        data: { status: FolioStatus.SETTLED },
      });
    }

    // 6. Record State-Changing Audit Log
    await tx.auditLog.create({
      data: {
        userId: user.userId,
        action: "CHECK_OUT",
        entityType: "RESERVATION",
        entityId: reservation.id,
        oldValues: {
          status: reservation.status,
          rooms: reservation.rooms.map((r) => ({ id: r.roomId, status: r.room?.status })),
        },
        newValues: {
          status: ReservationStatus.CHECKED_OUT,
          outstandingBalancePesewas,
          overrideUnpaidBalance: Boolean(overrideUnpaidBalance),
          overrideReason: overrideReason || null,
          dirtyRoomsAssignedToHousekeeping: dirtyRooms.map((r) => r.number),
          checkedOutBy: user.name || user.email || user.userId,
        },
      },
    });

    return {
      success: true,
      reservationId: reservation.id,
      reference: reservation.reference,
      status: ReservationStatus.CHECKED_OUT,
      outstandingBalancePesewas,
      dirtyRooms,
      folioSettled: outstandingBalancePesewas === 0,
    };
  });
}

// -------------------------------------------------------------
// Walk-In / Front-Desk Reservation Creation
// -------------------------------------------------------------

export async function createFrontDeskReservation(input: CreateFrontDeskReservationInput) {
  const {
    roomTypeId,
    roomId,
    checkIn,
    checkOut,
    adults = 1,
    children = 0,
    guest: guestData,
    extras = [],
    depositPesewas = 0,
    notes,
    user,
  } = input;

  return await prisma.$transaction(async (tx) => {
    // 1. Verify RoomType exists & active
    const roomType = await tx.roomType.findUnique({
      where: { id: roomTypeId },
    });
    if (!roomType || !roomType.isActive) {
      throw new AppError("Room type not found or inactive", 404, "ROOM_TYPE_NOT_FOUND");
    }

    // 2. Compute Stay Pricing
    const pricing = await computeStayPricing(
      {
        roomTypeId,
        checkIn,
        checkOut,
        adults,
        children,
        extras,
      },
      tx as unknown as Parameters<typeof computeStayPricing>[1]
    );

    // 3. Upsert Guest (Customer)
    const customer = await tx.customer.upsert({
      where: { phone: guestData.phone },
      update: {
        name: guestData.name,
        ...(guestData.email ? { email: guestData.email } : {}),
        ...(guestData.nationality ? { nationality: guestData.nationality } : {}),
        ...(guestData.idType ? { idType: guestData.idType } : {}),
        ...(guestData.idNumber ? { idNumber: guestData.idNumber } : {}),
        ...(guestData.vehiclePlate ? { vehiclePlate: guestData.vehiclePlate } : {}),
      },
      create: {
        name: guestData.name,
        phone: guestData.phone,
        email: guestData.email || null,
        nationality: guestData.nationality || null,
        idType: guestData.idType || null,
        idNumber: guestData.idNumber || null,
        vehiclePlate: guestData.vehiclePlate || null,
      },
    });

    // 4. Generate Unique Reference
    const dateYear = new Date().getUTCFullYear();
    const randPart = crypto.randomBytes(3).toString("hex").toUpperCase();
    const reference = `HTL-${dateYear}-${randPart}`;

    const checkInDate = parseDateOnly(checkIn);
    const checkOutDate = parseDateOnly(checkOut);

    // Status: if deposit is provided and covers deposit requirement, or 0 deposit accepted for walk-in
    const initialStatus = ReservationStatus.CONFIRMED;

    // 5. Create Reservation
    const reservation = await tx.reservation.create({
      data: {
        reference,
        guestId: customer.id,
        checkInDate,
        checkOutDate,
        adults,
        children,
        status: initialStatus,
        subtotalPesewas: pricing.subtotalPesewas,
        taxPesewas: pricing.taxTotalPesewas,
        totalPesewas: pricing.totalPesewas,
        depositRequiredPesewas: pricing.depositRequiredPesewas,
        amountPaidPesewas: depositPesewas,
        source: ReservationSource.FRONT_DESK,
        notes: notes || "Front desk direct booking",
      },
    });

    // 6. Create ReservationRoom
    await tx.reservationRoom.create({
      data: {
        reservationId: reservation.id,
        roomTypeId,
        roomId: roomId || null,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        status: initialStatus,
        nightlyRatesSnapshot: pricing.nightlyRates as unknown as Prisma.InputJsonValue,
      },
    });

    // 7. Create Extras if any
    for (const extraItem of pricing.extras) {
      await tx.reservationExtra.create({
        data: {
          reservationId: reservation.id,
          extraId: extraItem.extraId,
          quantity: extraItem.quantity,
          pricePesewas: extraItem.unitPricePesewas,
          totalPesewas: extraItem.totalPesewas,
        },
      });
    }

    // 8. Create Folio & Initial Charges
    const folio = await tx.folio.create({
      data: {
        folioNumber: `FOL-${reference}`,
        reservationId: reservation.id,
        status: FolioStatus.OPEN,
      },
    });

    // Post accommodation charge
    await tx.folioCharge.create({
      data: {
        folioId: folio.id,
        description: `Accommodation (${pricing.nights} night${pricing.nights > 1 ? "s" : ""})`,
        source: FolioChargeSource.ROOM,
        amountPesewas: pricing.roomSubtotalPesewas,
        createdByUserId: user.userId,
      },
    });

    // Post extras charges
    for (const extraItem of pricing.extras) {
      await tx.folioCharge.create({
        data: {
          folioId: folio.id,
          description: `Extra: ${extraItem.name} (${extraItem.quantity}x)`,
          source: FolioChargeSource.EXTRA,
          amountPesewas: extraItem.totalPesewas,
          referenceId: extraItem.extraId,
          createdByUserId: user.userId,
        },
      });
    }

    // Post taxes charge
    if (pricing.taxTotalPesewas > 0) {
      await tx.folioCharge.create({
        data: {
          folioId: folio.id,
          description: `Taxes & Levies (${pricing.taxes.map((t) => `${t.name} ${t.percentage}%`).join(", ")})`,
          source: FolioChargeSource.EXTRA,
          amountPesewas: pricing.taxTotalPesewas,
          createdByUserId: user.userId,
        },
      });
    }

    // If upfront deposit paid at Front Desk, record payment charge
    if (depositPesewas > 0) {
      await tx.folioCharge.create({
        data: {
          folioId: folio.id,
          description: `Front Desk Deposit Payment (Cash/POS)`,
          source: FolioChargeSource.PAYMENT,
          amountPesewas: depositPesewas,
          referenceId: `FD-PAY-${randPart}`,
          createdByUserId: user.userId,
        },
      });
    }

    // 9. Write to AuditLog
    await tx.auditLog.create({
      data: {
        userId: user.userId,
        action: "RESERVATION_CREATE",
        entityType: "RESERVATION",
        entityId: reservation.id,
        newValues: {
          reference,
          source: ReservationSource.FRONT_DESK,
          checkIn,
          checkOut,
          roomTypeId,
          roomId: roomId || null,
          totalPesewas: pricing.totalPesewas,
          depositPesewas,
          guestName: customer.name,
          guestPhone: customer.phone,
          createdBy: user.name || user.email || user.userId,
        },
      },
    });

    return await tx.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      include: {
        guest: true,
        rooms: { include: { roomType: true, room: true } },
        extras: { include: { extra: true } },
        folios: { include: { charges: true } },
      },
    });
  });
}

// -------------------------------------------------------------
// Housekeeping Board & Task Management
// -------------------------------------------------------------

export async function getHousekeepingBoard() {
  const [rooms, pendingTasks, users] = await Promise.all([
    prisma.room.findMany({
      include: {
        roomType: true,
        housekeepingTasks: {
          where: {
            status: { in: [HousekeepingTaskStatus.PENDING, HousekeepingTaskStatus.IN_PROGRESS] },
          },
          include: { assignedTo: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ floor: "asc" }, { number: "asc" }],
    }),
    prisma.housekeepingTask.findMany({
      where: {
        status: { in: [HousekeepingTaskStatus.PENDING, HousekeepingTaskStatus.IN_PROGRESS] },
      },
      include: {
        room: { include: { roomType: true } },
        assignedTo: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: {
        role: { name: { in: [ROLES.HOUSEKEEPING, ROLES.STAFF_RECEPTIONIST, ROLES.FRONT_DESK] } },
        active: true,
      },
      select: { id: true, name: true, role: { select: { name: true } } },
    }),
  ]);

  const summary = {
    dirty: rooms.filter((r) => r.status === RoomStatus.DIRTY).length,
    clean: rooms.filter((r) => r.status === RoomStatus.CLEAN).length,
    inspected: rooms.filter((r) => r.status === RoomStatus.INSPECTED).length,
    occupied: rooms.filter((r) => r.status === RoomStatus.OCCUPIED).length,
    outOfOrder: rooms.filter((r) => r.status === RoomStatus.OUT_OF_ORDER).length,
    pendingTasksCount: pendingTasks.length,
  };

  return {
    summary,
    rooms,
    pendingTasks,
    housekeepingStaff: users,
  };
}

export async function updateHousekeepingStatus(input: UpdateHousekeepingStatusInput) {
  const { taskId, roomId, status: newStatus, notes, assignedToUserId, user } = input;

  // Role Security Evaluation:
  // - HOUSEKEEPING can claim tasks and mark CLEAN.
  // - HOUSEKEEPING CANNOT mark INSPECTED (inspection requires Front Desk or Manager!).
  if (newStatus === RoomStatus.INSPECTED) {
    if (user.role === ROLES.HOUSEKEEPING) {
      throw new AppError(
        "Housekeeping staff cannot mark rooms as INSPECTED. Inspection requires Front Desk or Manager review.",
        403,
        "INSPECTION_REQUIRES_SUPERVISOR"
      );
    }
  }

  return await prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new AppError("Room not found", 404, "ROOM_NOT_FOUND");
    }

    const oldStatus = room.status;

    // 1. Update Room Status
    const updatedRoom = await tx.room.update({
      where: { id: roomId },
      data: {
        status: newStatus,
        notes: notes ? (room.notes ? `${room.notes} | ${notes}` : notes) : room.notes,
      },
      include: { roomType: true },
    });

    // 2. Update or Complete Housekeeping Task if exists
    let task = null;
    if (taskId) {
      task = await tx.housekeepingTask.findUnique({ where: { id: taskId } });
    } else {
      task = await tx.housekeepingTask.findFirst({
        where: {
          roomId,
          status: { in: [HousekeepingTaskStatus.PENDING, HousekeepingTaskStatus.IN_PROGRESS] },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    if (task) {
      let taskStatus = task.status;
      if (newStatus === RoomStatus.CLEAN || newStatus === RoomStatus.INSPECTED) {
        taskStatus = HousekeepingTaskStatus.COMPLETED;
      } else if (assignedToUserId || newStatus === RoomStatus.DIRTY) {
        taskStatus = HousekeepingTaskStatus.IN_PROGRESS;
      }

      await tx.housekeepingTask.update({
        where: { id: task.id },
        data: {
          status: taskStatus,
          ...(assignedToUserId ? { assignedToUserId } : {}),
          ...(notes ? { notes } : {}),
        },
      });
    } else if (newStatus === RoomStatus.DIRTY) {
      // Auto-create task if marked dirty and none pending
      await tx.housekeepingTask.create({
        data: {
          roomId,
          status: HousekeepingTaskStatus.PENDING,
          notes: notes || "Room flagged DIRTY",
          assignedToUserId: assignedToUserId || null,
        },
      });
    }

    // 3. Write to AuditLog
    await tx.auditLog.create({
      data: {
        userId: user.userId,
        action: "ROOM_STATUS_UPDATE",
        entityType: "ROOM",
        entityId: room.id,
        oldValues: { status: oldStatus },
        newValues: {
          status: newStatus,
          roomNumber: room.number,
          taskId: task?.id || null,
          assignedToUserId: assignedToUserId || null,
          updatedBy: user.name || user.email || user.userId,
        },
      },
    });

    return updatedRoom;
  });
}

// -------------------------------------------------------------
// Move / Extend Reservation (Tape Chart / Calendar Operations)
// -------------------------------------------------------------

export async function moveExtendReservationRoom(input: MoveExtendReservationInput) {
  const { reservationRoomId, newRoomId, newCheckIn, newCheckOut, user } = input;

  return await prisma.$transaction(async (tx) => {
    const resRoom = await tx.reservationRoom.findUnique({
      where: { id: reservationRoomId },
      include: {
        room: true,
        roomType: true,
        reservation: true,
      },
    });

    if (!resRoom) {
      throw new AppError("Reservation room not found", 404, "RESERVATION_ROOM_NOT_FOUND");
    }

    const checkInDate = newCheckIn ? parseDateOnly(newCheckIn) : resRoom.checkIn;
    const checkOutDate = newCheckOut ? parseDateOnly(newCheckOut) : resRoom.checkOut;
    const targetRoomId = newRoomId !== undefined ? newRoomId : resRoom.roomId;

    if (checkOutDate.getTime() <= checkInDate.getTime()) {
      throw new AppError("Check-out date must be after check-in date", 400, "INVALID_DATE_RANGE");
    }

    try {
      const updatedResRoom = await tx.reservationRoom.update({
        where: { id: reservationRoomId },
        data: {
          roomId: targetRoomId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
        },
        include: { room: true, roomType: true },
      });

      // Keep parent Reservation in sync
      await tx.reservation.update({
        where: { id: resRoom.reservationId },
        data: {
          checkInDate,
          checkOutDate,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          userId: user.userId,
          action: "RESERVATION_MOVE",
          entityType: "RESERVATION_ROOM",
          entityId: resRoom.id,
          oldValues: {
            roomId: resRoom.roomId,
            checkIn: resRoom.checkIn,
            checkOut: resRoom.checkOut,
          },
          newValues: {
            roomId: targetRoomId,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            movedBy: user.name || user.email || user.userId,
          },
        },
      });

      return updatedResRoom;
    } catch (dbErr: unknown) {
      // Catch Postgres exclusion constraint violation (code 23P01)
      const err = dbErr as { code?: string; message?: string };
      if (
        err?.code === "23P01" ||
        err?.message?.includes("exclusion constraint") ||
        err?.message?.includes("no_overlapping_assigned_room_reservations")
      ) {
        throw new AppError(
          "Room Conflict: This room already has an active overlapping reservation for the selected dates.",
          409,
          "ROOM_OVERLAP_CONFLICT"
        );
      }
      throw dbErr;
    }
  });
}

// -------------------------------------------------------------
// Dashboard KPIs
// -------------------------------------------------------------

export async function getHotelDashboardKPIs() {
  const now = new Date();
  const todayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrowDate = new Date(todayDate.getTime() + 24 * 60 * 60 * 1000);

  const [
    arrivalsToday,
    departuresToday,
    inHouseReservations,
    allRooms,
    recentReservations,
  ] = await Promise.all([
    // Arrivals today
    prisma.reservation.findMany({
      where: {
        checkInDate: { gte: todayDate, lt: tomorrowDate },
        status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.PENDING_PAYMENT, ReservationStatus.CHECKED_IN] },
      },
      include: {
        guest: true,
        rooms: { include: { roomType: true, room: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Departures today
    prisma.reservation.findMany({
      where: {
        checkOutDate: { gte: todayDate, lt: tomorrowDate },
        status: { in: [ReservationStatus.CHECKED_IN, ReservationStatus.CHECKED_OUT] },
      },
      include: {
        guest: true,
        rooms: { include: { roomType: true, room: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // In-house reservations (status CHECKED_IN)
    prisma.reservation.findMany({
      where: {
        status: ReservationStatus.CHECKED_IN,
      },
      include: {
        guest: true,
        rooms: { include: { roomType: true, room: true } },
      },
    }),
    // All rooms for occupancy & status breakdown
    prisma.room.findMany({
      include: { roomType: true },
    }),
    // Recent reservations
    prisma.reservation.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        guest: true,
        rooms: { include: { roomType: true, room: true } },
      },
    }),
  ]);

  const totalOperationalRooms = allRooms.filter((r) => r.status !== RoomStatus.OUT_OF_ORDER).length;
  const occupiedRooms = allRooms.filter((r) => r.status === RoomStatus.OCCUPIED).length;
  const occupancyPercent = totalOperationalRooms > 0 ? Math.round((occupiedRooms / totalOperationalRooms) * 100) : 0;

  const inHouseGuests = inHouseReservations.reduce((sum, res) => sum + res.adults + res.children, 0);

  const roomsByStatus = {
    CLEAN: allRooms.filter((r) => r.status === RoomStatus.CLEAN).length,
    DIRTY: allRooms.filter((r) => r.status === RoomStatus.DIRTY).length,
    INSPECTED: allRooms.filter((r) => r.status === RoomStatus.INSPECTED).length,
    OCCUPIED: allRooms.filter((r) => r.status === RoomStatus.OCCUPIED).length,
    OUT_OF_ORDER: allRooms.filter((r) => r.status === RoomStatus.OUT_OF_ORDER).length,
  };

  return {
    kpis: {
      arrivalsTodayCount: arrivalsToday.length,
      departuresTodayCount: departuresToday.length,
      inHouseGuestsCount: inHouseGuests,
      occupancyPercent,
      totalRoomsCount: allRooms.length,
      operationalRoomsCount: totalOperationalRooms,
      occupiedRoomsCount: occupiedRooms,
      roomsByStatus,
    },
    arrivalsToday,
    departuresToday,
    inHouseReservations,
    recentReservations,
  };
}

// -------------------------------------------------------------
// Tape Chart (Calendar Grid) Data
// -------------------------------------------------------------

export async function getTapeChartData(startDateStr?: string, days = 14) {
  const base = startDateStr ? parseDateOnly(startDateStr) : new Date();
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);

  const [rooms, reservationRooms] = await Promise.all([
    prisma.room.findMany({
      include: { roomType: true },
      orderBy: [{ floor: "asc" }, { number: "asc" }],
    }),
    prisma.reservationRoom.findMany({
      where: {
        status: { in: [ReservationStatus.HELD, ReservationStatus.PENDING_PAYMENT, ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
        checkIn: { lt: end },
        checkOut: { gt: start },
      },
      include: {
        reservation: {
          include: { guest: true },
        },
        roomType: true,
      },
    }),
  ]);

  // Generate date columns
  const dateColumns: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    dateColumns.push(formatDateOnly(d));
  }

  return {
    startDate: formatDateOnly(start),
    endDate: formatDateOnly(end),
    days,
    dateColumns,
    rooms,
    reservationRooms,
  };
}
