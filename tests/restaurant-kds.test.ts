import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import {
  RestaurantOrderType,
  RestaurantOrderStatus,
  RestaurantPaymentStatus,
  PrepStation,
} from "@prisma/client";
import {
  createRestaurantOrder,
  getOrderByTrackingToken,
} from "@/lib/restaurant/orders";
import { ROLES, UserRole } from "@/lib/rbac";
import { saveSettings } from "@/lib/settings";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

// In-memory mock session switcher for route tests
let mockSessionUser: {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  mustChangePassword: boolean;
  permissions: string[];
} | null = null;

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getCurrentSession: vi.fn(() => Promise.resolve(mockSessionUser)),
  };
});

// Import route handlers after auth mock
import { GET as getKitchenOrders } from "@/app/api/restaurant/kitchen/orders/route";
import { PATCH as patchKitchenOrder } from "@/app/api/restaurant/kitchen/orders/[id]/route";
import { GET as getWaiterOrders } from "@/app/api/restaurant/waiter/orders/route";
import { PATCH as patchWaiterOrder } from "@/app/api/restaurant/waiter/orders/[id]/route";
import { PATCH as patchMenuItem } from "@/app/api/admin/restaurant/items/route";

describe("Restaurant KDS (Kitchen Display System) & Waiter View Integration Tests", () => {
  let testCategoryId: string;
  let kitchenItemId: string;
  let barItemId: string;
  let testTableId: string;

  const kitchenUser = {
    userId: "",
    role: ROLES.KITCHEN,
    name: "Chef Kwame",
    email: "chef-kds-test@hotel.gh",
    mustChangePassword: false,
    permissions: [],
  };

  const waiterUser = {
    userId: "",
    role: ROLES.WAITER,
    name: "Waiter Kofi",
    email: "waiter-kds-test@hotel.gh",
    mustChangePassword: false,
    permissions: [],
  };

  const managerUser = {
    userId: "",
    role: ROLES.MANAGER,
    name: "Manager Ama",
    email: "manager-kds-test@hotel.gh",
    mustChangePassword: false,
    permissions: [],
  };

  const housekeepingUser = {
    userId: "",
    role: ROLES.HOUSEKEEPING,
    name: "Cleaner Akosua",
    email: "cleaner-kds-test@hotel.gh",
    mustChangePassword: false,
    permissions: [],
  };

  const adminUser = {
    userId: "",
    role: ROLES.OWNER_ADMIN,
    name: "Admin Owner",
    email: "admin-kds-test@hotel.gh",
    mustChangePassword: false,
    permissions: [],
  };

  beforeAll(async () => {
    // 1. Fetch system roles
    const roles = await prisma.role.findMany();
    const roleMap = new Map(roles.map((r) => [r.name, r.id]));

    // 2. Upsert test staff users
    const chef = await prisma.user.upsert({
      where: { email: kitchenUser.email },
      update: {},
      create: {
        email: kitchenUser.email,
        name: kitchenUser.name,
        roleId: roleMap.get(ROLES.KITCHEN)!,
        passwordHash: "hash-not-used-in-unit-test",
      },
    });
    kitchenUser.userId = chef.id;

    const waiter = await prisma.user.upsert({
      where: { email: waiterUser.email },
      update: {},
      create: {
        email: waiterUser.email,
        name: waiterUser.name,
        roleId: roleMap.get(ROLES.WAITER)!,
        passwordHash: "hash-not-used-in-unit-test",
      },
    });
    waiterUser.userId = waiter.id;

    const mgr = await prisma.user.upsert({
      where: { email: managerUser.email },
      update: {},
      create: {
        email: managerUser.email,
        name: managerUser.name,
        roleId: roleMap.get(ROLES.MANAGER)!,
        passwordHash: "hash-not-used-in-unit-test",
      },
    });
    managerUser.userId = mgr.id;

    const cleaner = await prisma.user.upsert({
      where: { email: housekeepingUser.email },
      update: {},
      create: {
        email: housekeepingUser.email,
        name: housekeepingUser.name,
        roleId: roleMap.get(ROLES.HOUSEKEEPING)!,
        passwordHash: "hash-not-used-in-unit-test",
      },
    });
    housekeepingUser.userId = cleaner.id;

    const admin = await prisma.user.upsert({
      where: { email: adminUser.email },
      update: {},
      create: {
        email: adminUser.email,
        name: adminUser.name,
        roleId: roleMap.get(ROLES.OWNER_ADMIN)!,
        passwordHash: "hash-not-used-in-unit-test",
      },
    });
    adminUser.userId = admin.id;

    // 3. Configure settings
    await saveSettings(
      {
        kdsAmberMinutes: 10,
        kdsRedMinutes: 20,
      },
      { id: admin.id, role: ROLES.OWNER_ADMIN, name: "Admin Owner" }
    );

    // 4. Create Category & Menu Items
    const category = await prisma.menuCategory.create({
      data: {
        name: "KDS Station Specials",
        slug: `kds-specials-${Date.now()}`,
        sortOrder: 1,
      },
    });
    testCategoryId = category.id;

    const kItem = await prisma.menuItem.create({
      data: {
        menuCategoryId: testCategoryId,
        name: "Grilled Tilapia with Banku",
        description: "Fresh Lake Volta Tilapia with spicy shito and banku",
        pricePesewas: 8500, // 85 GHS
        isAvailable: true,
        prepStation: PrepStation.KITCHEN,
        sortOrder: 1,
      },
    });
    kitchenItemId = kItem.id;

    const bItem = await prisma.menuItem.create({
      data: {
        menuCategoryId: testCategoryId,
        name: "Sobolo Cocktail Pitcher",
        description: "Chilled hibiscus cocktail with pineapple, ginger and mint",
        pricePesewas: 4500, // 45 GHS
        isAvailable: true,
        prepStation: PrepStation.BAR,
        sortOrder: 2,
      },
    });
    barItemId = bItem.id;

    // 5. Create test dining table
    const table = await prisma.restaurantTable.create({
      data: {
        label: `KDS-T${Math.floor(Math.random() * 900) + 100}`,
        capacity: 4,
        qrToken: `qr-kds-test-${Date.now()}`,
      },
    });
    testTableId = table.id;
  });

  afterAll(async () => {
    // Cleanup created test records
    await prisma.restaurantOrderItem.deleteMany({
      where: { itemId: { in: [kitchenItemId, barItemId] } },
    });
    await prisma.restaurantOrder.deleteMany({
      where: { tableId: testTableId },
    });
    await prisma.restaurantTable.deleteMany({ where: { id: testTableId } });
    await prisma.menuItem.deleteMany({
      where: { id: { in: [kitchenItemId, barItemId] } },
    });
    await prisma.menuCategory.deleteMany({ where: { id: testCategoryId } });
    await prisma.$disconnect();
  });

  describe("1. Role Access Control & Route Guarding", () => {
    it("rejects unauthenticated requests to kitchen and waiter APIs with 401", async () => {
      mockSessionUser = null;

      const kitchenReq = new NextRequest("http://localhost:3000/api/restaurant/kitchen/orders");
      const kitchenRes = await getKitchenOrders(kitchenReq);
      expect(kitchenRes.status).toBe(401);

      const waiterReq = new NextRequest("http://localhost:3000/api/restaurant/waiter/orders");
      const waiterRes = await getWaiterOrders(waiterReq);
      expect(waiterRes.status).toBe(401);
    });

    it("restricts /api/restaurant/kitchen/orders to KITCHEN, MANAGER, and OWNER_ADMIN", async () => {
      // Housekeeping staff should be forbidden (403)
      mockSessionUser = housekeepingUser;
      const hkReq = new NextRequest("http://localhost:3000/api/restaurant/kitchen/orders");
      const hkRes = await getKitchenOrders(hkReq);
      expect(hkRes.status).toBe(403);

      // Waiter role should also be forbidden from kitchen KDS endpoint (403)
      mockSessionUser = waiterUser;
      const waiterReq = new NextRequest("http://localhost:3000/api/restaurant/kitchen/orders");
      const waiterRes = await getKitchenOrders(waiterReq);
      expect(waiterRes.status).toBe(403);

      // Kitchen role should be allowed (200)
      mockSessionUser = kitchenUser;
      const chefReq = new NextRequest("http://localhost:3000/api/restaurant/kitchen/orders");
      const chefRes = await getKitchenOrders(chefReq);
      expect(chefRes.status).toBe(200);
      const chefJson = await chefRes.json();
      expect(chefJson.success).toBe(true);
      expect(Array.isArray(chefJson.data.orders)).toBe(true);

      // Manager role should be allowed (200)
      mockSessionUser = managerUser;
      const mgrReq = new NextRequest("http://localhost:3000/api/restaurant/kitchen/orders");
      const mgrRes = await getKitchenOrders(mgrReq);
      expect(mgrRes.status).toBe(200);
    });

    it("restricts /api/restaurant/waiter/orders to WAITER, FRONT_DESK, MANAGER, and OWNER_ADMIN", async () => {
      // Housekeeping staff is forbidden (403)
      mockSessionUser = housekeepingUser;
      const hkReq = new NextRequest("http://localhost:3000/api/restaurant/waiter/orders");
      const hkRes = await getWaiterOrders(hkReq);
      expect(hkRes.status).toBe(403);

      // Waiter staff is allowed (200)
      mockSessionUser = waiterUser;
      const waiterReq = new NextRequest("http://localhost:3000/api/restaurant/waiter/orders");
      const waiterRes = await getWaiterOrders(waiterReq);
      expect(waiterRes.status).toBe(200);
      const waiterJson = await waiterRes.json();
      expect(waiterJson.success).toBe(true);
      expect(waiterJson.data.counts).toBeDefined();
    });

    it("middleware protects /kitchen and /waiter web pages against unauthenticated access", () => {
      const kitchenReq = new NextRequest("http://localhost:3000/kitchen");
      const kitchenRes = middleware(kitchenReq);
      expect(kitchenRes.status).toBe(307);
      expect(kitchenRes.headers.get("location")).toContain("/login?redirect=%2Fkitchen");

      const waiterReq = new NextRequest("http://localhost:3000/waiter");
      const waiterRes = middleware(waiterReq);
      expect(waiterRes.status).toBe(307);
      expect(waiterRes.headers.get("location")).toContain("/login?redirect=%2Fwaiter");
    });
  });

  describe("2. Station Filtering (KITCHEN vs BAR vs ALL)", () => {
    let kitchenOrderId: string;
    let barOrderId: string;
    let mixedOrderId: string;

    beforeAll(async () => {
      // Create 3 orders:
      // 1. Kitchen only
      const kOrder = await createRestaurantOrder({
        type: RestaurantOrderType.DINE_IN,
        tableId: testTableId,
        items: [{ itemId: kitchenItemId, quantity: 1 }],
        paymentStatus: RestaurantPaymentStatus.PAID,
        user: adminUser,
      });
      kitchenOrderId = kOrder.id;

      // 2. Bar only
      const bOrder = await createRestaurantOrder({
        type: RestaurantOrderType.DINE_IN,
        tableId: testTableId,
        items: [{ itemId: barItemId, quantity: 2 }],
        paymentStatus: RestaurantPaymentStatus.PAID,
        user: adminUser,
      });
      barOrderId = bOrder.id;

      // 3. Mixed (Kitchen + Bar)
      const mOrder = await createRestaurantOrder({
        type: RestaurantOrderType.DINE_IN,
        tableId: testTableId,
        items: [
          { itemId: kitchenItemId, quantity: 1 },
          { itemId: barItemId, quantity: 1 },
        ],
        paymentStatus: RestaurantPaymentStatus.PAID,
        user: adminUser,
      });
      mixedOrderId = mOrder.id;
    });

    it("filters orders for KITCHEN prep station correctly", async () => {
      mockSessionUser = kitchenUser;
      const req = new NextRequest("http://localhost:3000/api/restaurant/kitchen/orders?station=KITCHEN");
      const res = await getKitchenOrders(req);
      const json = await res.json();

      expect(json.success).toBe(true);
      const orderIds = json.data.orders.map((o: { id: string }) => o.id);
      expect(orderIds).toContain(kitchenOrderId);
      expect(orderIds).toContain(mixedOrderId);
      expect(orderIds).not.toContain(barOrderId); // Bar-only order must NOT appear in Kitchen station
    });

    it("filters orders for BAR prep station correctly", async () => {
      mockSessionUser = kitchenUser;
      const req = new NextRequest("http://localhost:3000/api/restaurant/kitchen/orders?station=bar");
      const res = await getKitchenOrders(req);
      const json = await res.json();

      expect(json.success).toBe(true);
      const orderIds = json.data.orders.map((o: { id: string }) => o.id);
      expect(orderIds).toContain(barOrderId);
      expect(orderIds).toContain(mixedOrderId);
      expect(orderIds).not.toContain(kitchenOrderId); // Kitchen-only order must NOT appear in Bar station
    });

    it("returns all station tickets when station is ALL or omitted", async () => {
      mockSessionUser = kitchenUser;
      const req = new NextRequest("http://localhost:3000/api/restaurant/kitchen/orders");
      const res = await getKitchenOrders(req);
      const json = await res.json();

      expect(json.success).toBe(true);
      const orderIds = json.data.orders.map((o: { id: string }) => o.id);
      expect(orderIds).toContain(kitchenOrderId);
      expect(orderIds).toContain(barOrderId);
      expect(orderIds).toContain(mixedOrderId);
    });
  });

  describe("3. Ticket Progression & Guest Tracking Alignment", () => {
    let orderId: string;
    let trackingToken: string;

    beforeAll(async () => {
      const order = await createRestaurantOrder({
        type: RestaurantOrderType.DINE_IN,
        tableId: testTableId,
        items: [{ itemId: kitchenItemId, quantity: 1 }],
        paymentStatus: RestaurantPaymentStatus.PAID,
        user: adminUser,
      });
      orderId = order.id;
      trackingToken = order.trackingToken!;
    });

    it("advances ticket START (PLACED -> ACCEPTED -> PREPARING)", async () => {
      mockSessionUser = kitchenUser;

      const req = new NextRequest(
        `http://localhost:3000/api/restaurant/kitchen/orders/${orderId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "START" }),
        }
      );

      const res = await patchKitchenOrder(req, {
        params: Promise.resolve({ id: orderId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.order.status).toBe(RestaurantOrderStatus.PREPARING);
      expect(json.data.order.preparingAt).toBeDefined();

      // Verify guest tracking page reflection
      const tracked = await getOrderByTrackingToken(trackingToken);
      expect(tracked).not.toBeNull();
      expect(tracked?.status).toBe(RestaurantOrderStatus.PREPARING);
    });

    it("advances ticket READY (PREPARING -> READY)", async () => {
      mockSessionUser = kitchenUser;

      const req = new NextRequest(
        `http://localhost:3000/api/restaurant/kitchen/orders/${orderId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "READY" }),
        }
      );

      const res = await patchKitchenOrder(req, {
        params: Promise.resolve({ id: orderId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.order.status).toBe(RestaurantOrderStatus.READY);
      expect(json.data.order.readyAt).toBeDefined();

      // Verify guest tracking page reflection
      const tracked = await getOrderByTrackingToken(trackingToken);
      expect(tracked?.status).toBe(RestaurantOrderStatus.READY);
    });

    it("waiter view displays READY orders and marks SERVED (READY -> SERVED)", async () => {
      mockSessionUser = waiterUser;

      // 1. Fetch waiter orders - should list our ready order
      const listReq = new NextRequest("http://localhost:3000/api/restaurant/waiter/orders");
      const listRes = await getWaiterOrders(listReq);
      const listJson = await listRes.json();
      expect(listRes.status).toBe(200);
      const readyOrderIds = listJson.data.orders.map((o: { id: string }) => o.id);
      expect(readyOrderIds).toContain(orderId);

      // 2. Mark order as served
      const serveReq = new NextRequest(
        `http://localhost:3000/api/restaurant/waiter/orders/${orderId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "SERVE" }),
        }
      );

      const serveRes = await patchWaiterOrder(serveReq, {
        params: Promise.resolve({ id: orderId }),
      });
      const serveJson = await serveRes.json();

      expect(serveRes.status).toBe(200);
      expect(serveJson.success).toBe(true);
      expect(serveJson.data.order.status).toBe(RestaurantOrderStatus.SERVED);
      expect(serveJson.data.order.servedAt).toBeDefined();

      // 3. Guest tracking reflects SERVED
      const tracked = await getOrderByTrackingToken(trackingToken);
      expect(tracked?.status).toBe(RestaurantOrderStatus.SERVED);
    });
  });

  describe("4. Ticket Cancellation & Manager Authorization", () => {
    let cancelOrderId: string;

    beforeAll(async () => {
      const order = await createRestaurantOrder({
        type: RestaurantOrderType.DINE_IN,
        tableId: testTableId,
        items: [{ itemId: kitchenItemId, quantity: 1 }],
        paymentStatus: RestaurantPaymentStatus.PAID,
        user: adminUser,
      });
      cancelOrderId = order.id;
    });

    it("forbids kitchen staff without manager role from cancelling tickets", async () => {
      mockSessionUser = kitchenUser;

      const req = new NextRequest(
        `http://localhost:3000/api/restaurant/kitchen/orders/${cancelOrderId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "CANCEL", reason: "Customer changed mind" }),
        }
      );

      const res = await patchKitchenOrder(req, {
        params: Promise.resolve({ id: cancelOrderId }),
      });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("MANAGER_OVERRIDE_REQUIRED");
    });

    it("requires a non-empty reason when a manager cancels a ticket", async () => {
      mockSessionUser = managerUser;

      const req = new NextRequest(
        `http://localhost:3000/api/restaurant/kitchen/orders/${cancelOrderId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "CANCEL", reason: "   " }),
        }
      );

      const res = await patchKitchenOrder(req, {
        params: Promise.resolve({ id: cancelOrderId }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("REASON_REQUIRED");
    });

    it("allows manager to cancel ticket with reason and audits the action", async () => {
      mockSessionUser = managerUser;

      const reason = "Out of fresh charcoal for the grill";
      const req = new NextRequest(
        `http://localhost:3000/api/restaurant/kitchen/orders/${cancelOrderId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "CANCEL", reason }),
        }
      );

      const res = await patchKitchenOrder(req, {
        params: Promise.resolve({ id: cancelOrderId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.order.status).toBe(RestaurantOrderStatus.CANCELLED);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          entityType: "RestaurantOrder",
          entityId: cancelOrderId,
          action: "RESTAURANT_ORDER_CANCELLED",
        },
      });
      expect(audit).not.toBeNull();
      expect(audit?.userId).toBe(managerUser.userId);
    });
  });

  describe("5. 86 List (Dish/Drink Availability Toggle)", () => {
    it("allows kitchen staff to toggle menu item availability (86 list)", async () => {
      mockSessionUser = kitchenUser;

      // 1. Mark Tilapia as 86'd (unavailable)
      const reqOff = new NextRequest("http://localhost:3000/api/admin/restaurant/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: kitchenItemId, isAvailable: false }),
      });

      const resOff = await patchMenuItem(reqOff);
      const jsonOff = await resOff.json();

      expect(resOff.status).toBe(200);
      expect(jsonOff.success).toBe(true);
      expect(jsonOff.data.item.isAvailable).toBe(false);

      // Verify placing an order with this 86'd item fails server-side
      await expect(
        createRestaurantOrder({
          type: RestaurantOrderType.DINE_IN,
          tableId: testTableId,
          items: [{ itemId: kitchenItemId, quantity: 1 }],
          user: adminUser,
        })
      ).rejects.toThrow(/is currently unavailable/);

      // 2. Restore item availability (back in stock)
      const reqOn = new NextRequest("http://localhost:3000/api/admin/restaurant/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: kitchenItemId, isAvailable: true }),
      });

      const resOn = await patchMenuItem(reqOn);
      const jsonOn = await resOn.json();

      expect(resOn.status).toBe(200);
      expect(jsonOn.success).toBe(true);
      expect(jsonOn.data.item.isAvailable).toBe(true);

      // Verify ordering is restored
      const restoredOrder = await createRestaurantOrder({
        type: RestaurantOrderType.DINE_IN,
        tableId: testTableId,
        items: [{ itemId: kitchenItemId, quantity: 1 }],
        user: adminUser,
      });
      expect(restoredOrder.id).toBeDefined();
    });
  });

  describe("6. KDS Settings & Live Timers", () => {
    it("returns configured kdsAmberMinutes and kdsRedMinutes in kitchen API", async () => {
      mockSessionUser = kitchenUser;

      // Update settings to custom thresholds
      await saveSettings(
        {
          kdsAmberMinutes: 12,
          kdsRedMinutes: 24,
        },
        { id: adminUser.userId, role: ROLES.OWNER_ADMIN, name: "Admin Owner" }
      );

      const req = new NextRequest("http://localhost:3000/api/restaurant/kitchen/orders");
      const res = await getKitchenOrders(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.settings.kdsAmberMinutes).toBe(12);
      expect(json.data.settings.kdsRedMinutes).toBe(24);
    });
  });
});
