import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { ReservationStatus, RoomStatus } from "@prisma/client";
import { redactSensitiveData, maskIdNumber } from "@/lib/logger";
import { encryptIdNumber, decryptIdNumber } from "@/lib/encryption";

describe("Hotel Domain Database Constraints & Concurrency Protection", () => {
  let testGuestId: string;
  let testGuest2Id: string;
  let testRoomTypeId: string;
  let testRoom101Id: string;
  let testRoom102Id: string;

  beforeAll(async () => {
    // 1. Create or fetch test customers/guests
    const guest1 = await prisma.customer.upsert({
      where: { phone: "+233249000101" },
      update: {
        idType: "PASSPORT",
        idNumber: "GHA-987654321-0",
        nationality: "Ghanaian",
        company: "Accra Tech Ltd",
        vehiclePlate: "GR-2026-26",
      },
      create: {
        name: "Kofi Mensah",
        phone: "+233249000101",
        email: "kofi.mensah@example.gh",
        idType: "PASSPORT",
        idNumber: "GHA-987654321-0",
        nationality: "Ghanaian",
        company: "Accra Tech Ltd",
        vehiclePlate: "GR-2026-26",
      },
    });
    testGuestId = guest1.id;

    const guest2 = await prisma.customer.upsert({
      where: { phone: "+233249000102" },
      update: {},
      create: {
        name: "Ama Serwaa",
        phone: "+233249000102",
        email: "ama.serwaa@example.gh",
        idType: "NATIONAL_ID",
        idNumber: "GHA-123456789-1",
        nationality: "Ghanaian",
      },
    });
    testGuest2Id = guest2.id;

    // 2. Create test room type
    const roomType = await prisma.roomType.upsert({
      where: { slug: "deluxe-king-suite" },
      update: {},
      create: {
        name: "Deluxe King Suite",
        slug: "deluxe-king-suite",
        description: "Luxury king bed suite with balcony and city view",
        maxAdults: 2,
        maxChildren: 1,
        bedConfiguration: "1 King Bed",
        basePricePesewas: 150000, // GHS 1,500.00
        amenities: ["WiFi", "Air Conditioning", "Balcony", "Mini Bar", "Breakfast Included"],
        imageUrls: ["/images/rooms/deluxe-king-1.jpg"],
        isActive: true,
        sortOrder: 1,
      },
    });
    testRoomTypeId = roomType.id;

    // 3. Create test physical rooms (Room 101 & Room 102)
    const room101 = await prisma.room.upsert({
      where: { number: "101" },
      update: { roomTypeId: testRoomTypeId, status: RoomStatus.CLEAN },
      create: {
        number: "101",
        floor: 1,
        roomTypeId: testRoomTypeId,
        status: RoomStatus.CLEAN,
        notes: "Facing courtyard garden",
      },
    });
    testRoom101Id = room101.id;

    const room102 = await prisma.room.upsert({
      where: { number: "102" },
      update: { roomTypeId: testRoomTypeId, status: RoomStatus.CLEAN },
      create: {
        number: "102",
        floor: 1,
        roomTypeId: testRoomTypeId,
        status: RoomStatus.CLEAN,
        notes: "Corner quiet room",
      },
    });
    testRoom102Id = room102.id;
  });

  afterAll(async () => {
    // Clean up created reservations and room assignments
    await prisma.reservationRoom.deleteMany({
      where: { roomId: { in: [testRoom101Id, testRoom102Id] } },
    });
    await prisma.reservation.deleteMany({
      where: { guestId: { in: [testGuestId, testGuest2Id] } },
    });
    await prisma.room.deleteMany({
      where: { id: { in: [testRoom101Id, testRoom102Id] } },
    });
    await prisma.roomType.deleteMany({
      where: { id: testRoomTypeId },
    });
    await prisma.customer.deleteMany({
      where: { id: { in: [testGuestId, testGuest2Id] } },
    });
  });

  // -------------------------------------------------------------
  // Test 1: Stays ending on the 5th and starting on the 5th do NOT conflict
  // -------------------------------------------------------------
  it("proves a stay ending on the 5th and one starting on the 5th do NOT conflict (half-open daterange boundary)", async () => {
    const checkInStay1 = new Date("2026-12-01");
    const checkOutStay1 = new Date("2026-12-05");

    const checkInStay2 = new Date("2026-12-05");
    const checkOutStay2 = new Date("2026-12-10");

    // Reservation 1: Dec 1 to Dec 5, assigned to Room 101
    const res1 = await prisma.reservation.create({
      data: {
        reference: `RES-TEST-ADJ-1-${Date.now()}`,
        guestId: testGuestId,
        checkInDate: checkInStay1,
        checkOutDate: checkOutStay1,
        adults: 2,
        status: ReservationStatus.CONFIRMED,
        subtotalPesewas: 600000,
        taxPesewas: 0,
        totalPesewas: 600000,
        depositRequiredPesewas: 300000,
        amountPaidPesewas: 300000,
        rooms: {
          create: {
            roomTypeId: testRoomTypeId,
            roomId: testRoom101Id,
            checkIn: checkInStay1,
            checkOut: checkOutStay1,
            status: ReservationStatus.CONFIRMED,
            nightlyRatesSnapshot: [{ date: "2026-12-01", pricePesewas: 150000 }],
          },
        },
      },
      include: { rooms: true },
    });

    expect(res1.id).toBeDefined();
    expect(res1.rooms.length).toBe(1);
    expect(res1.rooms[0].roomId).toBe(testRoom101Id);

    // Reservation 2: Dec 5 to Dec 10, assigned to SAME Room 101
    // The previous guest departs on Dec 5 (morning check-out), and the new guest arrives on Dec 5 (afternoon check-in).
    const res2 = await prisma.reservation.create({
      data: {
        reference: `RES-TEST-ADJ-2-${Date.now()}`,
        guestId: testGuest2Id,
        checkInDate: checkInStay2,
        checkOutDate: checkOutStay2,
        adults: 1,
        status: ReservationStatus.CONFIRMED,
        subtotalPesewas: 750000,
        taxPesewas: 0,
        totalPesewas: 750000,
        depositRequiredPesewas: 375000,
        amountPaidPesewas: 375000,
        rooms: {
          create: {
            roomTypeId: testRoomTypeId,
            roomId: testRoom101Id,
            checkIn: checkInStay2,
            checkOut: checkOutStay2,
            status: ReservationStatus.CONFIRMED,
            nightlyRatesSnapshot: [{ date: "2026-12-05", pricePesewas: 150000 }],
          },
        },
      },
      include: { rooms: true },
    });

    expect(res2.id).toBeDefined();
    expect(res2.rooms.length).toBe(1);
    expect(res2.rooms[0].roomId).toBe(testRoom101Id);

    // Clean up adjacent test reservations
    await prisma.reservation.deleteMany({
      where: { id: { in: [res1.id, res2.id] } },
    });
  });

  // -------------------------------------------------------------
  // Test 2: Overlapping assignments to the same room are rejected by the database
  // -------------------------------------------------------------
  it("proves overlapping assignments to the same room are rejected by PostgreSQL exclusion constraint (23P01)", async () => {
    const existingCheckIn = new Date("2026-12-15");
    const existingCheckOut = new Date("2026-12-20");

    // Existing active reservation in Room 101 for Dec 15 to Dec 20
    const primaryRes = await prisma.reservation.create({
      data: {
        reference: `RES-OVERLAP-BASE-${Date.now()}`,
        guestId: testGuestId,
        checkInDate: existingCheckIn,
        checkOutDate: existingCheckOut,
        status: ReservationStatus.CONFIRMED,
        subtotalPesewas: 750000,
        totalPesewas: 750000,
        rooms: {
          create: {
            roomTypeId: testRoomTypeId,
            roomId: testRoom101Id,
            checkIn: existingCheckIn,
            checkOut: existingCheckOut,
            status: ReservationStatus.CONFIRMED,
            nightlyRatesSnapshot: [],
          },
        },
      },
    });

    // Attempt 1: Overlap inside (Dec 16 to Dec 18) in same Room 101 -> MUST FAIL with 23P01
    const conflictCheckIn = new Date("2026-12-16");
    const conflictCheckOut = new Date("2026-12-18");

    let caughtError: unknown;
    try {
      await prisma.reservation.create({
        data: {
          reference: `RES-OVERLAP-FAIL-${Date.now()}`,
          guestId: testGuest2Id,
          checkInDate: conflictCheckIn,
          checkOutDate: conflictCheckOut,
          status: ReservationStatus.CONFIRMED,
          subtotalPesewas: 300000,
          totalPesewas: 300000,
          rooms: {
            create: {
              roomTypeId: testRoomTypeId,
              roomId: testRoom101Id, // Same room!
              checkIn: conflictCheckIn,
              checkOut: conflictCheckOut,
              status: ReservationStatus.CONFIRMED,
              nightlyRatesSnapshot: [],
            },
          },
        },
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeDefined();
    const errorString = String(caughtError);
    // Prisma wraps Postgres exclusion violation 23P01
    expect(
      errorString.includes("no_overlapping_assigned_room_reservations") ||
        errorString.includes("23P01") ||
        errorString.includes("exclusion constraint")
    ).toBe(true);

    // Clean up primary reservation
    await prisma.reservation.delete({ where: { id: primaryRes.id } });
  });

  // -------------------------------------------------------------
  // Test 3: Stays on different rooms on the same dates do NOT conflict
  // -------------------------------------------------------------
  it("allows simultaneous reservations on the same dates when assigned to different rooms", async () => {
    const checkIn = new Date("2026-12-22");
    const checkOut = new Date("2026-12-25");

    const resRoom101 = await prisma.reservation.create({
      data: {
        reference: `RES-DIFF-101-${Date.now()}`,
        guestId: testGuestId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        status: ReservationStatus.CONFIRMED,
        subtotalPesewas: 450000,
        totalPesewas: 450000,
        rooms: {
          create: {
            roomTypeId: testRoomTypeId,
            roomId: testRoom101Id,
            checkIn,
            checkOut,
            status: ReservationStatus.CONFIRMED,
            nightlyRatesSnapshot: [],
          },
        },
      },
    });

    const resRoom102 = await prisma.reservation.create({
      data: {
        reference: `RES-DIFF-102-${Date.now()}`,
        guestId: testGuest2Id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        status: ReservationStatus.CONFIRMED,
        subtotalPesewas: 450000,
        totalPesewas: 450000,
        rooms: {
          create: {
            roomTypeId: testRoomTypeId,
            roomId: testRoom102Id, // Different room!
            checkIn,
            checkOut,
            status: ReservationStatus.CONFIRMED,
            nightlyRatesSnapshot: [],
          },
        },
      },
    });

    expect(resRoom101.id).toBeDefined();
    expect(resRoom102.id).toBeDefined();

    await prisma.reservation.deleteMany({
      where: { id: { in: [resRoom101.id, resRoom102.id] } },
    });
  });

  // -------------------------------------------------------------
  // Test 4: Cancelled or Checked-out reservations release room for new bookings
  // -------------------------------------------------------------
  it("allows booking the same room on identical dates if prior reservation was CANCELLED", async () => {
    const checkIn = new Date("2026-12-27");
    const checkOut = new Date("2026-12-30");

    // Cancelled reservation
    const cancelledRes = await prisma.reservation.create({
      data: {
        reference: `RES-CANCELLED-${Date.now()}`,
        guestId: testGuestId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        status: ReservationStatus.CANCELLED,
        subtotalPesewas: 450000,
        totalPesewas: 450000,
        rooms: {
          create: {
            roomTypeId: testRoomTypeId,
            roomId: testRoom101Id,
            checkIn,
            checkOut,
            status: ReservationStatus.CANCELLED,
            nightlyRatesSnapshot: [],
          },
        },
      },
    });

    // New active reservation on same room 101 and same dates -> MUST SUCCEED
    const activeRes = await prisma.reservation.create({
      data: {
        reference: `RES-NEW-ACTIVE-${Date.now()}`,
        guestId: testGuest2Id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        status: ReservationStatus.CONFIRMED,
        subtotalPesewas: 450000,
        totalPesewas: 450000,
        rooms: {
          create: {
            roomTypeId: testRoomTypeId,
            roomId: testRoom101Id,
            checkIn,
            checkOut,
            status: ReservationStatus.CONFIRMED,
            nightlyRatesSnapshot: [],
          },
        },
      },
    });

    expect(activeRes.id).toBeDefined();

    await prisma.reservation.deleteMany({
      where: { id: { in: [cancelledRes.id, activeRes.id] } },
    });
  });

  // -------------------------------------------------------------
  // Test 5: Check constraint enforces check_out > check_in
  // -------------------------------------------------------------
  it("enforces check constraint rejecting checkOut <= checkIn", async () => {
    const checkIn = new Date("2027-01-10");
    const sameDayCheckOut = new Date("2027-01-10"); // Same day!

    let caughtError: unknown;
    try {
      await prisma.reservation.create({
        data: {
          reference: `RES-SAMEDAY-FAIL-${Date.now()}`,
          guestId: testGuestId,
          checkInDate: checkIn,
          checkOutDate: sameDayCheckOut,
          status: ReservationStatus.PENDING_PAYMENT,
          subtotalPesewas: 150000,
          totalPesewas: 150000,
          rooms: {
            create: {
              roomTypeId: testRoomTypeId,
              roomId: testRoom101Id,
              checkIn,
              checkOut: sameDayCheckOut,
              status: ReservationStatus.PENDING_PAYMENT,
              nightlyRatesSnapshot: [],
            },
          },
        },
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeDefined();
    const errorString = String(caughtError);
    expect(
      errorString.includes("check_reservation_room_dates") ||
        errorString.includes("check_reservation_dates") ||
        errorString.includes("23514") ||
        errorString.includes("check constraint")
    ).toBe(true);
  });

  // -------------------------------------------------------------
  // Test 6: ID number redaction in logs and encryption helpers
  // -------------------------------------------------------------
  it("redacts ID numbers and sensitive guest identity from logs and supports encryption", () => {
    const rawIdNumber = "GHA-712345678-9";
    const masked = maskIdNumber(rawIdNumber);
    expect(masked).toBe("GHA-****-9");

    // Verify redaction in structured payload logs
    const logPayload = {
      action: "GUEST_CHECK_IN",
      guestName: "Kofi Mensah",
      idType: "PASSPORT",
      idNumber: rawIdNumber,
      id_number: rawIdNumber,
      nested: {
        passport: rawIdNumber,
      },
    };

    const sanitized = redactSensitiveData(logPayload) as Record<string, unknown>;
    expect(sanitized.idNumber).toBe("[REDACTED]");
    expect(sanitized.id_number).toBe("[REDACTED]");
    expect((sanitized.nested as Record<string, unknown>).passport).toBe("[REDACTED]");
    expect(sanitized.idType).toBe("PASSPORT"); // Non-secret metadata preserved

    // Verify encryption and decryption helpers
    const encrypted = encryptIdNumber(rawIdNumber);
    expect(encrypted).not.toBe(rawIdNumber);
    expect(encrypted).toContain(":");

    const decrypted = decryptIdNumber(encrypted);
    expect(decrypted).toBe(rawIdNumber);
  });
});

