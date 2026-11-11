import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { ReservationStatus, RoomStatus, RoomExtraPricing } from "@prisma/client";
import { getRoomTypeAvailability } from "@/lib/hotel/availability";
import { computeStayPricing } from "@/lib/hotel/pricing";
import { createHold, releaseHold, cleanupExpiredHolds } from "@/lib/hotel/holds";
import {
  createReservationFromHold,
  assignRoom,
  moveReservation,
  cancelReservation,
} from "@/lib/hotel/reservations";
import { formatDateOnly, calculateStayNights } from "@/lib/hotel/date-utils";
import { saveSettings } from "@/lib/settings";
import { AppError } from "@/lib/api-response";

import { ROLES } from "@/lib/rbac";

describe("Hotel Availability, Pricing & Reservation Engine", () => {
  // Test entities
  let testRoomTypeId: string;
  let testSingleRoomTypeId: string;
  let testRoomAId: string;
  let testRoomBId: string;
  let testSingleRoom103Id: string;
  let testExtraBreakfastId: string;
  let testExtraAirportId: string;
  let testGuestId: string;

  // Relative dates safely inside the 60-day booking window
  const baseDate = new Date();
  baseDate.setUTCDate(baseDate.getUTCDate() + 10); // 10 days from now

  const addDays = (days: number): string => {
    const d = new Date(baseDate.getTime());
    d.setUTCDate(d.getUTCDate() + days);
    return formatDateOnly(d);
  };

  const day0 = addDays(0);
  const day2 = addDays(2);
  const day5 = addDays(5);
  const day7 = addDays(7);
  const day8 = addDays(8);
  const day10 = addDays(10);

  beforeAll(async () => {
    const adminUser = {
      id: "admin-test-user",
      role: ROLES.OWNER_ADMIN,
      name: "Hotel Admin",
    };

    // 1. Ensure settings have standard hotel parameters
    await saveSettings(
      {
        hotelName: "Aura Grand Luxury Hotel",
        standardCheckInTime: "14:00",
        standardCheckOutTime: "11:00",
        freeCancelHoursBeforeCheckIn: 48,
        cancellationPenaltyPercent: 50,
        minimumNoticeHours: 1,
        maxDaysAhead: 90,
        taxes: [
          { id: "tax-vat", name: "VAT", percentage: 15.0, enabled: true },
          { id: "tax-nhil", name: "NHIL", percentage: 2.5, enabled: true },
          { id: "tax-tourism", name: "Tourism Levy", percentage: 1.0, enabled: false }, // disabled
        ],
      },
      adminUser
    );

    // 2. Create primary test RoomType with 2 rooms
    const rt = await prisma.roomType.create({
      data: {
        name: `Executive Ocean Suite ${Date.now()}`,
        slug: `exec-ocean-suite-${Date.now()}`,
        description: "Panoramic ocean view executive suite",
        maxAdults: 2,
        maxChildren: 1,
        bedConfiguration: "1 King Bed",
        basePricePesewas: 100000, // GHS 1,000.00 / night
        amenities: ["Ocean View", "Balcony", "Free Breakfast", "Wi-Fi"],
        imageUrls: ["/images/ocean-suite.jpg"],
        isActive: true,
        sortOrder: 10,
        rooms: {
          create: [
            {
              number: `RM-EXEC-${Date.now()}-A`,
              floor: 5,
              status: RoomStatus.CLEAN,
              notes: "Main room A",
            },
            {
              number: `RM-EXEC-${Date.now()}-B`,
              floor: 5,
              status: RoomStatus.CLEAN,
              notes: "Main room B",
            },
          ],
        },
      },
      include: { rooms: true },
    });
    testRoomTypeId = rt.id;
    testRoomAId = rt.rooms[0].id;
    testRoomBId = rt.rooms[1].id;

    // 3. Create single-room RoomType specifically for race condition tests
    const singleRt = await prisma.roomType.create({
      data: {
        name: `Penthouse Presidential ${Date.now()}`,
        slug: `penthouse-presidential-${Date.now()}`,
        description: "Single exclusive penthouse suite",
        maxAdults: 4,
        maxChildren: 2,
        bedConfiguration: "2 King Beds",
        basePricePesewas: 300000, // GHS 3,000.00 / night
        amenities: ["Private Pool", "Butler Service"],
        imageUrls: ["/images/penthouse.jpg"],
        isActive: true,
        sortOrder: 11,
        rooms: {
          create: [
            {
              number: `RM-PH-${Date.now()}`,
              floor: 10,
              status: RoomStatus.CLEAN,
              notes: "Sole penthouse suite",
            },
          ],
        },
      },
      include: { rooms: true },
    });
    testSingleRoomTypeId = singleRt.id;
    testSingleRoom103Id = singleRt.rooms[0].id;

    // 4. Create RoomExtras for pricing tests
    const extraDailyBreakfast = await prisma.roomExtra.create({
      data: {
        name: `Champagne Breakfast ${Date.now()}`,
        pricePesewas: 15000, // GHS 150.00 per person
        pricing: RoomExtraPricing.PER_PERSON,
        isActive: true,
      },
    });
    testExtraBreakfastId = extraDailyBreakfast.id;

    const extraAirport = await prisma.roomExtra.create({
      data: {
        name: `VIP Airport Transfer ${Date.now()}`,
        pricePesewas: 35000, // GHS 350.00 per stay
        pricing: RoomExtraPricing.PER_STAY,
        isActive: true,
      },
    });
    testExtraAirportId = extraAirport.id;

    // 5. Create test customer
    const guest = await prisma.customer.create({
      data: {
        name: "Akosua Dede",
        phone: `+23324${Math.floor(1000000 + Math.random() * 9000000)}`,
        email: `dede-${Date.now()}@example.gh`,
        idType: "PASSPORT",
        idNumber: "GHA-789012345-6",
        nationality: "Ghanaian",
      },
    });
    testGuestId = guest.id;
  });

  afterAll(async () => {
    // Clean up created test entities
    if (testGuestId) {
      await prisma.folioCharge.deleteMany({
        where: { folio: { reservation: { guestId: testGuestId } } },
      });
      await prisma.folio.deleteMany({
        where: { reservation: { guestId: testGuestId } },
      });
      await prisma.reservationExtra.deleteMany({
        where: { reservation: { guestId: testGuestId } },
      });
      await prisma.reservationRoom.deleteMany({
        where: { reservation: { guestId: testGuestId } },
      });
      await prisma.reservation.deleteMany({
        where: { guestId: testGuestId },
      });
      await prisma.customer.deleteMany({
        where: { id: testGuestId },
      });
    }

    const roomTypeIds = [testRoomTypeId, testSingleRoomTypeId].filter(Boolean);
    if (roomTypeIds.length > 0) {
      await prisma.roomHold.deleteMany({
        where: { roomTypeId: { in: roomTypeIds } },
      });
      await prisma.rateOverride.deleteMany({
        where: { roomTypeId: { in: roomTypeIds } },
      });
    }

    const extraIds = [testExtraBreakfastId, testExtraAirportId].filter(Boolean);
    if (extraIds.length > 0) {
      await prisma.roomExtra.deleteMany({
        where: { id: { in: extraIds } },
      });
    }

    const roomIds = [testRoomAId, testRoomBId, testSingleRoom103Id].filter(Boolean);
    if (roomIds.length > 0) {
      await prisma.room.deleteMany({
        where: { id: { in: roomIds } },
      });
    }

    if (roomTypeIds.length > 0) {
      await prisma.roomType.deleteMany({
        where: { id: { in: roomTypeIds } },
      });
    }
  });

  // -------------------------------------------------------------
  // Test 1: Same-day turnover
  // -------------------------------------------------------------
  it("handles same-day turnover correctly: room is available on the departure day of an existing reservation", async () => {
    // For testSingleRoomTypeId (has exactly 1 room):
    // Guest A has reservation from day0 to day5
    const resA = await prisma.reservation.create({
      data: {
        reference: `RES-TURNOVER-A-${Date.now()}`,
        guestId: testGuestId,
        checkInDate: new Date(day0),
        checkOutDate: new Date(day5),
        status: ReservationStatus.CONFIRMED,
        subtotalPesewas: 1500000,
        totalPesewas: 1500000,
        rooms: {
          create: {
            roomTypeId: testSingleRoomTypeId,
            roomId: testSingleRoom103Id,
            checkIn: new Date(day0),
            checkOut: new Date(day5),
            status: ReservationStatus.CONFIRMED,
            nightlyRatesSnapshot: [],
          },
        },
      },
    });

    // Case 1: Overlapping stay [day2, day7) -> Should NOT be available (0 rooms)
    const availOverlap = await getRoomTypeAvailability({
      roomTypeId: testSingleRoomTypeId,
      checkIn: day2,
      checkOut: day7,
    });
    expect(availOverlap[0].availableQuantity).toBe(0);
    expect(availOverlap[0].isAvailable).toBe(false);

    // Case 2: Same-day turnover: Guest B checks in on day5 (when Guest A departs), checks out on day8
    // [day5, day8) -> Half-open interval [day0, day5) and [day5, day8) do NOT overlap
    const availTurnover = await getRoomTypeAvailability({
      roomTypeId: testSingleRoomTypeId,
      checkIn: day5,
      checkOut: day8,
    });
    expect(availTurnover[0].availableQuantity).toBe(1);
    expect(availTurnover[0].isAvailable).toBe(true);

    // Clean up resA
    await prisma.reservationRoom.deleteMany({ where: { reservationId: resA.id } });
    await prisma.reservation.delete({ where: { id: resA.id } });
  });

  // -------------------------------------------------------------
  // Test 2: Multi-night price with seasonal RateOverride
  // -------------------------------------------------------------
  it("calculates multi-night price with seasonal rate override and preserves nightly breakdown", async () => {
    // Base price is 100,000 pesewas (GHS 1,000)
    // Add seasonal override for day2 to day5 (3 nights: day2, day3, day4) at 175,000 pesewas
    const override = await prisma.rateOverride.create({
      data: {
        roomTypeId: testRoomTypeId,
        startDate: new Date(day2),
        endDate: new Date(day5),
        pricePesewas: 175000, // GHS 1,750 / night
        label: "Independence Holiday Surge",
      },
    });

    // 5-night stay from day0 to day5:
    // Night 0 (day0): base price 100,000
    // Night 1 (day1): base price 100,000
    // Night 2 (day2): override price 175,000
    // Night 3 (day3): override price 175,000
    // Night 4 (day4): override price 175,000
    // Total room price: 100,000 + 100,000 + 175,000 + 175,000 + 175,000 = 725,000 pesewas
    const pricing = await computeStayPricing({
      roomTypeId: testRoomTypeId,
      checkIn: day0,
      checkOut: day5,
      quantity: 1,
      adults: 2,
      children: 0,
    });

    expect(pricing.nights).toBe(5);
    expect(pricing.nightlyRates).toHaveLength(5);

    // Verify individual nightly rate assignments
    expect(pricing.nightlyRates[0].isOverridden).toBe(false);
    expect(pricing.nightlyRates[0].pricePesewas).toBe(100000);

    expect(pricing.nightlyRates[1].isOverridden).toBe(false);
    expect(pricing.nightlyRates[1].pricePesewas).toBe(100000);

    expect(pricing.nightlyRates[2].isOverridden).toBe(true);
    expect(pricing.nightlyRates[2].pricePesewas).toBe(175000);
    expect(pricing.nightlyRates[2].rateLabel).toBe("Independence Holiday Surge");

    expect(pricing.nightlyRates[3].isOverridden).toBe(true);
    expect(pricing.nightlyRates[3].pricePesewas).toBe(175000);

    expect(pricing.nightlyRates[4].isOverridden).toBe(true);
    expect(pricing.nightlyRates[4].pricePesewas).toBe(175000);

    expect(pricing.roomSubtotalPesewas).toBe(725000);

    // Clean up override
    await prisma.rateOverride.delete({ where: { id: override.id } });
  });

  // -------------------------------------------------------------
  // Test 3: Hold expiry
  // -------------------------------------------------------------
  it("restores room availability immediately when an expired hold is cleaned up", async () => {
    // 1. Initial availability on testSingleRoomTypeId should be 1
    const beforeAvail = await getRoomTypeAvailability({
      roomTypeId: testSingleRoomTypeId,
      checkIn: day2,
      checkOut: day5,
    });
    expect(beforeAvail[0].availableQuantity).toBe(1);

    // 2. Create hold and manually backdate expiresAt to simulate an expired hold
    const hold = await createHold({
      roomTypeId: testSingleRoomTypeId,
      checkIn: day2,
      checkOut: day5,
      quantity: 1,
    });

    await prisma.roomHold.update({
      where: { id: hold.id },
      data: { expiresAt: new Date(Date.now() - 60000) }, // expired 1 minute ago
    });

    // Since `expiresAt` is now in the past, availability check ignores it or cleanup removes it
    const deletedCount = await cleanupExpiredHolds();
    expect(deletedCount).toBeGreaterThanOrEqual(1);

    // Confirm hold record is gone
    const holdRecord = await prisma.roomHold.findUnique({ where: { id: hold.id } });
    expect(holdRecord).toBeNull();

    // Confirm availability is 1
    const afterAvail = await getRoomTypeAvailability({
      roomTypeId: testSingleRoomTypeId,
      checkIn: day2,
      checkOut: day5,
    });
    expect(afterAvail[0].availableQuantity).toBe(1);
    expect(afterAvail[0].isAvailable).toBe(true);
  });

  // -------------------------------------------------------------
  // Test 4: Two simultaneous hold attempts on the last available room
  // -------------------------------------------------------------
  it("allows only ONE of two concurrent hold attempts on the last available room to succeed", async () => {
    // testSingleRoomTypeId has exactly 1 operational room
    const avail = await getRoomTypeAvailability({
      roomTypeId: testSingleRoomTypeId,
      checkIn: day7,
      checkOut: day10,
    });
    expect(avail[0].availableQuantity).toBe(1);

    // Fire two simultaneous hold requests for the single room
    const [result1, result2] = await Promise.allSettled([
      createHold({
        roomTypeId: testSingleRoomTypeId,
        checkIn: day7,
        checkOut: day10,
        quantity: 1,
      }),
      createHold({
        roomTypeId: testSingleRoomTypeId,
        checkIn: day7,
        checkOut: day10,
        quantity: 1,
      }),
    ]);

    const fulfilled = [result1, result2].filter((r) => r.status === "fulfilled");
    const rejected = [result1, result2].filter((r) => r.status === "rejected");

    // Exactly one must succeed and one must fail
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // The successful one produced a hold token
    const successfulHold = (fulfilled[0] as PromiseFulfilledResult<{ token: string }>).value;
    expect(successfulHold.token).toMatch(/^hold_/);

    // The failing one received a 409 ROOMS_UNAVAILABLE AppError
    const failureReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(failureReason).toBeInstanceOf(AppError);
    expect((failureReason as AppError).statusCode).toBe(409);
    expect((failureReason as AppError).code).toBe("ROOMS_UNAVAILABLE");

    // Room is now held: availability is 0
    const availAfter = await getRoomTypeAvailability({
      roomTypeId: testSingleRoomTypeId,
      checkIn: day7,
      checkOut: day10,
    });
    expect(availAfter[0].availableQuantity).toBe(0);

    // Clean up successful hold
    await releaseHold(successfulHold.token);
  });

  // -------------------------------------------------------------
  // Test 5: Cancellation refund before and after cutoff
  // -------------------------------------------------------------
  it("calculates 100% refund before cutoff and penalty deduction after cutoff", async () => {
    // Settings: freeCancelHoursBeforeCheckIn = 48 hours, cancellationPenaltyPercent = 50%
    // Case A: Before cutoff (stay starts in 10 days, > 48h away)
    const holdA = await createHold({
      roomTypeId: testRoomTypeId,
      checkIn: day0, // 10 days away
      checkOut: day2,
      quantity: 1,
    });

    const reservationA = await createReservationFromHold({
      holdToken: holdA.token,
      guestId: testGuestId,
      adults: 2,
    });

    // Record an advance payment of 200,000 pesewas (GHS 2,000)
    await prisma.reservation.update({
      where: { id: reservationA.id },
      data: {
        amountPaidPesewas: 200000,
      },
    });

    const cancelBeforeCutoff = await cancelReservation({
      reservationId: reservationA.id,
      reason: "Guest travel plans rescheduled well in advance",
    });

    expect(cancelBeforeCutoff.isFreeCancellation).toBe(true);
    expect(cancelBeforeCutoff.penaltyPesewas).toBe(0);
    expect(cancelBeforeCutoff.refundPesewas).toBe(200000); // 100% refund of paid amount
    expect(cancelBeforeCutoff.status).toBe(ReservationStatus.CANCELLED);

    // Case B: After cutoff (stay starts tomorrow, < 48 hours away)
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setUTCDate(dayAfterTomorrow.getUTCDate() + 3);

    const checkInNear = formatDateOnly(tomorrow);
    const checkOutNear = formatDateOnly(dayAfterTomorrow);

    // Create reservation checking in tomorrow
    const reservationB = await prisma.reservation.create({
      data: {
        reference: `RES-LATE-CANCEL-${Date.now()}`,
        guestId: testGuestId,
        checkInDate: new Date(checkInNear),
        checkOutDate: new Date(checkOutNear),
        adults: 2,
        status: ReservationStatus.CONFIRMED,
        subtotalPesewas: 200000,
        taxPesewas: 35000,
        totalPesewas: 235000, // Total stay GHS 2,350
        amountPaidPesewas: 235000, // Fully paid upfront
        rooms: {
          create: {
            roomTypeId: testRoomTypeId,
            roomId: testRoomAId,
            checkIn: new Date(checkInNear),
            checkOut: new Date(checkOutNear),
            status: ReservationStatus.CONFIRMED,
            nightlyRatesSnapshot: [],
          },
        },
        folios: {
          create: {
            folioNumber: `FOL-${Date.now()}`,
            status: "OPEN",
            charges: {
              create: {
                description: "Room charge",
                source: "ROOM",
                amountPesewas: 235000,
              },
            },
          },
        },
      },
    });

    const cancelAfterCutoff = await cancelReservation({
      reservationId: reservationB.id,
      reason: "Guest cancelled on short notice",
    });

    // 50% penalty on totalPesewas (235,000 * 0.5 = 117,500)
    expect(cancelAfterCutoff.isFreeCancellation).toBe(false);
    expect(cancelAfterCutoff.penaltyPesewas).toBe(117500);
    expect(cancelAfterCutoff.refundPesewas).toBe(117500); // 235,000 - 117,500
    expect(cancelAfterCutoff.status).toBe(ReservationStatus.CANCELLED);

    // Verify child room is also marked CANCELLED
    const childRoom = await prisma.reservationRoom.findFirst({
      where: { reservationId: reservationB.id },
    });
    expect(childRoom?.status).toBe(ReservationStatus.CANCELLED);

    // Clean up
    await prisma.folioCharge.deleteMany({ where: { folio: { reservationId: reservationB.id } } });
    await prisma.folio.deleteMany({ where: { reservationId: reservationB.id } });
    await prisma.reservationRoom.deleteMany({ where: { reservationId: reservationB.id } });
    await prisma.reservation.delete({ where: { id: reservationB.id } });
  });

  // -------------------------------------------------------------
  // Test 6: Tax calculation from settings
  // -------------------------------------------------------------
  it("computes integer pesewas taxes from enabled settings and ignores disabled taxes", async () => {
    // Configured taxes:
    // VAT: 15.0% (enabled)
    // NHIL: 2.5% (enabled)
    // Tourism Levy: 1.0% (disabled)

    // Stay: 2 nights at 100,000 pesewas/night = 200,000 pesewas
    // Plus Extras:
    // 1 x Airport Transfer (PER_STAY) = 35,000 pesewas
    // 2 adults x 1 x Champagne Breakfast (PER_PERSON) = 15,000 * 2 = 30,000 pesewas
    // Room Subtotal: 200,000
    // Extras Subtotal: 65,000
    // Total Subtotal: 265,000 pesewas
    const pricing = await computeStayPricing({
      roomTypeId: testRoomTypeId,
      checkIn: day0,
      checkOut: day2,
      quantity: 1,
      adults: 2,
      children: 0,
      extras: [
        { extraId: testExtraAirportId, quantity: 1 },
        { extraId: testExtraBreakfastId, quantity: 1 },
      ],
    });

    expect(pricing.roomSubtotalPesewas).toBe(200000);
    expect(pricing.extrasSubtotalPesewas).toBe(65000);
    expect(pricing.subtotalPesewas).toBe(265000);

    // Taxes:
    // VAT: 265,000 * 15% = 39,750 pesewas
    // NHIL: 265,000 * 2.5% = 6,625 pesewas
    // Tourism Levy: disabled -> omitted
    expect(pricing.taxes).toHaveLength(2);

    const vat = pricing.taxes.find((t) => t.name === "VAT");
    const nhil = pricing.taxes.find((t) => t.name === "NHIL");
    const tourism = pricing.taxes.find((t) => t.name === "Tourism Levy");

    expect(vat).toBeDefined();
    expect(vat?.taxPesewas).toBe(39750);

    expect(nhil).toBeDefined();
    expect(nhil?.taxPesewas).toBe(6625);

    expect(tourism).toBeUndefined();

    // Tax Total: 39,750 + 6,625 = 46,375 pesewas
    expect(pricing.taxTotalPesewas).toBe(46375);

    // Grand Total: 265,000 + 46,375 = 311,375 pesewas
    expect(pricing.totalPesewas).toBe(311375);

    // Deposit: Default 50% for 2 nights = Math.round(311,375 * 0.5) = 155,688 pesewas
    expect(pricing.depositRequiredPesewas).toBe(155688);
  });

  // -------------------------------------------------------------
  // Test 7: Full Lifecycle: Hold -> Reservation -> Assign Room -> Move
  // -------------------------------------------------------------
  it("supports the complete reservation lifecycle: hold, confirm, room assignment, and moving dates", async () => {
    // 1. Create Hold
    const hold = await createHold({
      roomTypeId: testRoomTypeId,
      checkIn: day0,
      checkOut: day2,
      quantity: 1,
    });
    expect(hold.token).toBeTruthy();

    // 2. Convert hold to reservation
    const res = await createReservationFromHold({
      holdToken: hold.token,
      guestId: testGuestId,
      adults: 2,
    });
    expect(res.id).toBeTruthy();
    expect(res.status).toBe(ReservationStatus.CONFIRMED);
    expect(res.rooms).toHaveLength(1);
    expect(res.rooms[0].roomId).toBeNull(); // Unassigned initially
    expect(res.folios).toHaveLength(1); // Folio created

    // 3. Assign room (auto-pick free room)
    const assigned = await assignRoom({
      reservationRoomId: res.rooms[0].id,
    });
    expect(assigned.roomId).toBeTruthy();
    expect([testRoomAId, testRoomBId]).toContain(assigned.roomId);

    // 4. Move reservation to new dates [day7, day10)
    const moved = await moveReservation({
      reservationId: res.id,
      newCheckIn: day7,
      newCheckOut: day10,
    });
    expect(calculateStayNights(moved.checkInDate, moved.checkOutDate)).toBe(3);
    expect(formatDateOnly(moved.checkInDate)).toBe(day7);
    expect(formatDateOnly(moved.checkOutDate)).toBe(day10);

    // Clean up
    await cancelReservation({
      reservationId: res.id,
      reason: "Lifecycle test cleanup",
    });
  });
});
