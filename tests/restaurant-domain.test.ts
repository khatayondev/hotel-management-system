import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  RestaurantOrderType,
  RestaurantOrderStatus,
  PrepStation,
} from "@prisma/client";
import {
  createRestaurantOrder,
  updateOrderStatus,
  cancelRestaurantOrder,
} from "@/lib/restaurant/orders";
import { ROLES } from "@/lib/rbac";

describe("Restaurant Domain (Models, State Machine, RBAC & Server-Side Pricing)", () => {
  let testCategoryId: string;
  let availableItem1Id: string;
  let availableItem2Id: string;
  let unavailableItemId: string;
  let modifierGroupId: string;
  let modOptionMildId: string;
  let modOptionSpicyId: string;
  let modOptionUnavailableId: string;
  let testTableId: string;

  const adminSession = {
    userId: "",
    role: ROLES.OWNER_ADMIN,
    name: "Admin User",
    email: "admin-restaurant@hotel.gh",
  };

  const managerSession = {
    userId: "",
    role: ROLES.MANAGER,
    name: "Manager User",
    email: "manager-restaurant@hotel.gh",
  };

  const waiterSession = {
    userId: "",
    role: ROLES.WAITER,
    name: "Waiter User",
    email: "waiter-restaurant@hotel.gh",
  };

  beforeAll(async () => {
    // 1. Fetch seeded roles
    const roles = await prisma.role.findMany();
    const roleMap = new Map(roles.map((r) => [r.name, r.id]));

    // 2. Create or ensure test staff users
    const admin = await prisma.user.upsert({
      where: { email: "admin-restaurant@hotel.gh" },
      update: {},
      create: {
        email: "admin-restaurant@hotel.gh",
        name: "Admin User",
        roleId: roleMap.get(ROLES.OWNER_ADMIN)!,
        passwordHash: "hash-not-used-in-unit-test",
      },
    });
    adminSession.userId = admin.id;

    const manager = await prisma.user.upsert({
      where: { email: "manager-restaurant@hotel.gh" },
      update: {},
      create: {
        email: "manager-restaurant@hotel.gh",
        name: "Manager User",
        roleId: roleMap.get(ROLES.MANAGER)!,
        passwordHash: "hash-not-used-in-unit-test",
      },
    });
    managerSession.userId = manager.id;

    const waiter = await prisma.user.upsert({
      where: { email: "waiter-restaurant@hotel.gh" },
      update: {},
      create: {
        email: "waiter-restaurant@hotel.gh",
        name: "Waiter User",
        roleId: roleMap.get(ROLES.WAITER)!,
        passwordHash: "hash-not-used-in-unit-test",
      },
    });
    waiterSession.userId = waiter.id;

    // 3. Create Category
    const category = await prisma.menuCategory.create({
      data: {
        name: "Test Grills & Mains",
        slug: `test-grills-mains-${Date.now()}`,
        sortOrder: 1,
      },
    });
    testCategoryId = category.id;

    // 3. Create Available Menu Items
    // Available Item 1: Jollof with Grilled Chicken - GH₵ 80.00 (8000 pesewas)
    const item1 = await prisma.menuItem.create({
      data: {
        name: "Test Jollof & Chicken",
        description: "Smoky party jollof with spicy grilled quarter chicken",
        pricePesewas: 8000,
        category: { connect: { id: testCategoryId } },
        prepStation: PrepStation.KITCHEN,
        isAvailable: true,
        sortOrder: 1,
      },
    });
    availableItem1Id = item1.id;

    // Available Item 2: Fresh Palm Wine / Cocktail - GH₵ 45.00 (4500 pesewas)
    const item2 = await prisma.menuItem.create({
      data: {
        name: "Test Hibiscus Cooler",
        description: "Chilled zobo infused with mint and cloves",
        pricePesewas: 4500,
        category: { connect: { id: testCategoryId } },
        prepStation: PrepStation.BAR,
        isAvailable: true,
        sortOrder: 2,
      },
    });
    availableItem2Id = item2.id;

    // Unavailable Menu Item: Grilled Lobster (Sold Out)
    const itemUnavailable = await prisma.menuItem.create({
      data: {
        name: "Test Fresh Lobster (Sold Out)",
        description: "Catch of the day grilled with garlic butter",
        pricePesewas: 35000,
        category: { connect: { id: testCategoryId } },
        prepStation: PrepStation.KITCHEN,
        isAvailable: false,
        sortOrder: 3,
      },
    });
    unavailableItemId = itemUnavailable.id;

    // 4. Create Modifier Group on Item 1
    const modGroup = await prisma.modifierGroup.create({
      data: {
        menuItem: { connect: { id: availableItem1Id } },
        name: "Spice Level",
        minSelect: 1,
        maxSelect: 1,
        isRequired: true,
      },
    });
    modifierGroupId = modGroup.id;

    const optMild = await prisma.modifierOption.create({
      data: {
        modifierGroup: { connect: { id: modifierGroupId } },
        name: "Mild",
        priceDeltaPesewas: 0,
        isAvailable: true,
        sortOrder: 1,
      },
    });
    modOptionMildId = optMild.id;

    const optSpicy = await prisma.modifierOption.create({
      data: {
        modifierGroup: { connect: { id: modifierGroupId } },
        name: "Extra Hot Shito Sauce",
        priceDeltaPesewas: 500, // +GH₵ 5.00
        isAvailable: true,
        sortOrder: 2,
      },
    });
    modOptionSpicyId = optSpicy.id;

    const optUnavail = await prisma.modifierOption.create({
      data: {
        modifierGroup: { connect: { id: modifierGroupId } },
        name: "Special Ghost Pepper (Out of stock)",
        priceDeltaPesewas: 1000,
        isAvailable: false,
        sortOrder: 3,
      },
    });
    modOptionUnavailableId = optUnavail.id;

    // 5. Create Table
    await prisma.restaurantOrderItem.deleteMany({
      where: { order: { table: { label: { startsWith: "Test Table" } } } },
    });
    await prisma.restaurantOrder.deleteMany({
      where: { table: { label: { startsWith: "Test Table" } } },
    });
    await prisma.restaurantTable.deleteMany({
      where: { label: { startsWith: "Test Table" } },
    });
    await prisma.restaurantTable.deleteMany({
      where: { label: "Table 99" },
    });

    const table = await prisma.restaurantTable.create({
      data: {
        label: `Test Table ${Date.now()}`,
        capacity: 4,
        qrToken: `test-qr-token-${Date.now()}`,
        isActive: true,
      },
    });
    testTableId = table.id;
  });

  afterAll(async () => {
    // Clean up created test data safely
    if (testCategoryId) {
      const itemIds = [availableItem1Id, availableItem2Id, unavailableItemId].filter(Boolean);
      if (itemIds.length > 0) {
        await prisma.restaurantOrderItem.deleteMany({
          where: { itemId: { in: itemIds } },
        });
        await prisma.modifierOption.deleteMany({
          where: { modifierGroup: { menuItemId: { in: itemIds } } },
        });
        await prisma.modifierGroup.deleteMany({
          where: { menuItemId: { in: itemIds } },
        });
        await prisma.menuItem.deleteMany({
          where: { id: { in: itemIds } },
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

      await prisma.menuCategory.deleteMany({
        where: { id: testCategoryId },
      });
    }

    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            "admin-restaurant@hotel.gh",
            "manager-restaurant@hotel.gh",
            "waiter-restaurant@hotel.gh",
          ],
        },
      },
    });
  });

  describe("1. Order Creation & Server-Side Pricing Verification", () => {
    it("should compute exact prices on the server and ignore tampered client prices", async () => {
      // Client submits an order for 2x Jollof (8000 each) with Extra Hot (+500 each) = (8000+500)*2 = 17000 pesewas
      // plus 1x Hibiscus Cooler (4500) = 4500 pesewas
      // Total should be 21500 pesewas (GH₵ 215.00)
      const order = await createRestaurantOrder(
        {
          type: RestaurantOrderType.DINE_IN,
          tableId: testTableId,
          customerName: "Kofi Annan",
          customerPhone: "+233241112233",
          items: [
            {
              itemId: availableItem1Id,
              quantity: 2,
              selectedModifierOptionIds: [modOptionSpicyId],
              notes: "Well seasoned please",
            },
            {
              itemId: availableItem2Id,
              quantity: 1,
              selectedModifierOptionIds: [],
              notes: "Extra ice",
            },
          ],
        },
        waiterSession
      );

      expect(order).toBeDefined();
      expect(order.orderNumber).toMatch(/^RO-\d{8}-\d{6}$/);
      expect(order.status).toBe(RestaurantOrderStatus.PLACED);
      expect(order.subtotalPesewas).toBe(21500); // 8500 * 2 + 4500 = 21500
      expect(order.totalPesewas).toBe(21500);
      expect(order.items).toHaveLength(2);

      // Verify item snapshots
      const item1Snap = order.items.find((i) => i.itemId === availableItem1Id);
      expect(item1Snap).toBeDefined();
      expect(item1Snap?.unitPriceSnapshot).toBe(8000);
      expect(item1Snap?.totalPricePesewas).toBe(17000); // (8000 + 500) * 2
      expect(item1Snap?.station).toBe(PrepStation.KITCHEN);
      expect(Array.isArray(item1Snap?.selectedModifiersSnapshot)).toBe(true);
      expect(item1Snap?.selectedModifiersSnapshot).toEqual([
        {
          optionId: modOptionSpicyId,
          optionName: "Extra Hot Shito Sauce",
          priceDeltaPesewas: 500,
        },
      ]);

      const item2Snap = order.items.find((i) => i.itemId === availableItem2Id);
      expect(item2Snap).toBeDefined();
      expect(item2Snap?.unitPriceSnapshot).toBe(4500);
      expect(item2Snap?.station).toBe(PrepStation.BAR);

      // Verify AuditLog written
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          entityId: order.id,
          action: "RESTAURANT_ORDER_CREATED",
        },
      });
      expect(auditLog).toBeDefined();
      expect(auditLog?.userId).toBe(waiterSession.userId);
    });

    it("should reject ordering unavailable items", async () => {
      await expect(
        createRestaurantOrder(
          {
            type: RestaurantOrderType.DINE_IN,
            tableId: testTableId,
            items: [
              {
                itemId: unavailableItemId,
                quantity: 1,
              },
            ],
          },
          waiterSession
        )
      ).rejects.toThrowError(/unavailable/i);
    });

    it("should reject ordering with an unavailable modifier option", async () => {
      await expect(
        createRestaurantOrder(
          {
            type: RestaurantOrderType.DINE_IN,
            tableId: testTableId,
            items: [
              {
                itemId: availableItem1Id,
                quantity: 1,
                selectedModifierOptionIds: [modOptionUnavailableId],
              },
            ],
          },
          waiterSession
        )
      ).rejects.toThrowError(/unavailable/i);
    });

    it("should reject when a required modifier group is missing a selection", async () => {
      await expect(
        createRestaurantOrder(
          {
            type: RestaurantOrderType.DINE_IN,
            tableId: testTableId,
            items: [
              {
                itemId: availableItem1Id,
                quantity: 1,
                selectedModifierOptionIds: [], // Missing required "Spice Level"
              },
            ],
          },
          waiterSession
        )
      ).rejects.toThrowError(/at least 1 selection/i);
    });

    it("should reject when modifier selection exceeds maxSelect", async () => {
      await expect(
        createRestaurantOrder(
          {
            type: RestaurantOrderType.DINE_IN,
            tableId: testTableId,
            items: [
              {
                itemId: availableItem1Id,
                quantity: 1,
                selectedModifierOptionIds: [modOptionMildId, modOptionSpicyId], // Max is 1
              },
            ],
          },
          waiterSession
        )
      ).rejects.toThrowError(/allows at most 1 selection/i);
    });
  });

  describe("2. State Machine Transitions & Timestamps", () => {
    it("should smoothly transition through legal workflow: PLACED -> ACCEPTED -> PREPARING -> READY -> SERVED -> COMPLETED", async () => {
      const order = await createRestaurantOrder(
        {
          type: RestaurantOrderType.DINE_IN,
          tableId: testTableId,
          items: [
            {
              itemId: availableItem1Id,
              quantity: 1,
              selectedModifierOptionIds: [modOptionMildId],
            },
          ],
        },
        waiterSession
      );

      expect(order.status).toBe(RestaurantOrderStatus.PLACED);
      expect(order.placedAt).toBeDefined();

      // 1. PLACED -> ACCEPTED
      const accepted = await updateOrderStatus(order.id, RestaurantOrderStatus.ACCEPTED, managerSession);
      expect(accepted.status).toBe(RestaurantOrderStatus.ACCEPTED);
      expect(accepted.acceptedAt).toBeDefined();

      // 2. ACCEPTED -> PREPARING
      const preparing = await updateOrderStatus(order.id, RestaurantOrderStatus.PREPARING, waiterSession);
      expect(preparing.status).toBe(RestaurantOrderStatus.PREPARING);
      expect(preparing.preparingAt).toBeDefined();

      // 3. PREPARING -> READY
      const ready = await updateOrderStatus(order.id, RestaurantOrderStatus.READY, waiterSession);
      expect(ready.status).toBe(RestaurantOrderStatus.READY);
      expect(ready.readyAt).toBeDefined();

      // 4. READY -> SERVED
      const served = await updateOrderStatus(order.id, RestaurantOrderStatus.SERVED, waiterSession);
      expect(served.status).toBe(RestaurantOrderStatus.SERVED);
      expect(served.servedAt).toBeDefined();

      // 5. SERVED -> COMPLETED
      const completed = await updateOrderStatus(order.id, RestaurantOrderStatus.COMPLETED, managerSession);
      expect(completed.status).toBe(RestaurantOrderStatus.COMPLETED);
      expect(completed.completedAt).toBeDefined();

      // Check all audit logs exist for this order
      const logs = await prisma.auditLog.findMany({
        where: { entityId: order.id },
      });
      // 1 CREATED + 5 STATUS_UPDATED = 6
      expect(logs.length).toBeGreaterThanOrEqual(6);
    });

    it("should reject illegal status transitions", async () => {
      const order = await createRestaurantOrder(
        {
          type: RestaurantOrderType.DINE_IN,
          tableId: testTableId,
          items: [
            {
              itemId: availableItem1Id,
              quantity: 1,
              selectedModifierOptionIds: [modOptionMildId],
            },
          ],
        },
        waiterSession
      );

      // Attempt illegal jump: PLACED -> SERVED (must go through ACCEPTED/PREPARING/READY)
      await expect(
        updateOrderStatus(order.id, RestaurantOrderStatus.SERVED, managerSession)
      ).rejects.toThrowError(/Illegal order status transition/i);

      // Attempt illegal jump: PLACED -> COMPLETED
      await expect(
        updateOrderStatus(order.id, RestaurantOrderStatus.COMPLETED, managerSession)
      ).rejects.toThrowError(/Illegal order status transition/i);
    });

    it("should reject any status change once an order is COMPLETED", async () => {
      const order = await createRestaurantOrder(
        {
          type: RestaurantOrderType.DINE_IN,
          tableId: testTableId,
          items: [
            {
              itemId: availableItem1Id,
              quantity: 1,
              selectedModifierOptionIds: [modOptionMildId],
            },
          ],
        },
        waiterSession
      );

      await updateOrderStatus(order.id, RestaurantOrderStatus.ACCEPTED, managerSession);
      await updateOrderStatus(order.id, RestaurantOrderStatus.PREPARING, managerSession);
      await updateOrderStatus(order.id, RestaurantOrderStatus.READY, managerSession);
      await updateOrderStatus(order.id, RestaurantOrderStatus.SERVED, managerSession);
      await updateOrderStatus(order.id, RestaurantOrderStatus.COMPLETED, managerSession);

      // Attempting to move backward or cancel from COMPLETED
      await expect(
        updateOrderStatus(order.id, RestaurantOrderStatus.PREPARING, managerSession)
      ).rejects.toThrowError(/Illegal order status transition/i);

      await expect(
        cancelRestaurantOrder(order.id, "Attempt cancel completed", managerSession)
      ).rejects.toThrowError(/Illegal.*transition|cannot be cancelled/i);
    });
  });

  describe("3. Role-Based Cancellation & Manager Override", () => {
    it("should allow a WAITER to cancel an order that is still in PLACED or ACCEPTED status", async () => {
      const order = await createRestaurantOrder(
        {
          type: RestaurantOrderType.DINE_IN,
          tableId: testTableId,
          items: [
            {
              itemId: availableItem1Id,
              quantity: 1,
              selectedModifierOptionIds: [modOptionMildId],
            },
          ],
        },
        waiterSession
      );

      const cancelled = await cancelRestaurantOrder(
        order.id,
        "Customer changed mind before kitchen started",
        waiterSession
      );

      expect(cancelled.status).toBe(RestaurantOrderStatus.CANCELLED);
      expect(cancelled.cancelledAt).toBeDefined();
      expect(cancelled.cancelReason).toBe("Customer changed mind before kitchen started");
      expect(cancelled.cancelledByUserId).toBe(waiterSession.userId);
    });

    it("should require a non-empty cancellation reason", async () => {
      const order = await createRestaurantOrder(
        {
          type: RestaurantOrderType.DINE_IN,
          tableId: testTableId,
          items: [
            {
              itemId: availableItem1Id,
              quantity: 1,
              selectedModifierOptionIds: [modOptionMildId],
            },
          ],
        },
        waiterSession
      );

      await expect(
        cancelRestaurantOrder(order.id, "   ", waiterSession)
      ).rejects.toThrowError(/Reason is strictly required/i);
    });

    it("should REJECT cancellation after PREPARING when attempted by a WAITER", async () => {
      const order = await createRestaurantOrder(
        {
          type: RestaurantOrderType.DINE_IN,
          tableId: testTableId,
          items: [
            {
              itemId: availableItem1Id,
              quantity: 1,
              selectedModifierOptionIds: [modOptionMildId],
            },
          ],
        },
        waiterSession
      );

      await updateOrderStatus(order.id, RestaurantOrderStatus.ACCEPTED, waiterSession);
      await updateOrderStatus(order.id, RestaurantOrderStatus.PREPARING, waiterSession);

      // Now order is in PREPARING status. A waiter attempts to cancel:
      await expect(
        cancelRestaurantOrder(order.id, "Waiter trying to cancel food on the stove", waiterSession)
      ).rejects.toThrowError(/Only MANAGER or OWNER_ADMIN can cancel/i);
    });

    it("should ALLOW cancellation after PREPARING when executed by a MANAGER or OWNER_ADMIN", async () => {
      const order = await createRestaurantOrder(
        {
          type: RestaurantOrderType.DINE_IN,
          tableId: testTableId,
          items: [
            {
              itemId: availableItem1Id,
              quantity: 1,
              selectedModifierOptionIds: [modOptionMildId],
            },
          ],
        },
        waiterSession
      );

      await updateOrderStatus(order.id, RestaurantOrderStatus.ACCEPTED, managerSession);
      await updateOrderStatus(order.id, RestaurantOrderStatus.PREPARING, managerSession);

      // Order is in PREPARING status. Manager cancels with reason:
      const cancelled = await cancelRestaurantOrder(
        order.id,
        "Customer had sudden emergency and departed. Kitchen notified to halt.",
        managerSession
      );

      expect(cancelled.status).toBe(RestaurantOrderStatus.CANCELLED);
      expect(cancelled.cancelledAt).toBeDefined();
      expect(cancelled.cancelledByUserId).toBe(managerSession.userId);
      expect(cancelled.cancelReason).toContain("Customer had sudden emergency");
    });
  });

  describe("4. Sequential Daily Order Numbers", () => {
    it("should generate atomic, sequential order numbers for the day", async () => {
      const order1 = await createRestaurantOrder(
        {
          type: RestaurantOrderType.PICKUP,
          customerName: "Ama Serwaa",
          customerPhone: "+233201112244",
          items: [
            {
              itemId: availableItem2Id,
              quantity: 1,
            },
          ],
        },
        waiterSession
      );

      const order2 = await createRestaurantOrder(
        {
          type: RestaurantOrderType.PICKUP,
          customerName: "Yaw Boateng",
          customerPhone: "+233201112255",
          items: [
            {
              itemId: availableItem2Id,
              quantity: 1,
            },
          ],
        },
        waiterSession
      );

      expect(order1.orderNumber).toMatch(/^RO-\d{8}-\d{6}$/);
      expect(order2.orderNumber).toMatch(/^RO-\d{8}-\d{6}$/);

      const num1 = parseInt(order1.orderNumber.split("-")[2], 10);
      const num2 = parseInt(order2.orderNumber.split("-")[2], 10);
      expect(num2).toBe(num1 + 1);
    });
  });
});
