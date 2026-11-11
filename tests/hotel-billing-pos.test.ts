import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  RoomStatus,
  ReservationStatus,
  FolioStatus,
  FolioChargeSource,
} from "@prisma/client";
import {
  getInHouseGuests,
  getFolioDetails,
  chargeToRoomFromPos,
  applyFolioAdjustment,
  settleHotelCheckoutWithSplitPayments,
  voidFolioCharge,
  voidHotelReceipt,
} from "@/lib/hotel/billing";
import { checkInReservation, createFrontDeskReservation } from "@/lib/hotel/operations";
import { processPosCheckout } from "@/lib/pos/pos-service";
import { ROLES, type PermissionContextUser } from "@/lib/rbac";

describe("Hotel Billing, Folio Management & POS Room Charge", () => {
  let testRoomTypeId: string;
  let testRoomId: string;
  let testGuestId: string;
  let testReservationId: string;
  let testFolioId: string;

  let ownerUser: PermissionContextUser;
  let managerUser: PermissionContextUser;
  let frontDeskUser: PermissionContextUser;
  let waiterUser: PermissionContextUser;
  let housekeepingUser: PermissionContextUser;

  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  beforeAll(async () => {
    // 1. Ensure Roles exist and upsert test users
    const roles = await prisma.role.findMany();
    const roleMap = new Map(roles.map((r) => [r.name, r.id]));

    const ownerDbUser = await prisma.user.upsert({
      where: { email: "owner-billing-test@hotel.gh" },
      update: { roleId: roleMap.get(ROLES.OWNER_ADMIN)! },
      create: {
        email: "owner-billing-test@hotel.gh",
        name: "Test Owner Billing",
        passwordHash: "hash",
        roleId: roleMap.get(ROLES.OWNER_ADMIN)!,
      },
    });

    const managerDbUser = await prisma.user.upsert({
      where: { email: "manager-billing-test@hotel.gh" },
      update: { roleId: roleMap.get(ROLES.MANAGER)! },
      create: {
        email: "manager-billing-test@hotel.gh",
        name: "Test Manager Billing",
        passwordHash: "hash",
        roleId: roleMap.get(ROLES.MANAGER)!,
      },
    });

    const frontDeskDbUser = await prisma.user.upsert({
      where: { email: "frontdesk-billing-test@hotel.gh" },
      update: { roleId: roleMap.get(ROLES.FRONT_DESK)! },
      create: {
        email: "frontdesk-billing-test@hotel.gh",
        name: "Test FrontDesk Billing",
        passwordHash: "hash",
        roleId: roleMap.get(ROLES.FRONT_DESK)!,
      },
    });

    const waiterDbUser = await prisma.user.upsert({
      where: { email: "waiter-billing-test@hotel.gh" },
      update: { roleId: roleMap.get(ROLES.WAITER)! },
      create: {
        email: "waiter-billing-test@hotel.gh",
        name: "Test Waiter Billing",
        passwordHash: "hash",
        roleId: roleMap.get(ROLES.WAITER)!,
      },
    });

    const hkDbUser = await prisma.user.upsert({
      where: { email: "hk-billing-test@hotel.gh" },
      update: { roleId: roleMap.get(ROLES.HOUSEKEEPING)! },
      create: {
        email: "hk-billing-test@hotel.gh",
        name: "Test HK Billing",
        passwordHash: "hash",
        roleId: roleMap.get(ROLES.HOUSEKEEPING)!,
      },
    });

    ownerUser = { userId: ownerDbUser.id, role: ROLES.OWNER_ADMIN };
    managerUser = { userId: managerDbUser.id, role: ROLES.MANAGER };
    frontDeskUser = { userId: frontDeskDbUser.id, role: ROLES.FRONT_DESK };
    waiterUser = { userId: waiterDbUser.id, role: ROLES.WAITER };
    housekeepingUser = { userId: hkDbUser.id, role: ROLES.HOUSEKEEPING };

    // 2. Create Room Type & Room
    const rt = await prisma.roomType.create({
      data: {
        name: `Executive Suite Billing ${Date.now()}`,
        slug: `exec-suite-billing-${Date.now()}`,
        description: "Luxury executive suite for billing test",
        maxAdults: 2,
        maxChildren: 1,
        bedConfiguration: "1 King Bed",
        basePricePesewas: 100000, // GH₵ 1,000.00 / night
        isActive: true,
      },
    });
    testRoomTypeId = rt.id;

    const r = await prisma.room.create({
      data: {
        number: `BILL-${Math.floor(100 + Math.random() * 899)}`,
        floor: 3,
        roomTypeId: rt.id,
        status: RoomStatus.CLEAN,
      },
    });
    testRoomId = r.id;

    // 3. Create Guest & Checked-in Reservation with Folio
    const guest = await prisma.customer.create({
      data: {
        name: "Kofi Dining Guest",
        phone: `+233${Math.floor(200000000 + Math.random() * 700000000)}`,
        email: `kofi.billing.${Date.now()}@example.gh`,
        nationality: "Ghanaian",
      },
    });
    testGuestId = guest.id;

    const res = await createFrontDeskReservation({
      roomTypeId: testRoomTypeId,
      roomId: testRoomId,
      checkIn: todayStr,
      checkOut: tomorrowStr,
      adults: 2,
      guest: {
        name: guest.name,
        phone: guest.phone,
      },
      depositPesewas: 50000, // GH₵ 500.00 deposit
      user: frontDeskUser,
    });
    testReservationId = res.id;

    // Check-in guest
    await checkInReservation({
      reservationId: res.id,
      roomId: testRoomId,
      guestDetails: {
        idType: "Ghana Card",
        idNumber: "GHA-887766554-1",
        nationality: "Ghanaian",
      },
      earlyCheckInApproved: true,
      user: frontDeskUser,
    });

    const folio = await prisma.folio.findFirst({
      where: { reservationId: res.id },
    });
    testFolioId = folio!.id;
  });

  afterAll(async () => {
    // Cleanup test records
    const resRooms = await prisma.reservationRoom.findMany({
      where: { roomTypeId: testRoomTypeId },
      select: { reservationId: true },
    });
    const resIds = Array.from(new Set(resRooms.map((r) => r.reservationId)));

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
      where: { roomId: testRoomId },
    });
    await prisma.room.deleteMany({
      where: { roomTypeId: testRoomTypeId },
    });
    await prisma.roomType.deleteMany({
      where: { id: testRoomTypeId },
    });
    await prisma.customer.deleteMany({
      where: { id: testGuestId },
    });
  });

  // TEST 1: In-House Guest Lookup & POS "Charge to Room"
  describe("In-House Guest Lookup & POS Charge to Room", () => {
    it("searches and finds currently in-house guests by room number or name", async () => {
      const inHouse = await getInHouseGuests("Kofi Dining");
      expect(inHouse.length).toBeGreaterThan(0);
      const guest = inHouse.find((g) => g.reservationId === testReservationId);
      expect(guest).toBeDefined();
      expect(guest?.guestName).toBe("Kofi Dining Guest");
      expect(guest?.folioId).toBe(testFolioId);
      expect(guest?.balancePesewas).toBeGreaterThan(0);
    });

    it("allows a WAITER to post a restaurant order to an in-house room folio and writes an audit log", async () => {
      const restaurantChargePesewas = 18500; // GH₵ 185.00 (Grilled Tilapia + Jollof)

      const charge = await chargeToRoomFromPos({
        folioId: testFolioId,
        description: "Restaurant Order: Grilled Tilapia & Jollof Rice",
        source: "RESTAURANT",
        amountPesewas: restaurantChargePesewas,
        referenceId: "REST-ORDER-101",
        items: [
          { name: "Grilled Tilapia", pricePesewas: 12000, quantity: 1 },
          { name: "Jollof Rice", pricePesewas: 6500, quantity: 1 },
        ],
        user: waiterUser,
      });

      expect(charge.id).toBeDefined();
      expect(charge.source).toBe(FolioChargeSource.RESTAURANT);
      expect(charge.amountPesewas).toBe(restaurantChargePesewas);

      // Verify folio running balance updated
      const folio = await getFolioDetails({ folioId: testFolioId }, frontDeskUser);
      expect(folio.financials.restaurantChargesPesewas).toBe(restaurantChargePesewas);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: "POS_CHARGE_TO_ROOM",
          entityId: charge.id,
        },
      });
      expect(audit).toBeDefined();
      expect(audit?.userId).toBe(waiterUser.userId);
    });

    it("rejects a WAITER attempting to post non-restaurant charges (EXTRA)", async () => {
      await expect(
        chargeToRoomFromPos({
          folioId: testFolioId,
          description: "Laundry Service Charge",
          source: "EXTRA", // Waiter cannot charge hotel extras
          amountPesewas: 5000,
          user: waiterUser,
        })
      ).rejects.toThrow("Waiters are only authorized to post restaurant charges");
    });

    it("rejects unauthorized roles (HOUSEKEEPING) from charging to a room folio", async () => {
      await expect(
        chargeToRoomFromPos({
          folioId: testFolioId,
          description: "Room Minibar restock",
          source: "EXTRA",
          amountPesewas: 3500,
          user: housekeepingUser,
        })
      ).rejects.toThrow("Role HOUSEKEEPING is not authorized to charge to room folios");
    });
  });

  // TEST 2: Folio Adjustments & Role-Based Discount Ceilings
  describe("Folio Adjustments & Role-Based Discount Ceilings", () => {
    it("rejects any folio adjustment if the reason is missing", async () => {
      await expect(
        applyFolioAdjustment({
          folioId: testFolioId,
          amountPesewas: 2000,
          reason: "", // missing reason!
          user: frontDeskUser,
        })
      ).rejects.toThrow("A reason is strictly required");
    });

    it("enforces Front Desk 5% ceiling: rejects 10% discount by Front Desk", async () => {
      const folio = await getFolioDetails({ folioId: testFolioId }, frontDeskUser);
      const gross = folio.financials.totalGrossChargesPesewas;
      const tenPercent = Math.round(gross * 0.1);

      await expect(
        applyFolioAdjustment({
          folioId: testFolioId,
          amountPesewas: tenPercent,
          reason: "Front desk courtesy discount",
          user: frontDeskUser,
        })
      ).rejects.toThrow("exceeds your role's allowed maximum of 5%");
    });

    it("allows Front Desk to apply a valid discount within 5% ceiling and reduces folio balance", async () => {
      const folioBefore = await getFolioDetails({ folioId: testFolioId }, frontDeskUser);
      const gross = folioBefore.financials.totalGrossChargesPesewas;
      const fourPercent = Math.round(gross * 0.04);

      const adj = await applyFolioAdjustment({
        folioId: testFolioId,
        amountPesewas: fourPercent,
        reason: "Front desk minor inconvenience rebate",
        user: frontDeskUser,
      });

      expect(adj.id).toBeDefined();
      expect(adj.source).toBe(FolioChargeSource.ADJUSTMENT);
      expect(adj.amountPesewas).toBe(-fourPercent); // Stored as negative to reduce charges

      const folioAfter = await getFolioDetails({ folioId: testFolioId }, frontDeskUser);
      expect(folioAfter.financials.adjustmentPesewas).toBe(-fourPercent);
      expect(folioAfter.financials.runningBalancePesewas).toBe(
        folioBefore.financials.runningBalancePesewas - fourPercent
      );
    });

    it("enforces Manager 20% ceiling: rejects 25% discount by Manager, but allows 15%", async () => {
      const folio = await getFolioDetails({ folioId: testFolioId }, managerUser);
      const gross = folio.financials.totalGrossChargesPesewas;
      const twentyFivePercent = Math.round(gross * 0.25);

      await expect(
        applyFolioAdjustment({
          folioId: testFolioId,
          amountPesewas: twentyFivePercent,
          reason: "Manager major comp",
          user: managerUser,
        })
      ).rejects.toThrow("exceeds your role's allowed maximum of 20%");

      // 15% is allowed for Manager
      const fifteenPercent = Math.round(gross * 0.15);
      const adj = await applyFolioAdjustment({
        folioId: testFolioId,
        amountPesewas: fifteenPercent,
        reason: "Corporate partner approved rebate",
        user: managerUser,
      });

      expect(adj.id).toBeDefined();
    });

    it("rejects WAITER from applying any discounts (0% ceiling)", async () => {
      await expect(
        applyFolioAdjustment({
          folioId: testFolioId,
          amountPesewas: 1000,
          reason: "Waiter food discount",
          user: waiterUser,
        })
      ).rejects.toThrow("exceeds your role's allowed maximum of 0%");
    });
  });

  // TEST 3: Multi-Tender Split Payments & Exact Pesewas Math
  describe("Checkout Settlement, Split Payments & Receipt Itemization", () => {
    it("proves restaurant charge and adjustments appear on the final invoice receipt and balance math is exact", async () => {
      // Add a room extra charge
      await prisma.folioCharge.create({
        data: {
          folioId: testFolioId,
          description: "Airport Shuttle Express",
          source: FolioChargeSource.EXTRA,
          amountPesewas: 25000, // GH₵ 250.00
          createdByUserId: frontDeskUser.userId,
        },
      });

      const folio = await getFolioDetails({ folioId: testFolioId }, frontDeskUser);
      const remainingBalanceDue = folio.financials.runningBalancePesewas;
      expect(remainingBalanceDue).toBeGreaterThan(0);

      // Split the exact remaining balance across Cash (with change), MoMo, and Card
      const halfBalance = Math.round(remainingBalanceDue / 2);
      const cardPortion = Math.round((remainingBalanceDue - halfBalance) / 2);
      const cashPortion = remainingBalanceDue - halfBalance - cardPortion;

      const payments = [
        {
          method: "MOBILE_MONEY" as const,
          amountPesewas: halfBalance,
          provider: "MTN",
          reference: "MOMO-GH-998811",
        },
        {
          method: "CARD" as const,
          amountPesewas: cardPortion,
          provider: "VISA",
          reference: "AUTH-829104",
        },
        {
          method: "CASH" as const,
          amountPesewas: cashPortion,
          tenderedPesewas: cashPortion + 5000, // Handed over extra 50 GHS cash
        },
      ];

      const receipt = await settleHotelCheckoutWithSplitPayments({
        folioId: testFolioId,
        payments,
        checkOut: true,
        user: frontDeskUser,
      });

      // 1. Verify Receipt Details
      expect(receipt.id).toBeDefined();
      expect(receipt.receiptNumber).toMatch(/^R-\d{6}$/);
      expect(receipt.status).toBe("PAID");
      expect(receipt.balanceDuePesewas).toBe(0); // Exact settlement!
      expect(receipt.changePesewas).toBe(5000); // 50 GHS change

      // 2. Proves restaurant charge is present on the final receipt
      const restaurantItem = receipt.items.find((item) => item.category === "RESTAURANT");
      expect(restaurantItem).toBeDefined();
      expect(restaurantItem?.amountPesewas).toBe(18500);

      // 3. Proves room nights, extras, adjustments are on the receipt
      expect(receipt.items.some((i) => i.category === "ROOM_NIGHT")).toBe(true);
      expect(receipt.items.some((i) => i.category === "EXTRA")).toBe(true);
      expect(receipt.items.some((i) => i.category === "ADJUSTMENT")).toBe(true);

      // 4. Verify Folio status settled and room moved to DIRTY
      const settledFolio = await prisma.folio.findUnique({ where: { id: testFolioId } });
      expect(settledFolio?.status).toBe(FolioStatus.SETTLED);

      const room = await prisma.room.findUnique({ where: { id: testRoomId } });
      expect(room?.status).toBe(RoomStatus.DIRTY);

      const hkTask = await prisma.housekeepingTask.findFirst({
        where: { roomId: testRoomId },
        orderBy: { createdAt: "desc" },
      });
      expect(hkTask).toBeDefined();
    });
  });

  // TEST 4: Gapless Receipt Numbers Under Concurrent Checkouts
  describe("Concurrent Checkouts & Gapless ReceiptCounter", () => {
    it("guarantees strictly sequential and gapless receipt numbers under concurrent checkout settlements", async () => {
      // Create 5 separate mock folios for concurrent checkouts
      const testFolioIds: string[] = [];

      for (let i = 0; i < 5; i++) {
        const f = await prisma.folio.create({
          data: {
            folioNumber: `FOLIO-CONC-${Date.now()}-${i}`,
            status: FolioStatus.OPEN,
            charges: {
              create: [
                {
                  description: `Room Charge #${i + 1}`,
                  source: FolioChargeSource.ROOM,
                  amountPesewas: 10000,
                  createdByUserId: frontDeskUser.userId,
                },
              ],
            },
          },
        });
        testFolioIds.push(f.id);
      }

      // Execute 5 checkouts concurrently
      const checkoutPromises = testFolioIds.map((fId) =>
        settleHotelCheckoutWithSplitPayments({
          folioId: fId,
          payments: [
            {
              method: "CASH",
              amountPesewas: 10000,
              tenderedPesewas: 10000,
            },
          ],
          user: frontDeskUser,
        })
      );

      const results = await Promise.all(checkoutPromises);

      // Extract receipt numbers
      const receiptNumbers = results.map((r) => r.receiptNumber);
      const parsedSeqNumbers = receiptNumbers
        .map((num) => parseInt(num.replace("R-", ""), 10))
        .sort((a, b) => a - b);

      // Verify all 5 receipt numbers are strictly unique
      const uniqueSet = new Set(parsedSeqNumbers);
      expect(uniqueSet.size).toBe(5);

      // Verify ZERO gaps between minimum and maximum sequence numbers
      for (let j = 0; j < parsedSeqNumbers.length - 1; j++) {
        expect(parsedSeqNumbers[j + 1] - parsedSeqNumbers[j]).toBe(1);
      }

      // Cleanup concurrent test folios & receipts
      await prisma.receipt.deleteMany({
        where: { receiptNumber: { in: receiptNumbers } },
      });
      await prisma.folioCharge.deleteMany({
        where: { folioId: { in: testFolioIds } },
      });
      await prisma.folio.deleteMany({
        where: { id: { in: testFolioIds } },
      });
    });
  });

  // TEST 5: Voiding Folio Charges & Hotel Receipts with Audit Logging
  describe("Void & Refund Operations", () => {
    it("voids a single folio charge, enforces reason, and writes an audit log", async () => {
      // Create a temporary open folio with a charge
      const tempFolio = await prisma.folio.create({
        data: {
          folioNumber: `FOLIO-VOID-${Date.now()}`,
          status: FolioStatus.OPEN,
          charges: {
            create: [
              {
                description: "Accidental Bar Charge",
                source: FolioChargeSource.RESTAURANT,
                amountPesewas: 4500,
                createdByUserId: frontDeskUser.userId,
              },
            ],
          },
        },
        include: { charges: true },
      });

      const chargeToVoid = tempFolio.charges[0];

      // Void without reason should fail
      await expect(
        voidFolioCharge(chargeToVoid.id, "", frontDeskUser)
      ).rejects.toThrow("Reason is strictly required");

      // Void with valid reason
      const voidRes = await voidFolioCharge(
        chargeToVoid.id,
        "Customer charged mistakenly at the bar",
        frontDeskUser
      );
      expect(voidRes.success).toBe(true);

      // Ensure charge is removed
      const exists = await prisma.folioCharge.findUnique({
        where: { id: chargeToVoid.id },
      });
      expect(exists).toBeNull();

      // Ensure audit log is created
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: "FOLIO_CHARGE_VOIDED",
          entityId: chargeToVoid.id,
        },
      });
      expect(audit).toBeDefined();
      expect(audit?.userId).toBe(frontDeskUser.userId);

      // Cleanup
      await prisma.folio.delete({ where: { id: tempFolio.id } });
    });

    it("voids a hotel receipt with reason, updates status to VOIDED, and writes audit log", async () => {
      // Create a test receipt
      const tempReceipt = await prisma.receipt.create({
        data: {
          receiptNumber: `R-TEST-${Date.now()}`,
          customerName: "Test Void Guest",
          customerPhone: "+233240009911",
          cashierId: managerUser.userId,
          subtotalPesewas: 10000,
          totalPesewas: 10000,
          amountPaidPesewas: 10000,
          status: "PAID",
          items: [],
          payments: [],
        },
      });

      const voided = await voidHotelReceipt(
        tempReceipt.id,
        "Guest requested booking cancellation and cash refund",
        managerUser
      );

      expect(voided.status).toBe("VOIDED");

      const dbReceipt = await prisma.receipt.findUnique({
        where: { id: tempReceipt.id },
      });
      expect(dbReceipt?.status).toBe("VOIDED");
      expect(dbReceipt?.voidReason).toBe("Guest requested booking cancellation and cash refund");
      expect(dbReceipt?.voidedByUserId).toBe(managerUser.userId);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: "HOTEL_RECEIPT_VOIDED",
          entityId: tempReceipt.id,
        },
      });
      expect(audit).toBeDefined();
      expect(audit?.userId).toBe(managerUser.userId);

      // Cleanup
      await prisma.receipt.delete({ where: { id: tempReceipt.id } });
    });
  });
});

