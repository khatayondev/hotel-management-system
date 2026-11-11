import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { RoomStatus, ReservationStatus } from "@prisma/client";
import { getRoomTypeAvailability } from "@/lib/hotel/availability";
import { computeStayPricing } from "@/lib/hotel/pricing";
import { createHold, releaseHold, cleanupExpiredHolds } from "@/lib/hotel/holds";
import {
  createReservationFromHold,
  cancelReservation,
} from "@/lib/hotel/reservations";
import { reconcilePaymentTransaction } from "@/lib/payments/reconciliation";
import { formatDateOnly } from "@/lib/hotel/date-utils";
import { saveSettings } from "@/lib/settings";
import { AppError } from "@/lib/api-response";
import { ROLES } from "@/lib/rbac";
import crypto from "crypto";

describe("Hotel Booking Flow Integration Tests", () => {
  let testRoomTypeId: string;
  let testCustomerId: string;

  const baseDate = new Date();
  baseDate.setUTCDate(baseDate.getUTCDate() + 15);

  const addDays = (days: number): string => {
    const d = new Date(baseDate.getTime());
    d.setUTCDate(d.getUTCDate() + days);
    return formatDateOnly(d);
  };

  const checkIn = addDays(0);
  const checkOut = addDays(3); // 3-night stay
  const checkIn2 = addDays(10);
  const checkOut2 = addDays(12);

  beforeAll(async () => {
    const adminUser = {
      id: "admin-flow-test-user",
      role: ROLES.OWNER_ADMIN,
      name: "Hotel Admin",
    };

    // 1. Configure hotel settings: 48h free cancellation, 50% penalty, standard times, taxes
    await saveSettings(
      {
        hotelName: "Aura Royal Hotel & Suites",
        standardCheckInTime: "14:00",
        standardCheckOutTime: "11:00",
        freeCancelHoursBeforeCheckIn: 48,
        cancellationPenaltyPercent: 50,
        minimumNoticeHours: 1,
        maxDaysAhead: 90,
        taxes: [
          { id: "tax-vat", name: "VAT", percentage: 15.0, enabled: true },
          { id: "tax-nhil", name: "NHIL", percentage: 2.5, enabled: true },
        ],
      },
      adminUser
    );

    // 2. Create a dedicated test room type with 2 rooms (capacity = 2)
    const rt = await prisma.roomType.create({
      data: {
        name: `Royal Panorama Suite ${Date.now()}`,
        slug: `royal-panorama-${Date.now()}`,
        description: "Test Suite for E2E Booking Flow",
        maxAdults: 2,
        maxChildren: 1,
        bedConfiguration: "1 Super King Bed",
        basePricePesewas: 100000, // GH₵ 1,000.00 / night
        amenities: ["Ocean View", "Free WiFi", "Breakfast Included"],
        imageUrls: ["/images/suites/royal-panorama.jpg"],
        isActive: true,
        sortOrder: 1,
      },
    });
    testRoomTypeId = rt.id;

    await prisma.room.create({
      data: {
        number: `TEST-FLW-101-${Date.now()}`,
        floor: 1,
        roomTypeId: rt.id,
        status: RoomStatus.CLEAN,
      },
    });

    await prisma.room.create({
      data: {
        number: `TEST-FLW-102-${Date.now()}`,
        floor: 1,
        roomTypeId: rt.id,
        status: RoomStatus.CLEAN,
      },
    });

    // 3. Create a test customer/guest with unique phone
    const cust = await prisma.customer.create({
      data: {
        name: "Nana Kwame Appiah",
        phone: `+233${Math.floor(200000000 + Math.random() * 700000000)}`,
        email: `kwame.${Date.now()}@example.gh`,
        nationality: "Ghanaian",
      },
    });
    testCustomerId = cust.id;
  });

  afterAll(async () => {
    // Cleanup created test records
    await prisma.folioCharge.deleteMany({
      where: { folio: { reservation: { rooms: { some: { roomTypeId: testRoomTypeId } } } } },
    });
    await prisma.folio.deleteMany({
      where: { reservation: { rooms: { some: { roomTypeId: testRoomTypeId } } } },
    });
    await prisma.reservationRoom.deleteMany({
      where: { roomTypeId: testRoomTypeId },
    });
    await prisma.reservation.deleteMany({
      where: { guestId: testCustomerId },
    });
    await prisma.roomHold.deleteMany({
      where: { roomTypeId: testRoomTypeId },
    });
    await prisma.room.deleteMany({
      where: { roomTypeId: testRoomTypeId },
    });
    await prisma.roomType.deleteMany({
      where: { id: testRoomTypeId },
    });
    await prisma.customer.deleteMany({
      where: { id: testCustomerId },
    });
  });

  // TEST 1: Happy Path - Complete Booking Flow to Paystack Webhook & Manage Portal
  it("executes the full happy path booking flow from hold to Paystack reconciliation and balance payment", async () => {
    // Step 1: Check initial availability (2 rooms active)
    const availInit = await getRoomTypeAvailability({
      roomTypeId: testRoomTypeId,
      checkIn,
      checkOut,
    });
    expect(availInit).toHaveLength(1);
    expect(availInit[0].availableQuantity).toBe(2);
    expect(availInit[0].isAvailable).toBe(true);

    // Step 2: Compute stay pricing for 3 nights
    const pricing = await computeStayPricing({
      roomTypeId: testRoomTypeId,
      checkIn,
      checkOut,
      adults: 2,
      children: 0,
      extras: [],
    });
    expect(pricing.nights).toBe(3);
    expect(pricing.roomSubtotalPesewas).toBe(300000); // 3 * 100000
    // 17.5% total tax (15% VAT + 2.5% NHIL) -> 300000 * 0.175 = 52500
    expect(pricing.taxTotalPesewas).toBe(52500);
    expect(pricing.totalPesewas).toBe(352500);
    expect(pricing.depositRequiredPesewas).toBe(176250); // Default 50% deposit: Math.round(352500 * 0.5)

    // Step 3: Create a 10-minute RoomHold
    const hold = await createHold({
      roomTypeId: testRoomTypeId,
      checkIn,
      checkOut,
      quantity: 1,
    });
    expect(hold.token).toBeDefined();

    // Verify available quantity decreased from 2 to 1 during hold
    const availDuringHold = await getRoomTypeAvailability({
      roomTypeId: testRoomTypeId,
      checkIn,
      checkOut,
    });
    expect(availDuringHold[0].availableQuantity).toBe(1);

    // Step 4: Create reservation using hold
    const reservation = await createReservationFromHold({
      holdToken: hold.token,
      guestId: testCustomerId,
      notes: "Airport pickup requested",
      source: "WEBSITE",
      initialStatus: ReservationStatus.PENDING_PAYMENT,
    });

    expect(reservation.status).toBe(ReservationStatus.PENDING_PAYMENT);
    expect(reservation.totalPesewas).toBe(pricing.totalPesewas);
    expect(reservation.depositRequiredPesewas).toBe(pricing.depositRequiredPesewas);
    expect(reservation.amountPaidPesewas).toBe(0);

    // Step 5: Simulate Paystack session initialization and payment record
    const payRef = `PAY-HOTEL-TEST-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const payment = await prisma.payment.create({
      data: {
        bookingId: null,
        reference: payRef,
        amountPesewas: reservation.depositRequiredPesewas,
        currency: "GHS",
        status: "PENDING",
        channel: "MOBILE_MONEY",
      },
    });
    expect(payment.id).toBeDefined();

    // Step 6: Simulate Paystack charge.success webhook reconciliation
    const reconcileResult = await reconcilePaymentTransaction({
      reference: payRef,
      providerResult: {
        reference: payRef,
        status: "success",
        amountPesewas: reservation.depositRequiredPesewas,
        currency: "GHS",
        channel: "mobile_money",
        paidAt: new Date().toISOString(),
        metadata: {
          reservationId: reservation.id,
          reservationReference: reservation.reference,
          holdToken: hold.token,
        },
      },
      source: "WEBHOOK",
    });

    expect(reconcileResult.success).toBe(true);
    expect(reconcileResult.reservationStatus).toBe("CONFIRMED");

    // Verify reservation in DB is now CONFIRMED
    const confirmedRes = await prisma.reservation.findUnique({
      where: { id: reservation.id },
      include: { rooms: true, folios: { include: { charges: true } } },
    });
    expect(confirmedRes?.status).toBe(ReservationStatus.CONFIRMED);
    expect(confirmedRes?.amountPaidPesewas).toBe(reservation.depositRequiredPesewas);
    expect(confirmedRes?.rooms[0].status).toBe(ReservationStatus.CONFIRMED);

    // Verify payment folio charge was generated
    const charges = confirmedRes?.folios[0].charges || [];
    const paymentCharge = charges.find((c) => c.source === "PAYMENT");
    expect(paymentCharge).toBeDefined();
    expect(paymentCharge?.amountPesewas).toBe(reservation.depositRequiredPesewas);

    // Verify room hold was removed
    const activeHold = await prisma.roomHold.findUnique({
      where: { token: hold.token },
    });
    expect(activeHold).toBeNull();

    // Step 7: Settle remaining balance via balance payment reconciliation
    const balanceDue = confirmedRes!.totalPesewas - confirmedRes!.amountPaidPesewas;
    expect(balanceDue).toBe(352500 - 176250); // 176250

    const balRef = `BAL-HOTEL-TEST-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    await prisma.payment.create({
      data: {
        bookingId: null,
        reference: balRef,
        amountPesewas: balanceDue,
        currency: "GHS",
        status: "PENDING",
        channel: "CARD",
      },
    });

    const balReconcileResult = await reconcilePaymentTransaction({
      reference: balRef,
      providerResult: {
        reference: balRef,
        status: "success",
        amountPesewas: balanceDue,
        currency: "GHS",
        channel: "card",
        paidAt: new Date().toISOString(),
        metadata: {
          reservationId: reservation.id,
          reservationReference: reservation.reference,
        },
      },
      source: "WEBHOOK",
    });
    expect(balReconcileResult.success).toBe(true);

    const fullyPaidRes = await prisma.reservation.findUnique({
      where: { id: reservation.id },
    });
    expect(fullyPaidRes?.amountPaidPesewas).toBe(fullyPaidRes?.totalPesewas);
  });

  // TEST 2: Failure Path - Reject booking on unavailable dates (capacity fully booked)
  it("rejects hold and booking attempts when room capacity is exhausted for dates", async () => {
    // Currently, 1 room of testRoomTypeId is booked for [checkIn, checkOut].
    // Room B is still available. Let's create a hold on Room B to exhaust capacity.
    const holdB = await createHold({
      roomTypeId: testRoomTypeId,
      checkIn,
      checkOut,
      quantity: 1,
    });
    expect(holdB.token).toBeDefined();

    // Now all 2 rooms are occupied (1 confirmed reservation + 1 active hold).
    const avail = await getRoomTypeAvailability({
      roomTypeId: testRoomTypeId,
      checkIn,
      checkOut,
    });
    expect(avail[0].availableQuantity).toBe(0);
    expect(avail[0].isAvailable).toBe(false);

    // Attempting to hold another room for the same dates must fail with 409
    await expect(
      createHold({
        roomTypeId: testRoomTypeId,
        checkIn,
        checkOut,
        quantity: 1,
      })
    ).rejects.toThrow(AppError);

    // Release holdB to restore 1 available slot
    await releaseHold(holdB.token);

    const restoredAvail = await getRoomTypeAvailability({
      roomTypeId: testRoomTypeId,
      checkIn,
      checkOut,
    });
    expect(restoredAvail[0].availableQuantity).toBe(1);
    expect(restoredAvail[0].isAvailable).toBe(true);
  });

  // TEST 3: Expired holds are cleaned up and immediately restore room availability
  it("cleans up expired holds and frees up room capacity", async () => {
    // Create hold on the remaining slot
    const tempHold = await createHold({
      roomTypeId: testRoomTypeId,
      checkIn,
      checkOut,
      quantity: 1,
    });

    // Check that available quantity drops to 0
    const zeroAvail = await getRoomTypeAvailability({
      roomTypeId: testRoomTypeId,
      checkIn,
      checkOut,
    });
    expect(zeroAvail[0].availableQuantity).toBe(0);

    // Artificially expire the hold in DB
    await prisma.roomHold.update({
      where: { token: tempHold.token },
      data: {
        expiresAt: new Date(Date.now() - 60000), // 1 minute ago
      },
    });

    // Run hold cleanup job
    const expiredCount = await cleanupExpiredHolds();
    expect(expiredCount).toBeGreaterThanOrEqual(1);

    // Verify room availability is immediately restored
    const restoredAvail = await getRoomTypeAvailability({
      roomTypeId: testRoomTypeId,
      checkIn,
      checkOut,
    });
    expect(restoredAvail[0].availableQuantity).toBe(1);
    expect(restoredAvail[0].isAvailable).toBe(true);
  });

  // TEST 4: Manage Portal Cancellation & Refund Policy (Before vs After Cutoff)
  it("calculates 100% refund before 48h cutoff and applies 50% penalty after cutoff", async () => {
    // Case A: Stay far in advance (10 days ahead) -> Cancel before 48h cutoff
    const holdFuture = await createHold({
      roomTypeId: testRoomTypeId,
      checkIn: checkIn2,
      checkOut: checkOut2,
      quantity: 1,
    });
    const resFuture = await createReservationFromHold({
      holdToken: holdFuture.token,
      guestId: testCustomerId,
    });

    // Mark as CONFIRMED with deposit paid
    await prisma.reservation.update({
      where: { id: resFuture.id },
      data: {
        status: ReservationStatus.CONFIRMED,
        amountPaidPesewas: 100000,
      },
    });

    const cancelBeforeCutoff = await cancelReservation({
      reservationId: resFuture.id,
      reason: "Guest requested cancellation well in advance",
    });
    // 100% refund before cutoff
    expect(cancelBeforeCutoff.refundPesewas).toBe(100000);
    expect(cancelBeforeCutoff.penaltyPesewas).toBe(0);

    // Case B: Stay starting in 24 hours (under 48h cutoff)
    const in24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const in72Hours = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const urgentCheckIn = formatDateOnly(in24Hours);
    const urgentCheckOut = formatDateOnly(in72Hours);

    const holdUrgent = await createHold({
      roomTypeId: testRoomTypeId,
      checkIn: urgentCheckIn,
      checkOut: urgentCheckOut,
      quantity: 1,
    });
    const resUrgent = await createReservationFromHold({
      holdToken: holdUrgent.token,
      guestId: testCustomerId,
    });

    // Mark as CONFIRMED with 200000 deposit paid
    await prisma.reservation.update({
      where: { id: resUrgent.id },
      data: {
        status: ReservationStatus.CONFIRMED,
        amountPaidPesewas: 200000,
      },
    });

    const cancelAfterCutoff = await cancelReservation({
      reservationId: resUrgent.id,
      reason: "Emergency cancellation within 48h",
    });
    // 50% penalty applied according to settings (50% of 235,000 stay total = 117,500)
    expect(cancelAfterCutoff.penaltyPesewas).toBe(117500);
    // Refund is 200,000 paid - 117,500 penalty = 82,500
    expect(cancelAfterCutoff.refundPesewas).toBe(82500);
  });
});
