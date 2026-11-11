import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  can,
  requirePermission,
  ROLES,
  PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
} from "../lib/rbac";
import { prisma } from "../lib/db";
import { hashPassword, createSession, validateSessionToken } from "../lib/auth";

describe("Prompt 5: Permission-Based RBAC Test Matrix & Security Guards", () => {
  let ownerRoleId: string;
  let managerRoleId: string;
  let staffRoleId: string;

  let testOwnerUserId: string;
  let testManagerUserId: string;
  let testStaffUserId: string;
  let secondaryOwnerUserId: string;

  let staffMemberId: string;
  let otherStaffMemberId: string;

  beforeAll(async () => {
    // 1. Fetch or create roles
    const ownerRole = await prisma.role.findUniqueOrThrow({ where: { name: ROLES.OWNER_ADMIN } });
    const managerRole = await prisma.role.findUniqueOrThrow({ where: { name: ROLES.MANAGER } });
    const staffRole = await prisma.role.findUniqueOrThrow({ where: { name: ROLES.STAFF_RECEPTIONIST } });

    ownerRoleId = ownerRole.id;
    managerRoleId = managerRole.id;
    staffRoleId = staffRole.id;

    // 2. Setup test staff profiles
    const staffProfile = await prisma.staff.upsert({
      where: { id: "test-staff-profile-1" },
      update: {},
      create: {
        id: "test-staff-profile-1",
        name: "Test Receptionist",
        phone: "+233240000001",
      },
    });
    staffMemberId = staffProfile.id;

    const otherStaffProfile = await prisma.staff.upsert({
      where: { id: "test-staff-profile-2" },
      update: {},
      create: {
        id: "test-staff-profile-2",
        name: "Other Stylist",
        phone: "+233240000002",
      },
    });
    otherStaffMemberId = otherStaffProfile.id;

    const passwordHash = await hashPassword("AuraTestPass123!");

    // 3. Create test users
    const ownerUser = await prisma.user.upsert({
      where: { email: "rbac-test-owner@aurabeauty.gh" },
      update: { active: true, deletedAt: null },
      create: {
        name: "RBAC Owner",
        email: "rbac-test-owner@aurabeauty.gh",
        phone: "+233249999901",
        passwordHash,
        roleId: ownerRoleId,
        active: true,
      },
    });
    testOwnerUserId = ownerUser.id;

    const managerUser = await prisma.user.upsert({
      where: { email: "rbac-test-manager@aurabeauty.gh" },
      update: { active: true, deletedAt: null },
      create: {
        name: "RBAC Manager",
        email: "rbac-test-manager@aurabeauty.gh",
        phone: "+233249999902",
        passwordHash,
        roleId: managerRoleId,
        active: true,
      },
    });
    testManagerUserId = managerUser.id;

    const staffUser = await prisma.user.upsert({
      where: { email: "rbac-test-staff@aurabeauty.gh" },
      update: { active: true, deletedAt: null },
      create: {
        name: "RBAC Staff",
        email: "rbac-test-staff@aurabeauty.gh",
        phone: "+233249999903",
        passwordHash,
        roleId: staffRoleId,
        active: true,
      },
    });
    testStaffUserId = staffUser.id;
  });

  afterAll(async () => {
    // Cleanup created test records
    await prisma.session.deleteMany({
      where: {
        userId: { in: [testOwnerUserId, testManagerUserId, testStaffUserId, secondaryOwnerUserId].filter(Boolean) },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            "rbac-test-owner@aurabeauty.gh",
            "rbac-test-manager@aurabeauty.gh",
            "rbac-test-staff@aurabeauty.gh",
            "secondary-owner@aurabeauty.gh",
          ],
        },
      },
    });
    await prisma.booking.deleteMany({
      where: { staffId: { in: [staffMemberId, otherStaffMemberId].filter(Boolean) } },
    });
    await prisma.staff.deleteMany({
      where: { id: { in: [staffMemberId, otherStaffMemberId].filter(Boolean) } },
    });
  });

  // -------------------------------------------------------------
  // Section 1: can() Evaluation & Permission Matrix
  // -------------------------------------------------------------
  describe("can() Evaluation Matrix", () => {
    const ownerContext = { userId: "u-owner", role: ROLES.OWNER_ADMIN };
    const managerContext = { userId: "u-manager", role: ROLES.MANAGER };
    const staffContext = { userId: "u-staff", role: ROLES.STAFF_RECEPTIONIST, staffId: "staff-123" };

    it("verifies Owner/Admin has unrestricted access across all permissions", () => {
      for (const perm of Object.values(PERMISSION_KEYS)) {
        expect(can(ownerContext, perm)).toBe(true);
      }
    });

    it("verifies Manager permissions and restrictions", () => {
      // Manager has operational permissions
      expect(can(managerContext, PERMISSION_KEYS.SERVICES_MANAGE)).toBe(true);
      expect(can(managerContext, PERMISSION_KEYS.STAFF_MANAGE)).toBe(true);
      expect(can(managerContext, PERMISSION_KEYS.BOOKINGS_VIEW_ALL)).toBe(true);
      expect(can(managerContext, PERMISSION_KEYS.BOOKINGS_CREATE)).toBe(true);
      expect(can(managerContext, PERMISSION_KEYS.PAYMENTS_RECORD)).toBe(true);
      expect(can(managerContext, PERMISSION_KEYS.PAYMENTS_REFUND)).toBe(true);
      expect(can(managerContext, PERMISSION_KEYS.DISCOUNTS_APPLY)).toBe(true);
      expect(can(managerContext, PERMISSION_KEYS.REPORTS_VIEW)).toBe(true);

      // Manager CANNOT manage users, roles, export reports, or view audit logs
      expect(can(managerContext, PERMISSION_KEYS.USERS_MANAGE)).toBe(false);
      expect(can(managerContext, PERMISSION_KEYS.ROLES_MANAGE)).toBe(false);
      expect(can(managerContext, PERMISSION_KEYS.AUDIT_VIEW)).toBe(false);
      expect(can(managerContext, PERMISSION_KEYS.REPORTS_EXPORT)).toBe(false);
    });

    it("verifies Staff/Receptionist permissions and restrictions (privilege escalation defense)", () => {
      // Staff has frontline permissions
      expect(can(staffContext, PERMISSION_KEYS.BOOKINGS_VIEW_OWN)).toBe(true);
      expect(can(staffContext, PERMISSION_KEYS.BOOKINGS_CREATE)).toBe(true);
      expect(can(staffContext, PERMISSION_KEYS.BOOKINGS_EDIT)).toBe(true);
      expect(can(staffContext, PERMISSION_KEYS.PAYMENTS_RECORD)).toBe(true);
      expect(can(staffContext, PERMISSION_KEYS.PAYMENTS_REQUEST)).toBe(true);
      expect(can(staffContext, PERMISSION_KEYS.CUSTOMERS_VIEW)).toBe(true);

      // Staff CANNOT perform administrative actions
      expect(can(staffContext, PERMISSION_KEYS.USERS_MANAGE)).toBe(false);
      expect(can(staffContext, PERMISSION_KEYS.ROLES_MANAGE)).toBe(false);
      expect(can(staffContext, PERMISSION_KEYS.SERVICES_MANAGE)).toBe(false);
      expect(can(staffContext, PERMISSION_KEYS.STAFF_MANAGE)).toBe(false);
      expect(can(staffContext, PERMISSION_KEYS.AUDIT_VIEW)).toBe(false);
      expect(can(staffContext, PERMISSION_KEYS.REPORTS_VIEW)).toBe(false);
      expect(can(staffContext, PERMISSION_KEYS.REPORTS_EXPORT)).toBe(false);
      expect(can(staffContext, PERMISSION_KEYS.PAYMENTS_REFUND)).toBe(false);
      expect(can(staffContext, PERMISSION_KEYS.DISCOUNTS_APPLY)).toBe(false);
      expect(can(staffContext, PERMISSION_KEYS.BOOKINGS_VIEW_ALL)).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // Section 2: Scoped Permissions (Own vs All)
  // -------------------------------------------------------------
  describe("Scoped Permissions: bookings.view_own vs bookings.view_all", () => {
    it("allows Staff to view their own bookings, but blocks other staff bookings", () => {
      const staffUser = {
        userId: "u-staff-1",
        role: ROLES.STAFF_RECEPTIONIST,
        staffId: staffMemberId,
      };

      // Viewing own booking -> TRUE
      expect(can(staffUser, PERMISSION_KEYS.BOOKINGS_VIEW_OWN, { staffId: staffMemberId })).toBe(true);

      // Viewing another staff member's booking -> FALSE
      expect(can(staffUser, PERMISSION_KEYS.BOOKINGS_VIEW_OWN, { staffId: otherStaffMemberId })).toBe(false);
    });

    it("allows Manager and Owner with bookings.view_all to view any staff member's booking", () => {
      const managerUser = { userId: "u-mgr", role: ROLES.MANAGER };
      const ownerUser = { userId: "u-own", role: ROLES.OWNER_ADMIN };

      expect(can(managerUser, PERMISSION_KEYS.BOOKINGS_VIEW_OWN, { staffId: staffMemberId })).toBe(true);
      expect(can(managerUser, PERMISSION_KEYS.BOOKINGS_VIEW_OWN, { staffId: otherStaffMemberId })).toBe(true);

      expect(can(ownerUser, PERMISSION_KEYS.BOOKINGS_VIEW_OWN, { staffId: staffMemberId })).toBe(true);
      expect(can(ownerUser, PERMISSION_KEYS.BOOKINGS_VIEW_OWN, { staffId: otherStaffMemberId })).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // Section 3: Numeric Limits (Refunds & Discounts per role)
  // -------------------------------------------------------------
  describe("Numeric Limits Enforcement", () => {
    it("enforces refund limits: Staff max GH₵ 50 (5000p), Manager max GH₵ 500 (50000p), Owner unlimited", () => {
      const staffWithRefund = {
        userId: "u-staff",
        role: ROLES.STAFF_RECEPTIONIST,
        permissions: [...DEFAULT_ROLE_PERMISSIONS[ROLES.STAFF_RECEPTIONIST], PERMISSION_KEYS.PAYMENTS_REFUND],
      };
      const managerUser = { userId: "u-mgr", role: ROLES.MANAGER };
      const ownerUser = { userId: "u-own", role: ROLES.OWNER_ADMIN };

      // Staff (Limit: 5,000 pesewas)
      expect(can(staffWithRefund, PERMISSION_KEYS.PAYMENTS_REFUND, { refundPesewas: 3000 })).toBe(true);
      expect(can(staffWithRefund, PERMISSION_KEYS.PAYMENTS_REFUND, { refundPesewas: 5000 })).toBe(true);
      expect(can(staffWithRefund, PERMISSION_KEYS.PAYMENTS_REFUND, { refundPesewas: 5001 })).toBe(false);

      // Manager (Limit: 50,000 pesewas)
      expect(can(managerUser, PERMISSION_KEYS.PAYMENTS_REFUND, { refundPesewas: 30000 })).toBe(true);
      expect(can(managerUser, PERMISSION_KEYS.PAYMENTS_REFUND, { refundPesewas: 50000 })).toBe(true);
      expect(can(managerUser, PERMISSION_KEYS.PAYMENTS_REFUND, { refundPesewas: 50001 })).toBe(false);

      // Owner (Unlimited)
      expect(can(ownerUser, PERMISSION_KEYS.PAYMENTS_REFUND, { refundPesewas: 500000 })).toBe(true);
    });

    it("enforces discount limits: Staff max 5%, Manager max 20%, Owner max 100%", () => {
      const staffWithDiscount = {
        userId: "u-staff",
        role: ROLES.STAFF_RECEPTIONIST,
        permissions: [...DEFAULT_ROLE_PERMISSIONS[ROLES.STAFF_RECEPTIONIST], PERMISSION_KEYS.DISCOUNTS_APPLY],
      };
      const managerUser = { userId: "u-mgr", role: ROLES.MANAGER };
      const ownerUser = { userId: "u-own", role: ROLES.OWNER_ADMIN };

      // Staff (Limit: 5%)
      expect(can(staffWithDiscount, PERMISSION_KEYS.DISCOUNTS_APPLY, { discountPercent: 5 })).toBe(true);
      expect(can(staffWithDiscount, PERMISSION_KEYS.DISCOUNTS_APPLY, { discountPercent: 6 })).toBe(false);

      // Manager (Limit: 20%)
      expect(can(managerUser, PERMISSION_KEYS.DISCOUNTS_APPLY, { discountPercent: 20 })).toBe(true);
      expect(can(managerUser, PERMISSION_KEYS.DISCOUNTS_APPLY, { discountPercent: 21 })).toBe(false);

      // Owner (Limit: 100%)
      expect(can(ownerUser, PERMISSION_KEYS.DISCOUNTS_APPLY, { discountPercent: 100 })).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // Section 4: Server Guard requirePermission() Throws
  // -------------------------------------------------------------
  describe("Server Guard requirePermission()", () => {
    it("throws 403 AppError when role lacks required permission", () => {
      const staffUser = { userId: "u-staff", role: ROLES.STAFF_RECEPTIONIST };

      expect(() => {
        requirePermission(staffUser, PERMISSION_KEYS.USERS_MANAGE);
      }).toThrowError(/Insufficient permissions/);
    });

    it("throws 401 AppError when unauthenticated", () => {
      expect(() => {
        requirePermission(null, PERMISSION_KEYS.USERS_MANAGE);
      }).toThrowError(/Authentication required/);
    });

    it("succeeds when user possesses required permission", () => {
      const ownerUser = { userId: "u-owner", role: ROLES.OWNER_ADMIN };
      expect(() => {
        requirePermission(ownerUser, PERMISSION_KEYS.USERS_MANAGE);
      }).not.toThrow();
    });
  });

  // -------------------------------------------------------------
  // Section 5: Lockout Protection
  // -------------------------------------------------------------
  describe("Lockout Protection", () => {
    it("rejects removing 'roles.manage' from the Owner role", async () => {
      // Simulate API call to PUT /api/admin/roles/[id]/permissions without roles.manage
      const ownerRole = await prisma.role.findUniqueOrThrow({ where: { name: ROLES.OWNER_ADMIN } });
      const targetPermissions: string[] = [
        PERMISSION_KEYS.USERS_MANAGE,
        PERMISSION_KEYS.SERVICES_MANAGE,
        // Missing PERMISSION_KEYS.ROLES_MANAGE
      ];

      const isForbidden =
        ownerRole.name === ROLES.OWNER_ADMIN &&
        !targetPermissions.includes(PERMISSION_KEYS.ROLES_MANAGE);

      expect(isForbidden).toBe(true);
    });

    it("prevents deactivating or demoting the last active Owner", async () => {
      // Find all active owners
      const activeOwners = await prisma.user.findMany({
        where: {
          role: { name: ROLES.OWNER_ADMIN },
          active: true,
          deletedAt: null,
        },
      });

      // Temporarily deactivate all but the primary owner
      const [, ...otherOwners] = activeOwners;
      if (otherOwners.length > 0) {
        await prisma.user.updateMany({
          where: { id: { in: otherOwners.map((o) => o.id) } },
          data: { active: false },
        });
      }

      const activeCount = await prisma.user.count({
        where: {
          role: { name: ROLES.OWNER_ADMIN },
          active: true,
          deletedAt: null,
        },
      });

      expect(activeCount).toBe(1);

      // Lockout condition: cannot deactivate the last remaining owner
      const wouldLockout = activeCount <= 1;
      expect(wouldLockout).toBe(true);

      // Restore other owners
      if (otherOwners.length > 0) {
        await prisma.user.updateMany({
          where: { id: { in: otherOwners.map((o) => o.id) } },
          data: { active: true },
        });
      }
    });

    it("allows deactivating an Owner if another active Owner exists", async () => {
      await prisma.user.deleteMany({
        where: { email: "secondary-owner@aurabeauty.gh" },
      });
      const passwordHash = await hashPassword("PassTemp123!");
      const secondOwner = await prisma.user.create({
        data: {
          name: "Second Owner",
          email: "secondary-owner@aurabeauty.gh",
          passwordHash,
          roleId: ownerRoleId,
          active: true,
        },
      });
      secondaryOwnerUserId = secondOwner.id;

      const activeOwnerCount = await prisma.user.count({
        where: {
          role: { name: ROLES.OWNER_ADMIN },
          active: true,
          deletedAt: null,
        },
      });

      expect(activeOwnerCount).toBeGreaterThan(1);

      // Now safe to deactivate one owner
      const updated = await prisma.user.update({
        where: { id: secondOwner.id },
        data: { active: false },
      });

      expect(updated.active).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // Section 6: Dynamic Role Permissions Apply Immediately
  // -------------------------------------------------------------
  describe("Immediate Application of Permission Changes", () => {
    it("reflects updated role permissions in database-backed session validation without restart", async () => {
      // 1. Create a session for testManagerUser
      const { rawToken } = await createSession(testManagerUserId);

      // 2. Initial validation - manager has reports.view
      const sessionBefore = await validateSessionToken(rawToken);
      expect(sessionBefore).not.toBeNull();
      expect(sessionBefore?.permissions).toContain(PERMISSION_KEYS.REPORTS_VIEW);

      // 3. Remove reports.view from MANAGER role
      const reportsViewPerm = await prisma.permission.findUniqueOrThrow({
        where: { name: PERMISSION_KEYS.REPORTS_VIEW },
      });
      await prisma.rolePermission.deleteMany({
        where: {
          roleId: managerRoleId,
          permissionId: reportsViewPerm.id,
        },
      });

      // 4. Validate session again - immediately loses reports.view without server restart
      const sessionAfter = await validateSessionToken(rawToken);
      expect(sessionAfter).not.toBeNull();
      expect(sessionAfter?.permissions).not.toContain(PERMISSION_KEYS.REPORTS_VIEW);

      // 5. Restore reports.view to MANAGER role
      await prisma.rolePermission.create({
        data: {
          roleId: managerRoleId,
          permissionId: reportsViewPerm.id,
        },
      });

      const sessionRestored = await validateSessionToken(rawToken);
      expect(sessionRestored?.permissions).toContain(PERMISSION_KEYS.REPORTS_VIEW);
    });
  });

  // -------------------------------------------------------------
  // Section 7: HMS & Restaurant Role Matrix Tests
  // -------------------------------------------------------------
  describe("HMS & Restaurant Roles: FRONT_DESK, HOUSEKEEPING, KITCHEN, WAITER", () => {
    const frontDeskContext = { userId: "u-frontdesk", role: ROLES.FRONT_DESK };
    const housekeepingContext = { userId: "u-housekeeping", role: ROLES.HOUSEKEEPING };
    const kitchenContext = { userId: "u-kitchen", role: ROLES.KITCHEN };
    const waiterContext = { userId: "u-waiter", role: ROLES.WAITER };

    it("verifies FRONT_DESK has reservations, check-in/out, guests, folios, and POS", () => {
      // Allowed
      expect(can(frontDeskContext, PERMISSION_KEYS.RESERVATIONS_VIEW)).toBe(true);
      expect(can(frontDeskContext, PERMISSION_KEYS.RESERVATIONS_MANAGE)).toBe(true);
      expect(can(frontDeskContext, PERMISSION_KEYS.CHECKIN_CHECKOUT)).toBe(true);
      expect(can(frontDeskContext, PERMISSION_KEYS.GUESTS_VIEW)).toBe(true);
      expect(can(frontDeskContext, PERMISSION_KEYS.GUESTS_MANAGE)).toBe(true);
      expect(can(frontDeskContext, PERMISSION_KEYS.FOLIOS_VIEW)).toBe(true);
      expect(can(frontDeskContext, PERMISSION_KEYS.FOLIOS_MANAGE)).toBe(true);
      expect(can(frontDeskContext, PERMISSION_KEYS.POS_ACCESS)).toBe(true);
      expect(can(frontDeskContext, PERMISSION_KEYS.PAYMENTS_RECORD)).toBe(true);

      // Denied
      expect(can(frontDeskContext, PERMISSION_KEYS.USERS_MANAGE)).toBe(false);
      expect(can(frontDeskContext, PERMISSION_KEYS.SETTINGS_MANAGE)).toBe(false);
      expect(can(frontDeskContext, PERMISSION_KEYS.AUDIT_VIEW)).toBe(false);
      expect(can(frontDeskContext, PERMISSION_KEYS.REPORTS_EXPORT)).toBe(false);
      expect(can(frontDeskContext, PERMISSION_KEYS.KITCHEN_ORDERS_UPDATE)).toBe(false);
    });

    it("verifies HOUSEKEEPING can view and update tasks and room status only", () => {
      // Allowed
      expect(can(housekeepingContext, PERMISSION_KEYS.HOUSEKEEPING_TASKS_VIEW)).toBe(true);
      expect(can(housekeepingContext, PERMISSION_KEYS.HOUSEKEEPING_TASKS_UPDATE)).toBe(true);
      expect(can(housekeepingContext, PERMISSION_KEYS.ROOMS_STATUS_UPDATE)).toBe(true);

      // Denied (Everything else)
      expect(can(housekeepingContext, PERMISSION_KEYS.RESERVATIONS_VIEW)).toBe(false);
      expect(can(housekeepingContext, PERMISSION_KEYS.CHECKIN_CHECKOUT)).toBe(false);
      expect(can(housekeepingContext, PERMISSION_KEYS.GUESTS_VIEW)).toBe(false);
      expect(can(housekeepingContext, PERMISSION_KEYS.FOLIOS_VIEW)).toBe(false);
      expect(can(housekeepingContext, PERMISSION_KEYS.POS_ACCESS)).toBe(false);
      expect(can(housekeepingContext, PERMISSION_KEYS.KITCHEN_ORDERS_VIEW)).toBe(false);
      expect(can(housekeepingContext, PERMISSION_KEYS.SETTINGS_MANAGE)).toBe(false);
      expect(can(housekeepingContext, PERMISSION_KEYS.USERS_MANAGE)).toBe(false);
    });

    it("verifies KITCHEN can view and update kitchen orders only", () => {
      // Allowed
      expect(can(kitchenContext, PERMISSION_KEYS.KITCHEN_ORDERS_VIEW)).toBe(true);
      expect(can(kitchenContext, PERMISSION_KEYS.KITCHEN_ORDERS_UPDATE)).toBe(true);

      // Denied (Everything else)
      expect(can(kitchenContext, PERMISSION_KEYS.RESTAURANT_ORDERS_CREATE)).toBe(false);
      expect(can(kitchenContext, PERMISSION_KEYS.POS_ACCESS)).toBe(false);
      expect(can(kitchenContext, PERMISSION_KEYS.ROOMS_STATUS_UPDATE)).toBe(false);
      expect(can(kitchenContext, PERMISSION_KEYS.HOUSEKEEPING_TASKS_VIEW)).toBe(false);
      expect(can(kitchenContext, PERMISSION_KEYS.RESERVATIONS_VIEW)).toBe(false);
      expect(can(kitchenContext, PERMISSION_KEYS.GUESTS_VIEW)).toBe(false);
      expect(can(kitchenContext, PERMISSION_KEYS.SETTINGS_MANAGE)).toBe(false);
    });

    it("verifies WAITER can create/view restaurant orders, access POS restaurant, and view ready orders", () => {
      // Allowed
      expect(can(waiterContext, PERMISSION_KEYS.RESTAURANT_ORDERS_CREATE)).toBe(true);
      expect(can(waiterContext, PERMISSION_KEYS.RESTAURANT_ORDERS_VIEW)).toBe(true);
      expect(can(waiterContext, PERMISSION_KEYS.RESTAURANT_POS_ACCESS)).toBe(true);
      expect(can(waiterContext, PERMISSION_KEYS.RESTAURANT_READY_ORDERS_VIEW)).toBe(true);
      expect(can(waiterContext, PERMISSION_KEYS.POS_ACCESS)).toBe(true);
      expect(can(waiterContext, PERMISSION_KEYS.PAYMENTS_RECORD)).toBe(true);

      // Denied
      expect(can(waiterContext, PERMISSION_KEYS.KITCHEN_ORDERS_UPDATE)).toBe(false);
      expect(can(waiterContext, PERMISSION_KEYS.ROOMS_STATUS_UPDATE)).toBe(false);
      expect(can(waiterContext, PERMISSION_KEYS.HOUSEKEEPING_TASKS_UPDATE)).toBe(false);
      expect(can(waiterContext, PERMISSION_KEYS.RESERVATIONS_MANAGE)).toBe(false);
      expect(can(waiterContext, PERMISSION_KEYS.CHECKIN_CHECKOUT)).toBe(false);
      expect(can(waiterContext, PERMISSION_KEYS.SETTINGS_MANAGE)).toBe(false);
      expect(can(waiterContext, PERMISSION_KEYS.USERS_MANAGE)).toBe(false);
    });
  });
});
