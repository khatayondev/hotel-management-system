import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  RestaurantOrderType,
  RestaurantOrderStatus,
  RestaurantPaymentStatus,
  PrepStation,
} from "@prisma/client";
import {
  createRestaurantOrder,
  updateOrderStatus,
  getRestaurantOrders,
  getOrderByTrackingToken,
} from "@/lib/restaurant/orders";
import {
  requestRoomServiceOtp,
  verifyRoomServiceOtp,
  validateRoomServiceToken,
  _getOtpForTesting,
} from "@/lib/restaurant/room-service";
import { reconcilePaymentTransaction } from "@/lib/payments/reconciliation";
import { ROLES } from "@/lib/rbac";
import { saveSettings } from "@/lib/settings";

describe("Restaurant Public & Guest-Facing Ordering Engine", () => {
  let testCategoryId: string;
  let testItemId: string;
  let testTableId: string;
  let testQrToken: string;
  let testRoomId: string;
  let testGuestId: string;
  let testReservationId: string;

  const testGuestPhone = "+233245556677";
  const testRoomNumber = "404";

  const adminSession = {
    userId: "",
    role: ROLES.OWNER_ADMIN,
    name: "Admin User",
    email: "admin-rs-test@hotel.gh",
  };

  const staffSession = {
    userId: "",
    role: ROLES.FRONT_DESK,
    name: "Front Desk Staff",
    email: "frontdesk-rs-test@hotel.gh",
  };

  beforeAll(async () => {
    // 1. Ensure staff users
    const roles = await prisma.role.findMany();
    const roleMap = new Map(roles.map((r) => [r.name, r.id]));

    const admin = await prisma.user.upsert({
      where: { email: "admin-rs-test@hotel.gh" },
      update: {},
      create: {
        email: "admin-rs-test@hotel.gh",
        name: "Admin User",
        roleId: roleMap.get(ROLES.OWNER_ADMIN)!,
        passwordHash: "hash-not-used-in-unit-test",
      },
    });
    adminSession.userId = admin.id;

    const staff = await prisma.user.upsert({
      where: { email: "frontdesk-rs-test@hotel.gh" },
      update: {},
      create: {
        email: "frontdesk-rs-test@hotel.gh",
        name: "Front Desk Staff",
        roleId: roleMap.get(ROLES.FRONT_DESK)!,
        passwordHash: "hash-not-used-in-unit-test",
      },
    });
    staffSession.userId = staff.id;

    // 2. Configure restaurant opening hours: 07:00 to 22:00
    await saveSettings(
      {
        restaurantOpenTime: "07:00",
        restaurantCloseTime: "22:00",
      },
      { id: admin.id, role: ROLES.OWNER_ADMIN, name: "Admin User" }
    );

    // 3. Create Category & Menu Item
    const category = await prisma.menuCategory.create({
      data: {
        name: "Public Dining Specials",
        slug: `public-specials-${Date.now()}`,
        sortOrder: 1,
      },
    });
    testCategoryId = category.id;

    const item = await prisma.menuItem.create({
      data: {
        name: "Charcoal Grilled Red Snapper",
        description: "Served with golden fried plantains and spicy pepper salsa",
        pricePesewas: 15000, // GH₵ 150.00
        category: { connect: { id: testCategoryId } },
        prepStation: PrepStation.KITCHEN,
        isAvailable: true,
      },
    });
    testItemId = item.id;

    // 4. Create Dining Table with QR Token
    testQrToken = `qr-table-terrace-${Date.now()}`;
    const table = await prisma.restaurantTable.create({
      data: {
        label: `Terrace 12-${Date.now()}`,
        capacity: 4,
        qrToken: testQrToken,
        isActive: true,
      },
    });
    testTableId = table.id;

    // 5. Create Hotel Room & Checked-In Reservation
    const roomType = await prisma.roomType.create({
      data: {
        name: `Executive Deluxe ${Date.now()}`,
        slug: `exec-deluxe-${Date.now()}`,
        description: "Luxury hotel room with balcony",
        bedConfiguration: "1 King Bed",
        basePricePesewas: 120000,
        sortOrder: 1,
      },
    });

    const room = await prisma.room.create({
      data: {
        number: `${testRoomNumber}-${Date.now().toString().slice(-4)}`,
        floor: 4,
        roomTypeId: roomType.id,
        status: "OCCUPIED",
      },
    });
    testRoomId = room.id;

    const guest = await prisma.customer.upsert({
      where: { phone: testGuestPhone },
      update: { name: "Nana Kwame" },
      create: {
        name: "Nana Kwame",
        phone: testGuestPhone,
        email: "nanakwame@test.gh",
      },
    });
    testGuestId = guest.id;

    const checkIn = new Date("2026-11-10T14:00:00Z");
    const checkOut = new Date("2026-11-15T11:00:00Z");

    const reservation = await prisma.reservation.create({
      data: {
        reference: `HTL-RS-${Date.now().toString().slice(-6)}`,
        guestId: guest.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        adults: 2,
        children: 0,
        status: "CHECKED_IN",
        source: "FRONT_DESK",
        subtotalPesewas: 240000,
        totalPesewas: 240000,
        rooms: {
          create: {
            roomTypeId: roomType.id,
            roomId: room.id,
            checkIn,
            checkOut,
            status: "CONFIRMED",
            nightlyRatesSnapshot: [{ date: "2026-11-10", pricePesewas: 120000 }],
          },
        },
        folios: {
          create: {
            folioNumber: `FOL-RS-${Date.now()}`,
            status: "OPEN",
          },
        },
      },
    });
    testReservationId = reservation.id;
  });

  afterAll(async () => {
    // Cleanup created data
    if (testCategoryId) {
      await prisma.restaurantOrderItem.deleteMany({
        where: { item: { menuCategoryId: testCategoryId } },
      });
      await prisma.menuItem.deleteMany({
        where: { menuCategoryId: testCategoryId },
      });
      await prisma.menuCategory.deleteMany({
        where: { id: testCategoryId },
      });
    }

    if (testTableId) {
      await prisma.restaurantOrder.deleteMany({
        where: { tableId: testTableId },
      });
      await prisma.restaurantTable.deleteMany({
        where: { id: testTableId },
      });
    }

    if (testReservationId) {
      await prisma.restaurantOrder.deleteMany({
        where: { reservationId: testReservationId },
      });
      await prisma.folioCharge.deleteMany({
        where: { folio: { reservationId: testReservationId } },
      });
      await prisma.folio.deleteMany({
        where: { reservationId: testReservationId },
      });
      await prisma.reservationRoom.deleteMany({
        where: { reservationId: testReservationId },
      });
      await prisma.reservation.deleteMany({
        where: { id: testReservationId },
      });
    }

    if (testRoomId) {
      const room = await prisma.room.findUnique({ where: { id: testRoomId } });
      await prisma.room.deleteMany({ where: { id: testRoomId } });
      if (room?.roomTypeId) {
        await prisma.roomType.deleteMany({ where: { id: room.roomTypeId } });
      }
    }

    if (testGuestId) {
      await prisma.customer.deleteMany({ where: { id: testGuestId } });
    }

    await prisma.user.deleteMany({
      where: {
        email: { in: ["admin-rs-test@hotel.gh", "frontdesk-rs-test@hotel.gh"] },
      },
    });

    await prisma.setting.deleteMany({
      where: {
        key: { in: ["restaurant_open_time", "restaurant_close_time"] },
      },
    });
  });

  describe("1. Closed-Hours Order Rejection", () => {
    it("should reject order placement when restaurant is closed per opening hours setting", async () => {
      // Hours are 07:00 to 22:00 in Africa/Accra. Simulating 03:30 AM (closed).
      const middleOfNight = new Date("2026-11-11T03:30:00Z");

      await expect(
        createRestaurantOrder(
          {
            type: RestaurantOrderType.DINE_IN,
            tableId: testTableId,
            items: [{ itemId: testItemId, quantity: 1 }],
            now: middleOfNight,
          },
          adminSession
        )
      ).rejects.toThrowError(/RESTAURANT_CLOSED|currently closed/i);
    });

    it("should accept order placement when restaurant is open", async () => {
      // Simulating 13:00 (1:00 PM - open)
      const lunchTime = new Date("2026-11-11T13:00:00Z");

      const order = await createRestaurantOrder(
        {
          type: RestaurantOrderType.DINE_IN,
          tableId: testTableId,
          items: [{ itemId: testItemId, quantity: 1 }],
          now: lunchTime,
        },
        adminSession
      );

      expect(order).toBeDefined();
      expect(order.status).toBe(RestaurantOrderStatus.PLACED);
      expect(order.totalPesewas).toBe(15000);
      expect(order.trackingToken).toBeDefined();
    });
  });

  describe("2. Paid Pickup Orders & Payment-Before-Kitchen Rule", () => {
    it("should not show unpaid pickup orders to the kitchen, and only route them to kitchen after Paystack payment", async () => {
      // 1. Customer creates a PICKUP order
      const order = await createRestaurantOrder(
        {
          type: RestaurantOrderType.PICKUP,
          customerName: "Kweku Boateng",
          customerPhone: "+233208889900",
          items: [{ itemId: testItemId, quantity: 2 }],
          skipOpeningHoursCheck: true,
          paymentStatus: RestaurantPaymentStatus.PENDING,
        },
        adminSession
      );

      expect(order.status).toBe(RestaurantOrderStatus.PLACED);
      expect(order.paymentStatus).toBe(RestaurantPaymentStatus.PENDING);
      expect(order.totalPesewas).toBe(30000); // 15000 * 2

      // 2. Kitchen station query MUST NOT include this unpaid pickup order
      const kitchenOrdersBeforePayment = await getRestaurantOrders({
        station: PrepStation.KITCHEN,
        isKitchenView: true,
      });

      const foundUnpaidInKitchen = kitchenOrdersBeforePayment.some((o) => o.id === order.id);
      expect(foundUnpaidInKitchen).toBe(false);

      // 3. Customer initiates and completes Paystack payment
      const paystackReference = `PAY-RO-TEST-${Date.now()}`;
      await prisma.payment.create({
        data: {
          reference: paystackReference,
          amountPesewas: order.totalPesewas,
          currency: "GHS",
          status: "PENDING",
          channel: "mobile_money",
        },
      });

      await prisma.restaurantOrder.update({
        where: { id: order.id },
        data: { paystackReference },
      });

      // Reconcile payment via webhook/reconciliation engine
      const reconcileRes = await reconcilePaymentTransaction({
        reference: paystackReference,
        providerResult: {
          reference: paystackReference,
          status: "success",
          amountPesewas: order.totalPesewas,
          currency: "GHS",
          channel: "mobile_money",
        },
        source: "WEBHOOK",
      });

      expect(reconcileRes.success).toBe(true);

      // 4. Order is now PAID and automatically promoted to ACCEPTED
      const updatedOrder = await prisma.restaurantOrder.findUnique({
        where: { id: order.id },
      });

      expect(updatedOrder?.paymentStatus).toBe(RestaurantPaymentStatus.PAID);
      expect(updatedOrder?.status).toBe(RestaurantOrderStatus.ACCEPTED);

      // 5. Kitchen query NOW includes the paid order
      const kitchenOrdersAfterPayment = await getRestaurantOrders({
        station: PrepStation.KITCHEN,
        isKitchenView: true,
      });

      const foundPaidInKitchen = kitchenOrdersAfterPayment.some((o) => o.id === order.id);
      expect(foundPaidInKitchen).toBe(true);

      // 6. Kitchen progresses order to READY -> sends SMS
      const readyOrder = await updateOrderStatus(order.id, RestaurantOrderStatus.PREPARING, adminSession);
      expect(readyOrder.status).toBe(RestaurantOrderStatus.PREPARING);

      const completedReadyOrder = await updateOrderStatus(order.id, RestaurantOrderStatus.READY, adminSession);
      expect(completedReadyOrder.status).toBe(RestaurantOrderStatus.READY);
    });
  });

  describe("3. Room Service Verification (OTP) & Folio Posting", () => {
    it("should reject room service request for wrong phone or non-checked-in room", async () => {
      // Non-existent room
      await expect(
        requestRoomServiceOtp("999", testGuestPhone, "127.0.0.1")
      ).rejects.toThrowError(/ROOM_NOT_FOUND|does not exist/i);

      const room = await prisma.room.findUnique({ where: { id: testRoomId } });
      const roomNum = room?.number || testRoomNumber;

      // Phone mismatch
      await expect(
        requestRoomServiceOtp(roomNum, "+233200000000", "127.0.0.1")
      ).rejects.toThrowError(/PHONE_MISMATCH|does not match/i);
    });

    it("should verify guest with OTP and produce a valid verification session token", async () => {
      const room = await prisma.room.findUnique({ where: { id: testRoomId } });
      const roomNum = room?.number || testRoomNumber;

      // 1. Request OTP
      const otpReq = await requestRoomServiceOtp(roomNum, testGuestPhone, "127.0.0.1");
      expect(otpReq.success).toBe(true);

      // 2. Retrieve the active OTP generated in memory
      const code = _getOtpForTesting(roomNum, testGuestPhone);
      expect(code).toBeDefined();

      // 3. Verify OTP
      const verifyRes = verifyRoomServiceOtp(roomNum, testGuestPhone, code!);
      expect(verifyRes.verified).toBe(true);
      expect(verifyRes.verificationToken).toMatch(/^RS-/);
      expect(verifyRes.reservationId).toBe(testReservationId);

      // 4. Validate token
      const session = validateRoomServiceToken(verifyRes.verificationToken);
      expect(session.roomNumber).toBe(roomNum);
      expect(session.reservationId).toBe(testReservationId);
    });

    it("should reject invalid OTP", async () => {
      const room = await prisma.room.findUnique({ where: { id: testRoomId } });
      const roomNum = room?.number || testRoomNumber;

      await requestRoomServiceOtp(roomNum, testGuestPhone, "127.0.0.1");

      // Wrong code
      expect(() =>
        verifyRoomServiceOtp(roomNum, testGuestPhone, "000000")
      ).toThrowError(/INVALID_OTP|Invalid verification code/i);
    });

    it("should place room service order and post charge to guest folio", async () => {
      // Place room service order directly with reservation context
      const order = await createRestaurantOrder(
        {
          type: RestaurantOrderType.ROOM_SERVICE,
          reservationId: testReservationId,
          customerName: "Nana Kwame (Room Guest)",
          customerPhone: testGuestPhone,
          notes: "Extra spicy sauce please",
          items: [{ itemId: testItemId, quantity: 1 }],
          skipOpeningHoursCheck: true,
        },
        staffSession
      );

      expect(order).toBeDefined();
      expect(order.type).toBe(RestaurantOrderType.ROOM_SERVICE);
      expect(order.paymentStatus).toBe(RestaurantPaymentStatus.CHARGED_TO_ROOM);
      expect(order.totalPesewas).toBe(15000);

      // Verify that a FolioCharge was posted to the reservation's folio
      const folio = await prisma.folio.findFirst({
        where: { reservationId: testReservationId },
        include: { charges: true },
      });

      expect(folio).toBeDefined();
      const restaurantCharge = folio?.charges.find((c) => c.source === "RESTAURANT");
      expect(restaurantCharge).toBeDefined();
      expect(restaurantCharge?.amountPesewas).toBe(15000);
      expect(restaurantCharge?.description).toContain(order.orderNumber);
    });
  });

  describe("4. Dine-In via QR Token & Live Tracking", () => {
    it("should place dine-in order to table and allow live status tracking via trackingToken", async () => {
      // 1. Place Dine-In order
      const order = await createRestaurantOrder(
        {
          type: RestaurantOrderType.DINE_IN,
          tableId: testTableId,
          items: [{ itemId: testItemId, quantity: 1 }],
          skipOpeningHoursCheck: true,
          paymentStatus: RestaurantPaymentStatus.PENDING,
        },
        adminSession
      );

      expect(order.trackingToken).toBeDefined();
      expect(order.type).toBe(RestaurantOrderType.DINE_IN);
      expect(order.status).toBe(RestaurantOrderStatus.PLACED);

      // 2. Query tracking endpoint by trackingToken
      const tracked = await getOrderByTrackingToken(order.trackingToken);
      expect(tracked).toBeDefined();
      expect(tracked?.id).toBe(order.id);
      expect(tracked?.orderNumber).toBe(order.orderNumber);
      expect(tracked?.table?.id).toBe(testTableId);
      expect(tracked?.items).toHaveLength(1);
    });
  });
});
