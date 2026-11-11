import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  RoomStatus,
  ReservationStatus,
  HousekeepingTaskStatus,
} from "@prisma/client";
import {
  checkInReservation,
  checkOutReservation,
  createFrontDeskReservation,
  updateHousekeepingStatus,
  getHousekeepingBoard,
  getHotelDashboardKPIs,
  moveExtendReservationRoom,
} from "@/lib/hotel/operations";
import { formatDateOnly } from "@/lib/hotel/date-utils";
import { ROLES } from "@/lib/rbac";

describe("Staff Hotel Operations (Check-in, Check-out, Housekeeping & RBAC)", () => {
  let testRoomTypeId: string;
  let testRoom101Id: string;
  let testRoom102Id: string;
  let testGuestId: string;

  // Mock Users representing different staff roles (populated with real DB IDs in beforeAll)
  const ownerUser = {
    userId: "",
    role: ROLES.OWNER_ADMIN,
    name: "Kwesi Owner",
    email: "owner-test-ops@hotel.gh",
  };

  const managerUser = {
    userId: "",
    role: ROLES.MANAGER,
    name: "Akua Manager",
    email: "manager-test-ops@hotel.gh",
  };

  const frontDeskUser = {
    userId: "",
    role: ROLES.FRONT_DESK,
    name: "Kofi Reception",
    email: "frontdesk-test-ops@hotel.gh",
  };

  const housekeepingUser = {
    userId: "",
    role: ROLES.HOUSEKEEPING,
    name: "Ama Cleaner",
    email: "housekeeping-test-ops@hotel.gh",
  };

  const todayStr = formatDateOnly(new Date());
  const tmrDate = new Date();
  tmrDate.setUTCDate(tmrDate.getUTCDate() + 1);
  const tomorrowStr = formatDateOnly(tmrDate);

  const futureInDate = new Date();
  futureInDate.setUTCDate(futureInDate.getUTCDate() + 5);
  const futureCheckIn = formatDateOnly(futureInDate);

  const futureOutDate = new Date();
  futureOutDate.setUTCDate(futureOutDate.getUTCDate() + 7);
  const futureCheckOut = formatDateOnly(futureOutDate);

  beforeAll(async () => {
    // 0. Ensure Roles and Staff Users exist in DB for foreign key relations
    const roles = await prisma.role.findMany();
    const roleMap = new Map(roles.map((r) => [r.name, r.id]));

    const uOwner = await prisma.user.upsert({
      where: { email: "owner-test-ops@hotel.gh" },
      update: {},
      create: {
        email: "owner-test-ops@hotel.gh",
        name: "Kwesi Owner",
        passwordHash: "hashed",
        roleId: roleMap.get(ROLES.OWNER_ADMIN)!,
      },
    });
    ownerUser.userId = uOwner.id;

    const uManager = await prisma.user.upsert({
      where: { email: "manager-test-ops@hotel.gh" },
      update: {},
      create: {
        email: "manager-test-ops@hotel.gh",
        name: "Akua Manager",
        passwordHash: "hashed",
        roleId: roleMap.get(ROLES.MANAGER)!,
      },
    });
    managerUser.userId = uManager.id;

    const uFrontDesk = await prisma.user.upsert({
      where: { email: "frontdesk-test-ops@hotel.gh" },
      update: {},
      create: {
        email: "frontdesk-test-ops@hotel.gh",
        name: "Kofi Reception",
        passwordHash: "hashed",
        roleId: roleMap.get(ROLES.FRONT_DESK)!,
      },
    });
    frontDeskUser.userId = uFrontDesk.id;

    const uHousekeeping = await prisma.user.upsert({
      where: { email: "housekeeping-test-ops@hotel.gh" },
      update: {},
      create: {
        email: "housekeeping-test-ops@hotel.gh",
        name: "Ama Cleaner",
        passwordHash: "hashed",
        roleId: roleMap.get(ROLES.HOUSEKEEPING)!,
      },
    });
    housekeepingUser.userId = uHousekeeping.id;

    // 1. Create RoomType
    const rt = await prisma.roomType.create({
      data: {
        name: `Executive Suite Ops ${Date.now()}`,
        slug: `exec-ops-${Date.now()}`,
        description: "Suite for staff operations testing",
        maxAdults: 2,
        maxChildren: 1,
        bedConfiguration: "1 King Bed",
        basePricePesewas: 150000, // GH₵ 1,500.00 / night
        amenities: ["WiFi", "Balcony", "AC"],
        imageUrls: ["/images/suites/exec.jpg"],
        isActive: true,
      },
    });
    testRoomTypeId = rt.id;

    // 2. Create Rooms
    const r1 = await prisma.room.create({
      data: {
        number: `OPS-201-${Date.now()}`,
        floor: 2,
        roomTypeId: rt.id,
        status: RoomStatus.CLEAN,
      },
    });
    testRoom101Id = r1.id;

    const r2 = await prisma.room.create({
      data: {
        number: `OPS-202-${Date.now()}`,
        floor: 2,
        roomTypeId: rt.id,
        status: RoomStatus.CLEAN,
      },
    });
    testRoom102Id = r2.id;

    // 3. Create Guest
    const guest = await prisma.customer.create({
      data: {
        name: "Abena Mansa",
        phone: `+233${Math.floor(200000000 + Math.random() * 700000000)}`,
        email: `abena.${Date.now()}@example.gh`,
        nationality: "Ghanaian",
      },
    });
    testGuestId = guest.id;
  });

  afterAll(async () => {
    // Find all customers created for this test suite
    const testCustomers = await prisma.customer.findMany({
      where: {
        OR: [
          { id: testGuestId },
          { name: "Kofi Conflicted" },
          { phone: "+233249998888" },
          { phone: "+233241114444" },
        ],
      },
      select: { id: true },
    });
    const customerIds = testCustomers.map((c) => c.id);

    const reservations = await prisma.reservation.findMany({
      where: {
        OR: [
          { guestId: { in: customerIds } },
          { rooms: { some: { roomTypeId: testRoomTypeId } } },
        ],
      },
      select: { id: true },
    });
    const resIds = reservations.map((r) => r.id);

    if (resIds.length > 0) {
      await prisma.folioCharge.deleteMany({
        where: { folio: { reservationId: { in: resIds } } },
      });
      await prisma.folio.deleteMany({
        where: { reservationId: { in: resIds } },
      });
      await prisma.reservationRoom.deleteMany({
        where: { reservationId: { in: resIds } },
      });
      await prisma.reservation.deleteMany({
        where: { id: { in: resIds } },
      });
    }

    await prisma.housekeepingTask.deleteMany({
      where: { roomId: { in: [testRoom101Id, testRoom102Id] } },
    });
    await prisma.room.deleteMany({
      where: { roomTypeId: testRoomTypeId },
    });
    await prisma.roomType.deleteMany({
      where: { id: testRoomTypeId },
    });
    if (customerIds.length > 0) {
      await prisma.customer.deleteMany({
        where: { id: { in: customerIds } },
      });
    }
  });

  // TEST 1: Check-in Flow & Early Check-in Role Gating
  describe("Check-in Operations", () => {
    it("rejects early check-in by front desk staff when scheduled in the future without manager approval", async () => {
      // Create a reservation for 5 days in the future
      const res = await createFrontDeskReservation({
        roomTypeId: testRoomTypeId,
        checkIn: futureCheckIn,
        checkOut: futureCheckOut,
        adults: 2,
        guest: {
          name: "Abena Mansa",
          phone: "+233249998888",
        },
        user: frontDeskUser,
      });

      // Front desk staff attempts early check-in today without manager override -> 403
      await expect(
        checkInReservation({
          reservationId: res.id,
          roomId: testRoom101Id,
          user: frontDeskUser,
        })
      ).rejects.toThrow("requires Manager approval");
    });

    it("successfully checks in guest, assigns room, updates room to OCCUPIED, captures ID details, and logs audit trail", async () => {
      // Create a reservation for today
      const res = await createFrontDeskReservation({
        roomTypeId: testRoomTypeId,
        roomId: testRoom101Id,
        checkIn: todayStr,
        checkOut: tomorrowStr,
        adults: 2,
        guest: {
          name: "Abena Mansa",
          phone: "+233249998888",
        },
        user: frontDeskUser,
      });

      const checkInResult = await checkInReservation({
        reservationId: res.id,
        roomId: testRoom101Id,
        guestDetails: {
          idType: "Ghana Card",
          idNumber: "GHA-123456789-0",
          nationality: "Ghanaian",
          vehiclePlate: "GW 9012-24",
        },
        earlyCheckInApproved: true,
        user: frontDeskUser,
      });

      expect(checkInResult.success).toBe(true);
      expect(checkInResult.status).toBe(ReservationStatus.CHECKED_IN);

      // Verify Reservation in DB
      const updatedRes = await prisma.reservation.findUnique({
        where: { id: res.id },
        include: { guest: true, rooms: true },
      });
      expect(updatedRes?.status).toBe(ReservationStatus.CHECKED_IN);
      expect(updatedRes?.guest.idType).toBe("Ghana Card");
      expect(updatedRes?.guest.idNumber).toBe("GHA-123456789-0");

      // Verify Room status changed to OCCUPIED
      const updatedRoom = await prisma.room.findUnique({
        where: { id: testRoom101Id },
      });
      expect(updatedRoom?.status).toBe(RoomStatus.OCCUPIED);

      // Verify AuditLog record exists
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          entityId: res.id,
          action: "CHECK_IN",
        },
        orderBy: { createdAt: "desc" },
      });
      expect(auditLog).toBeDefined();
      expect(auditLog?.userId).toBe(frontDeskUser.userId);
      // Ensure ID number is NOT leaked into audit log values per sensitive data rules
      const newVals = auditLog?.newValues as Record<string, unknown> | null;
      expect(newVals?.hasGuestIdNumber).toBe(true);
      expect(JSON.stringify(newVals)).not.toContain("GHA-123456789-0");
    });
  });

  // TEST 2: Check-out Flow & Unpaid Balance Enforcement
  describe("Check-out Operations & Unpaid Balance Enforcement", () => {
    let checkedInResId: string;

    beforeAll(async () => {
      // Create a checked-in reservation with unpaid balance
      const res = await createFrontDeskReservation({
        roomTypeId: testRoomTypeId,
        roomId: testRoom102Id,
        checkIn: todayStr,
        checkOut: tomorrowStr,
        adults: 1,
        guest: {
          name: "Abena Mansa",
          phone: "+233249998888",
        },
        depositPesewas: 0, // No payment made -> full balance unpaid
        user: frontDeskUser,
      });

      await checkInReservation({
        reservationId: res.id,
        roomId: testRoom102Id,
        earlyCheckInApproved: true,
        user: managerUser,
      });

      checkedInResId = res.id;
    });

    it("rejects check-out by front desk when reservation has an unpaid balance without manager override", async () => {
      await expect(
        checkOutReservation({
          reservationId: checkedInResId,
          overrideUnpaidBalance: false,
          user: frontDeskUser,
        })
      ).rejects.toThrow("manager override required");
    });

    it("rejects check-out when manager override is requested but override reason is missing", async () => {
      await expect(
        checkOutReservation({
          reservationId: checkedInResId,
          overrideUnpaidBalance: true,
          overrideReason: "", // missing reason!
          user: managerUser,
        })
      ).rejects.toThrow("A valid override reason is mandatory");
    });

    it("allows check-out with unpaid balance when manager authorizes with reason, marks room DIRTY, and creates HousekeepingTask", async () => {
      const checkOutResult = await checkOutReservation({
        reservationId: checkedInResId,
        overrideUnpaidBalance: true,
        overrideReason: "Corporate client invoice to be settled by MTN Ghana",
        user: managerUser,
      });

      expect(checkOutResult.success).toBe(true);
      expect(checkOutResult.status).toBe(ReservationStatus.CHECKED_OUT);
      expect(checkOutResult.outstandingBalancePesewas).toBeGreaterThan(0);

      // Verify Reservation status in DB
      const resInDb = await prisma.reservation.findUnique({
        where: { id: checkedInResId },
      });
      expect(resInDb?.status).toBe(ReservationStatus.CHECKED_OUT);

      // Verify Room status changed to DIRTY
      const roomInDb = await prisma.room.findUnique({
        where: { id: testRoom102Id },
      });
      expect(roomInDb?.status).toBe(RoomStatus.DIRTY);

      // Verify HousekeepingTask was automatically created
      const task = await prisma.housekeepingTask.findFirst({
        where: {
          roomId: testRoom102Id,
          status: HousekeepingTaskStatus.PENDING,
        },
      });
      expect(task).toBeDefined();
      expect(task?.notes).toContain("Checkout turnover");

      // Verify AuditLog record was written
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          entityId: checkedInResId,
          action: "CHECK_OUT",
        },
        orderBy: { createdAt: "desc" },
      });
      expect(auditLog).toBeDefined();
      expect(auditLog?.userId).toBe(managerUser.userId);
      const newVals = auditLog?.newValues as Record<string, unknown>;
      expect(newVals.overrideReason).toBe("Corporate client invoice to be settled by MTN Ghana");
    });
  });

  // TEST 3: Housekeeping Board & Role Gating
  describe("Housekeeping Status Flow & Inspection Role Gating", () => {
    it("allows housekeeping staff to mark dirty room as CLEAN and completes task", async () => {
      // Room 102 is currently DIRTY from checkout test
      const dirtyRoom = await prisma.room.findUnique({
        where: { id: testRoom102Id },
      });
      expect(dirtyRoom?.status).toBe(RoomStatus.DIRTY);

      // Housekeeping staff marks room CLEAN
      const updated = await updateHousekeepingStatus({
        roomId: testRoom102Id,
        status: RoomStatus.CLEAN,
        notes: "Thorough turnover completed, towels restocked",
        assignedToUserId: housekeepingUser.userId,
        user: housekeepingUser,
      });

      expect(updated.status).toBe(RoomStatus.CLEAN);

      // Verify task was marked COMPLETED
      const task = await prisma.housekeepingTask.findFirst({
        where: { roomId: testRoom102Id },
        orderBy: { updatedAt: "desc" },
      });
      expect(task?.status).toBe(HousekeepingTaskStatus.COMPLETED);

      // Verify AuditLog
      const audit = await prisma.auditLog.findFirst({
        where: {
          entityId: testRoom102Id,
          action: "ROOM_STATUS_UPDATE",
        },
        orderBy: { createdAt: "desc" },
      });
      expect(audit?.userId).toBe(housekeepingUser.userId);
    });

    it("rejects housekeeping role attempting to mark room as INSPECTED (supervisor only)", async () => {
      // Housekeeping cannot self-inspect
      await expect(
        updateHousekeepingStatus({
          roomId: testRoom102Id,
          status: RoomStatus.INSPECTED,
          user: housekeepingUser,
        })
      ).rejects.toThrow("Housekeeping staff cannot mark rooms as INSPECTED");
    });

    it("allows front desk or manager to mark room as INSPECTED", async () => {
      const inspectedRoom = await updateHousekeepingStatus({
        roomId: testRoom102Id,
        status: RoomStatus.INSPECTED,
        notes: "Supervisor inspection passed: 5-star standard verified",
        user: frontDeskUser,
      });

      expect(inspectedRoom.status).toBe(RoomStatus.INSPECTED);
    });
  });

  // TEST 4: Tape Chart Calendar & Exclusion Constraint
  describe("Tape Chart Calendar & Move/Extend Operations", () => {
    it("returns correct grid and rooms data for tape chart", async () => {
      const board = await getHousekeepingBoard();
      expect(board.summary).toBeDefined();

      const kpis = await getHotelDashboardKPIs();
      expect(kpis.kpis).toBeDefined();
      expect(kpis.kpis.totalRoomsCount).toBeGreaterThan(0);
      expect(kpis.kpis.roomsByStatus).toBeDefined();
    });

    it("surfaces clear room overlap conflict error when moving to an occupied date range", async () => {
      // Create confirmed reservation A for Room 101 on dates [futureCheckIn, futureCheckOut]
      const resA = await createFrontDeskReservation({
        roomTypeId: testRoomTypeId,
        roomId: testRoom101Id,
        checkIn: futureCheckIn,
        checkOut: futureCheckOut,
        adults: 1,
        guest: {
          name: "Kwaku Duplicate",
          phone: "+233241113333",
        },
        user: frontDeskUser,
      });
      expect(resA.id).toBeDefined();

      // Create reservation B on Room 102 for overlapping dates
      const resB = await createFrontDeskReservation({
        roomTypeId: testRoomTypeId,
        roomId: testRoom102Id,
        checkIn: futureCheckIn,
        checkOut: futureCheckOut,
        adults: 1,
        guest: {
          name: "Kofi Conflicted",
          phone: "+233241114444",
        },
        user: frontDeskUser,
      });

      const resRoomB = resB.rooms[0];

      // Attempting to move resRoomB into Room 101 for the same dates must trigger ROOM_OVERLAP_CONFLICT
      await expect(
        moveExtendReservationRoom({
          reservationRoomId: resRoomB.id,
          newRoomId: testRoom101Id, // same dates, but Room 101 is already booked!
          user: frontDeskUser,
        })
      ).rejects.toThrow("Room Conflict: This room already has an active overlapping reservation");
    });
  });
});
