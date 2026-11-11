import { randomBytes } from "node:crypto";
import { prisma } from "../db";
import { AppError } from "../api-response";
import { getSettings } from "../settings";
import {
  ReservationStatus,
  RoomStatus,
  FolioStatus,
  FolioChargeSource,
  ReservationSource,
  PrismaClient,
  Prisma,
} from "@prisma/client";
import {
  calculateStayNights,
  parseDateOnly,
  formatDateOnly,
  getHoursUntilCheckIn,
} from "./date-utils";
import {
  CreateReservationFromHoldInput,
  AssignRoomInput,
  MoveReservationInput,
  CancelReservationInput,
  CancellationResult,
  createReservationFromHoldSchema,
  assignRoomSchema,
  moveReservationSchema,
  cancelReservationSchema,
} from "./types";
import { computeStayPricing } from "./pricing";
import { getRoomTypeAvailability } from "./availability";

const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.HELD,
  ReservationStatus.PENDING_PAYMENT,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

/**
 * Creates a confirmed/pending Reservation from an active RoomHold.
 * Atomically creates the Reservation, ReservationRooms, Extras, Folio, and FolioCharges,
 * then releases the hold.
 */
export async function createReservationFromHold(input: CreateReservationFromHoldInput) {
  const parsed = createReservationFromHoldSchema.parse(input);
  const { holdToken, guestId: providedGuestId, guest: guestData, adults, children, extras, notes, source, initialStatus } = parsed;

  return await prisma.$transaction(async (tx) => {
    // 1. Fetch and validate RoomHold
    const hold = await tx.roomHold.findUnique({
      where: { token: holdToken },
      include: { roomType: true },
    });

    if (!hold) {
      throw new AppError("Hold token not found", 404, "HOLD_NOT_FOUND");
    }

    if (hold.expiresAt.getTime() <= Date.now()) {
      throw new AppError("Room hold has expired", 410, "HOLD_EXPIRED");
    }

    // 2. Identify or create Guest (Customer)
    let guestId = providedGuestId;
    if (!guestId) {
      if (!guestData || !guestData.phone || !guestData.name) {
        throw new AppError("Guest contact details are required", 400, "GUEST_REQUIRED");
      }

      const customer = await tx.customer.upsert({
        where: { phone: guestData.phone },
        update: {
          name: guestData.name,
          email: guestData.email || undefined,
          idType: guestData.idType,
          idNumber: guestData.idNumber,
          nationality: guestData.nationality,
          company: guestData.company,
          vehiclePlate: guestData.vehiclePlate,
        },
        create: {
          name: guestData.name,
          phone: guestData.phone,
          email: guestData.email || null,
          idType: guestData.idType,
          idNumber: guestData.idNumber,
          nationality: guestData.nationality,
          company: guestData.company,
          vehiclePlate: guestData.vehiclePlate,
        },
      });
      guestId = customer.id;
    } else {
      const existing = await tx.customer.findUnique({ where: { id: guestId } });
      if (!existing) {
        throw new AppError("Guest customer not found", 404, "GUEST_NOT_FOUND");
      }
    }

    // 3. Compute final pricing breakdown
    const checkInStr = formatDateOnly(hold.checkIn);
    const checkOutStr = formatDateOnly(hold.checkOut);

    const pricing = await computeStayPricing(
      {
        roomTypeId: hold.roomTypeId,
        checkIn: checkInStr,
        checkOut: checkOutStr,
        quantity: hold.quantity,
        adults,
        children,
        extras,
      },
      tx as unknown as PrismaClient
    );

    // 4. Generate unique reservation reference: e.g. HTL-2026-AB12CD
    const dateYear = hold.checkIn.getUTCFullYear();
    const randPart = randomBytes(3).toString("hex").toUpperCase();
    const reference = `HTL-${dateYear}-${randPart}`;

    // 5. Create Reservation
    const targetStatus = initialStatus || ReservationStatus.CONFIRMED;

    const reservation = await tx.reservation.create({
      data: {
        reference,
        guestId,
        checkInDate: hold.checkIn,
        checkOutDate: hold.checkOut,
        adults,
        children,
        status: targetStatus,
        subtotalPesewas: pricing.subtotalPesewas,
        taxPesewas: pricing.taxTotalPesewas,
        totalPesewas: pricing.totalPesewas,
        depositRequiredPesewas: pricing.depositRequiredPesewas,
        amountPaidPesewas: 0,
        source: source || ReservationSource.WEBSITE,
        notes: notes || null,
      },
    });

    // 6. Create ReservationRoom records (one per room in quantity)
    for (let i = 0; i < hold.quantity; i++) {
      await tx.reservationRoom.create({
        data: {
          reservationId: reservation.id,
          roomTypeId: hold.roomTypeId,
          roomId: null, // Room assignment happens at check-in or via assignRoom()
          checkIn: hold.checkIn,
          checkOut: hold.checkOut,
          status: targetStatus,
          nightlyRatesSnapshot: pricing.nightlyRates as unknown as Prisma.InputJsonValue,
        },
      });
    }

    // 7. Create ReservationExtras if any
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

    // 8. Create Folio and initial FolioCharges
    const folio = await tx.folio.create({
      data: {
        folioNumber: `FOL-${reference}`,
        reservationId: reservation.id,
        status: FolioStatus.OPEN,
      },
    });

    // Room charges folio line
    await tx.folioCharge.create({
      data: {
        folioId: folio.id,
        description: `Accommodation (${pricing.nights} night${pricing.nights > 1 ? "s" : ""}, ${hold.quantity} room${hold.quantity > 1 ? "s" : ""})`,
        source: FolioChargeSource.ROOM,
        amountPesewas: pricing.roomSubtotalPesewas,
      },
    });

    // Extras charges folio lines
    for (const extraItem of pricing.extras) {
      await tx.folioCharge.create({
        data: {
          folioId: folio.id,
          description: `Extra: ${extraItem.name} (Qty: ${extraItem.quantity})`,
          source: FolioChargeSource.EXTRA,
          amountPesewas: extraItem.totalPesewas,
          referenceId: extraItem.extraId,
        },
      });
    }

    // Taxes folio line
    if (pricing.taxTotalPesewas > 0) {
      await tx.folioCharge.create({
        data: {
          folioId: folio.id,
          description: `Taxes & Levies (${pricing.taxes.map((t) => `${t.name} ${t.percentage}%`).join(", ")})`,
          source: FolioChargeSource.EXTRA,
          amountPesewas: pricing.taxTotalPesewas,
        },
      });
    }

    // 9. Consume/delete the RoomHold
    await tx.roomHold.delete({
      where: { id: hold.id },
    });

    // 10. Audit Log
    await tx.auditLog.create({
      data: {
        action: "RESERVATION_CREATE",
        entityType: "RESERVATION",
        entityId: reservation.id,
        newValues: {
          reference,
          guestId,
          checkIn: checkInStr,
          checkOut: checkOutStr,
          roomTypeId: hold.roomTypeId,
          quantity: hold.quantity,
          totalPesewas: pricing.totalPesewas,
          folioId: folio.id,
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

/**
 * Assigns a specific physical room (or auto-picks a free room) to a ReservationRoom.
 */
export async function assignRoom(input: AssignRoomInput) {
  const parsed = assignRoomSchema.parse(input);
  const { reservationRoomId, roomId: requestedRoomId } = parsed;

  return await prisma.$transaction(async (tx) => {
    const resRoom = await tx.reservationRoom.findUnique({
      where: { id: reservationRoomId },
      include: { roomType: true },
    });

    if (!resRoom) {
      throw new AppError("Reservation room not found", 404, "RESERVATION_ROOM_NOT_FOUND");
    }

    let assignedRoomId: string;

    if (requestedRoomId) {
      // 1. Verify requested room exists, belongs to roomType, and is not OUT_OF_ORDER
      const room = await tx.room.findUnique({
        where: { id: requestedRoomId },
      });

      if (!room) {
        throw new AppError("Room not found", 404, "ROOM_NOT_FOUND");
      }

      if (room.roomTypeId !== resRoom.roomTypeId) {
        throw new AppError("Room does not belong to the required room type", 400, "ROOM_TYPE_MISMATCH");
      }

      if (room.status === RoomStatus.OUT_OF_ORDER) {
        throw new AppError(`Room ${room.number} is currently Out of Order`, 409, "ROOM_OUT_OF_ORDER");
      }

      // 2. Check for overlapping active reservations on requested room
      const overlap = await tx.reservationRoom.findFirst({
        where: {
          id: { not: reservationRoomId },
          roomId: requestedRoomId,
          status: { in: ACTIVE_RESERVATION_STATUSES },
          checkIn: { lt: resRoom.checkOut },
          checkOut: { gt: resRoom.checkIn },
        },
      });

      if (overlap) {
        throw new AppError(
          `Room ${room.number} is already occupied for overlapping dates`,
          409,
          "ROOM_ALREADY_OCCUPIED"
        );
      }

      assignedRoomId = room.id;
    } else {
      // Auto-pick: query operational rooms of the type and find one without overlap
      const operationalRooms = await tx.room.findMany({
        where: {
          roomTypeId: resRoom.roomTypeId,
          status: { not: RoomStatus.OUT_OF_ORDER },
        },
        orderBy: [{ status: "asc" }, { number: "asc" }], // Clean/Inspected first
      });

      if (operationalRooms.length === 0) {
        throw new AppError("No operational rooms available for this room type", 409, "NO_OPERATIONAL_ROOMS");
      }

      let freeRoomId: string | null = null;
      for (const candidate of operationalRooms) {
        const overlap = await tx.reservationRoom.findFirst({
          where: {
            id: { not: reservationRoomId },
            roomId: candidate.id,
            status: { in: ACTIVE_RESERVATION_STATUSES },
            checkIn: { lt: resRoom.checkOut },
            checkOut: { gt: resRoom.checkIn },
          },
        });

        if (!overlap) {
          freeRoomId = candidate.id;
          break;
        }
      }

      if (!freeRoomId) {
        throw new AppError("No unassigned free room found for these dates", 409, "NO_FREE_ROOM_AVAILABLE");
      }

      assignedRoomId = freeRoomId;
    }

    // 3. Update ReservationRoom
    const updated = await tx.reservationRoom.update({
      where: { id: reservationRoomId },
      data: { roomId: assignedRoomId },
      include: { room: true, roomType: true },
    });

    // 4. Audit Log
    await tx.auditLog.create({
      data: {
        action: "ROOM_ASSIGN",
        entityType: "RESERVATION_ROOM",
        entityId: reservationRoomId,
        newValues: {
          roomId: assignedRoomId,
          roomNumber: updated.room?.number,
        },
      },
    });

    return updated;
  });
}

/**
 * Moves an existing reservation to new dates and/or new room type.
 */
export async function moveReservation(input: MoveReservationInput) {
  const parsed = moveReservationSchema.parse(input);
  const { reservationId, newCheckIn: newCheckInStr, newCheckOut: newCheckOutStr, newRoomTypeId } = parsed;

  const newCheckIn = parseDateOnly(newCheckInStr);
  const newCheckOut = parseDateOnly(newCheckOutStr);
  calculateStayNights(newCheckIn, newCheckOut);

  return await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: {
        rooms: { include: { roomType: true } },
        folios: true,
      },
    });

    if (!reservation) {
      throw new AppError("Reservation not found", 404, "RESERVATION_NOT_FOUND");
    }

    if (reservation.status === ReservationStatus.CANCELLED || reservation.status === ReservationStatus.CHECKED_OUT) {
      throw new AppError(`Cannot move a ${reservation.status} reservation`, 400, "CANNOT_MOVE_RESERVATION");
    }

    const targetRoomTypeId = newRoomTypeId || reservation.rooms[0]?.roomTypeId;
    if (!targetRoomTypeId) {
      throw new AppError("Room type not found for reservation", 400, "INVALID_ROOM_TYPE");
    }

    // 1. Verify availability for the new dates
    const availResults = await getRoomTypeAvailability(
      {
        checkIn: newCheckInStr,
        checkOut: newCheckOutStr,
        roomTypeId: targetRoomTypeId,
        adults: reservation.adults,
        children: reservation.children,
      },
      tx as unknown as PrismaClient
    );

    const roomAvail = availResults.find((a) => a.roomTypeId === targetRoomTypeId);
    // Ignore current reservation's own rooms when calculating availability
    const neededQty = reservation.rooms.length;
    if (!roomAvail || (roomAvail.availableQuantity + neededQty) < neededQty) {
      throw new AppError("Selected room type is not available on the new dates", 409, "ROOMS_UNAVAILABLE");
    }

    // 2. Recompute pricing for new dates
    const newPricing = await computeStayPricing(
      {
        roomTypeId: targetRoomTypeId,
        checkIn: newCheckInStr,
        checkOut: newCheckOutStr,
        quantity: reservation.rooms.length,
        adults: reservation.adults,
        children: reservation.children,
      },
      tx as unknown as PrismaClient
    );

    // 3. Update Reservation
    const updatedRes = await tx.reservation.update({
      where: { id: reservationId },
      data: {
        checkInDate: newCheckIn,
        checkOutDate: newCheckOut,
        subtotalPesewas: newPricing.subtotalPesewas,
        taxPesewas: newPricing.taxTotalPesewas,
        totalPesewas: newPricing.totalPesewas,
      },
    });

    // 4. Update child ReservationRooms
    for (const rRoom of reservation.rooms) {
      await tx.reservationRoom.update({
        where: { id: rRoom.id },
        data: {
          checkIn: newCheckIn,
          checkOut: newCheckOut,
          roomTypeId: targetRoomTypeId,
          roomId: newRoomTypeId && newRoomTypeId !== rRoom.roomTypeId ? null : rRoom.roomId,
          nightlyRatesSnapshot: newPricing.nightlyRates as unknown as Prisma.InputJsonValue,
        },
      });
    }

    // 5. If pricing changed, record ADJUSTMENT on Folio
    const priceDiff = newPricing.totalPesewas - reservation.totalPesewas;
    if (priceDiff !== 0 && reservation.folios.length > 0) {
      const folio = reservation.folios[0];
      await tx.folioCharge.create({
        data: {
          folioId: folio.id,
          description: `Reservation Date/Type Change Adjustment (${formatDateOnly(newCheckIn)} - ${formatDateOnly(newCheckOut)})`,
          source: FolioChargeSource.ADJUSTMENT,
          amountPesewas: priceDiff,
        },
      });
    }

    // 6. Audit Log
    await tx.auditLog.create({
      data: {
        action: "RESERVATION_MOVE",
        entityType: "RESERVATION",
        entityId: reservationId,
        oldValues: {
          checkIn: formatDateOnly(reservation.checkInDate),
          checkOut: formatDateOnly(reservation.checkOutDate),
          totalPesewas: reservation.totalPesewas,
        },
        newValues: {
          checkIn: newCheckInStr,
          checkOut: newCheckOutStr,
          totalPesewas: newPricing.totalPesewas,
          priceDifference: priceDiff,
        },
      },
    });

    return updatedRes;
  });
}

/**
 * Cancels an existing reservation according to hotel settings cancellation policies.
 * Calculates refund amount and cancellation penalty in integer pesewas.
 */
export async function cancelReservation(input: CancelReservationInput): Promise<CancellationResult> {
  const parsed = cancelReservationSchema.parse(input);
  const { reservationId, reason, cancelledByUserId } = parsed;

  return await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: {
        rooms: true,
        folios: true,
      },
    });

    if (!reservation) {
      throw new AppError("Reservation not found", 404, "RESERVATION_NOT_FOUND");
    }

    if (reservation.status === ReservationStatus.CANCELLED) {
      throw new AppError("Reservation is already cancelled", 400, "ALREADY_CANCELLED");
    }

    // 1. Fetch settings for cancellation policy
    const settings = await getSettings();
    const hoursUntilCheckIn = getHoursUntilCheckIn(
      reservation.checkInDate,
      settings.standardCheckInTime || "14:00"
    );

    let penaltyPesewas = 0;
    let refundPesewas = 0;
    let isFreeCancellation = false;
    let policyNotes = "";

    // 2. Cancellation Policy Rule Evaluation
    if (hoursUntilCheckIn >= settings.freeCancelHoursBeforeCheckIn) {
      // Before cutoff: Free cancellation permitted (100% refund of paid amount)
      isFreeCancellation = true;
      penaltyPesewas = 0;
      refundPesewas = reservation.amountPaidPesewas;
      policyNotes = `Free cancellation within policy window (${Math.round(hoursUntilCheckIn)}h before check-in >= ${settings.freeCancelHoursBeforeCheckIn}h cutoff). 100% refund of paid amount.`;
    } else {
      // After cutoff: Penalty percentage applies
      isFreeCancellation = false;
      // Penalty is computed as percentage of stay total
      const penaltyRate = settings.cancellationPenaltyPercent / 100;
      penaltyPesewas = Math.round(reservation.totalPesewas * penaltyRate);

      // Refund is remainder of amount paid after penalty deduction
      refundPesewas = Math.max(0, reservation.amountPaidPesewas - penaltyPesewas);
      policyNotes = `Late cancellation after cutoff window (${Math.round(hoursUntilCheckIn)}h before check-in < ${settings.freeCancelHoursBeforeCheckIn}h cutoff). Penalty of ${settings.cancellationPenaltyPercent}% applied.`;
    }

    // 3. Update Reservation status
    const updated = await tx.reservation.update({
      where: { id: reservationId },
      data: {
        status: ReservationStatus.CANCELLED,
        notes: reservation.notes ? `${reservation.notes} | Cancelled: ${reason}` : `Cancelled: ${reason}`,
      },
    });

    // 4. Update child ReservationRooms to CANCELLED (instantly frees up room capacity!)
    await tx.reservationRoom.updateMany({
      where: { reservationId },
      data: { status: ReservationStatus.CANCELLED },
    });

    // 5. If Folio exists, record cancellation penalty / refund adjustment
    if (reservation.folios.length > 0) {
      const folio = reservation.folios[0];
      await tx.folioCharge.create({
        data: {
          folioId: folio.id,
          description: `Cancellation Penalty (${policyNotes})`,
          source: FolioChargeSource.ADJUSTMENT,
          amountPesewas: penaltyPesewas,
          createdByUserId: cancelledByUserId || null,
        },
      });
    }

    // 6. Audit Log
    await tx.auditLog.create({
      data: {
        userId: cancelledByUserId || null,
        action: "RESERVATION_CANCEL",
        entityType: "RESERVATION",
        entityId: reservationId,
        newValues: {
          status: ReservationStatus.CANCELLED,
          reason,
          hoursUntilCheckIn,
          isFreeCancellation,
          penaltyPesewas,
          refundPesewas,
          amountPaidPesewas: reservation.amountPaidPesewas,
        },
      },
    });

    return {
      reservationId: updated.id,
      status: updated.status,
      totalPesewas: updated.totalPesewas,
      amountPaidPesewas: updated.amountPaidPesewas,
      penaltyPesewas,
      refundPesewas,
      isFreeCancellation,
      hoursUntilCheckIn,
      policyNotes,
    };
  });
}
