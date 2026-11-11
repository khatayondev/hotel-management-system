/**
 * Role-Based Access Control (RBAC) System.
 * Strict Server-Side Evaluation with Scoped Permissions and Numeric Limits.
 * Rule: Hiding a UI button is never the security; the server always validates every action.
 */

import { AppError } from "./api-response";

export const ROLES = {
  OWNER_ADMIN: "OWNER_ADMIN",
  MANAGER: "MANAGER",
  STAFF_RECEPTIONIST: "STAFF_RECEPTIONIST",
  FRONT_DESK: "FRONT_DESK",
  HOUSEKEEPING: "HOUSEKEEPING",
  KITCHEN: "KITCHEN",
  WAITER: "WAITER",
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_HIERARCHY_LEVELS: Record<UserRole, number> = {
  [ROLES.OWNER_ADMIN]: 1,
  [ROLES.MANAGER]: 2,
  [ROLES.FRONT_DESK]: 3,
  [ROLES.STAFF_RECEPTIONIST]: 4,
  [ROLES.WAITER]: 4,
  [ROLES.HOUSEKEEPING]: 5,
  [ROLES.KITCHEN]: 5,
};

export const PERMISSION_KEYS = {
  USERS_MANAGE: "users.manage",
  ROLES_MANAGE: "roles.manage",
  SERVICES_MANAGE: "services.manage",
  STAFF_MANAGE: "staff.manage",
  BOOKINGS_VIEW_ALL: "bookings.view_all",
  BOOKINGS_VIEW_OWN: "bookings.view_own",
  BOOKINGS_CREATE: "bookings.create",
  BOOKINGS_EDIT: "bookings.edit",
  BOOKINGS_CANCEL: "bookings.cancel",
  PAYMENTS_RECORD: "payments.record",
  PAYMENTS_REQUEST: "payments.request",
  PAYMENTS_REFUND: "payments.refund",
  DISCOUNTS_APPLY: "discounts.apply",
  REPORTS_VIEW: "reports.view",
  REPORTS_EXPORT: "reports.export",
  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_EDIT: "customers.edit",
  CUSTOMERS_MERGE: "customers.merge",
  CUSTOMERS_EXPORT: "customers.export",
  CUSTOMERS_DELETE: "customers.delete",
  SETTINGS_MANAGE: "settings.manage",
  AUDIT_VIEW: "audit.view",

  // HMS & Restaurant Permissions
  RESERVATIONS_VIEW: "reservations.view",
  RESERVATIONS_MANAGE: "reservations.manage",
  CHECKIN_CHECKOUT: "checkin_checkout.manage",
  GUESTS_VIEW: "guests.view",
  GUESTS_MANAGE: "guests.manage",
  FOLIOS_VIEW: "folios.view",
  FOLIOS_MANAGE: "folios.manage",
  POS_ACCESS: "pos.access",
  HOUSEKEEPING_TASKS_VIEW: "housekeeping.tasks_view",
  HOUSEKEEPING_TASKS_UPDATE: "housekeeping.tasks_update",
  ROOMS_STATUS_UPDATE: "rooms.status_update",
  KITCHEN_ORDERS_VIEW: "kitchen.orders_view",
  KITCHEN_ORDERS_UPDATE: "kitchen.orders_update",
  RESTAURANT_ORDERS_CREATE: "restaurant.orders_create",
  RESTAURANT_ORDERS_VIEW: "restaurant.orders_view",
  RESTAURANT_POS_ACCESS: "restaurant.pos_access",
  RESTAURANT_READY_ORDERS_VIEW: "restaurant.ready_orders_view",
} as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[keyof typeof PERMISSION_KEYS];

export interface RoleLimits {
  maxRefundPesewas: number; // e.g. 50000 = GH₵ 500
  maxDiscountPercent: number; // e.g. 20 = 20%
}

export const ROLE_DEFAULT_LIMITS: Record<UserRole, RoleLimits> = {
  [ROLES.OWNER_ADMIN]: {
    maxRefundPesewas: Number.POSITIVE_INFINITY,
    maxDiscountPercent: 100,
  },
  [ROLES.MANAGER]: {
    maxRefundPesewas: 50000, // GH₵ 500.00 max refund
    maxDiscountPercent: 20, // 20% max discount
  },
  [ROLES.FRONT_DESK]: {
    maxRefundPesewas: 5000, // GH₵ 50.00 max refund
    maxDiscountPercent: 5, // 5% max discount
  },
  [ROLES.STAFF_RECEPTIONIST]: {
    maxRefundPesewas: 5000, // GH₵ 50.00 max refund
    maxDiscountPercent: 5, // 5% max discount
  },
  [ROLES.WAITER]: {
    maxRefundPesewas: 0,
    maxDiscountPercent: 0,
  },
  [ROLES.HOUSEKEEPING]: {
    maxRefundPesewas: 0,
    maxDiscountPercent: 0,
  },
  [ROLES.KITCHEN]: {
    maxRefundPesewas: 0,
    maxDiscountPercent: 0,
  },
};

/**
 * Default base permissions assigned upon initialization.
 * Dynamic permissions can be enabled/disabled per role via the database.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  [ROLES.OWNER_ADMIN]: Object.values(PERMISSION_KEYS),
  [ROLES.MANAGER]: [
    PERMISSION_KEYS.SERVICES_MANAGE,
    PERMISSION_KEYS.STAFF_MANAGE,
    PERMISSION_KEYS.BOOKINGS_VIEW_ALL,
    PERMISSION_KEYS.BOOKINGS_VIEW_OWN,
    PERMISSION_KEYS.BOOKINGS_CREATE,
    PERMISSION_KEYS.BOOKINGS_EDIT,
    PERMISSION_KEYS.BOOKINGS_CANCEL,
    PERMISSION_KEYS.PAYMENTS_RECORD,
    PERMISSION_KEYS.PAYMENTS_REQUEST,
    PERMISSION_KEYS.PAYMENTS_REFUND,
    PERMISSION_KEYS.DISCOUNTS_APPLY,
    PERMISSION_KEYS.REPORTS_VIEW,
    PERMISSION_KEYS.CUSTOMERS_VIEW,
    PERMISSION_KEYS.CUSTOMERS_EDIT,
    PERMISSION_KEYS.CUSTOMERS_MERGE,
    PERMISSION_KEYS.CUSTOMERS_EXPORT,
    PERMISSION_KEYS.SETTINGS_MANAGE,
    // HMS permissions for manager
    PERMISSION_KEYS.RESERVATIONS_VIEW,
    PERMISSION_KEYS.RESERVATIONS_MANAGE,
    PERMISSION_KEYS.CHECKIN_CHECKOUT,
    PERMISSION_KEYS.GUESTS_VIEW,
    PERMISSION_KEYS.GUESTS_MANAGE,
    PERMISSION_KEYS.FOLIOS_VIEW,
    PERMISSION_KEYS.FOLIOS_MANAGE,
    PERMISSION_KEYS.POS_ACCESS,
    PERMISSION_KEYS.HOUSEKEEPING_TASKS_VIEW,
    PERMISSION_KEYS.HOUSEKEEPING_TASKS_UPDATE,
    PERMISSION_KEYS.ROOMS_STATUS_UPDATE,
    PERMISSION_KEYS.KITCHEN_ORDERS_VIEW,
    PERMISSION_KEYS.KITCHEN_ORDERS_UPDATE,
    PERMISSION_KEYS.RESTAURANT_ORDERS_CREATE,
    PERMISSION_KEYS.RESTAURANT_ORDERS_VIEW,
    PERMISSION_KEYS.RESTAURANT_POS_ACCESS,
    PERMISSION_KEYS.RESTAURANT_READY_ORDERS_VIEW,
  ],
  [ROLES.FRONT_DESK]: [
    // Reservations, check-in/out, guests, folios, POS
    PERMISSION_KEYS.RESERVATIONS_VIEW,
    PERMISSION_KEYS.RESERVATIONS_MANAGE,
    PERMISSION_KEYS.CHECKIN_CHECKOUT,
    PERMISSION_KEYS.GUESTS_VIEW,
    PERMISSION_KEYS.GUESTS_MANAGE,
    PERMISSION_KEYS.FOLIOS_VIEW,
    PERMISSION_KEYS.FOLIOS_MANAGE,
    PERMISSION_KEYS.POS_ACCESS,
    PERMISSION_KEYS.PAYMENTS_RECORD,
    PERMISSION_KEYS.PAYMENTS_REQUEST,
    PERMISSION_KEYS.DISCOUNTS_APPLY,
    // Backward compatibility with booking/customer views
    PERMISSION_KEYS.BOOKINGS_VIEW_ALL,
    PERMISSION_KEYS.BOOKINGS_VIEW_OWN,
    PERMISSION_KEYS.BOOKINGS_CREATE,
    PERMISSION_KEYS.BOOKINGS_EDIT,
    PERMISSION_KEYS.BOOKINGS_CANCEL,
    PERMISSION_KEYS.CUSTOMERS_VIEW,
    PERMISSION_KEYS.CUSTOMERS_EDIT,
  ],
  [ROLES.STAFF_RECEPTIONIST]: [
    PERMISSION_KEYS.BOOKINGS_VIEW_OWN,
    PERMISSION_KEYS.BOOKINGS_CREATE,
    PERMISSION_KEYS.BOOKINGS_EDIT,
    PERMISSION_KEYS.PAYMENTS_RECORD,
    PERMISSION_KEYS.PAYMENTS_REQUEST,
    PERMISSION_KEYS.CUSTOMERS_VIEW,
    PERMISSION_KEYS.CUSTOMERS_EDIT,
  ],
  [ROLES.HOUSEKEEPING]: [
    // View and update housekeeping tasks and room status only
    PERMISSION_KEYS.HOUSEKEEPING_TASKS_VIEW,
    PERMISSION_KEYS.HOUSEKEEPING_TASKS_UPDATE,
    PERMISSION_KEYS.ROOMS_STATUS_UPDATE,
  ],
  [ROLES.KITCHEN]: [
    // View and update kitchen orders only
    PERMISSION_KEYS.KITCHEN_ORDERS_VIEW,
    PERMISSION_KEYS.KITCHEN_ORDERS_UPDATE,
  ],
  [ROLES.WAITER]: [
    // Create and view restaurant orders, POS restaurant, view ready orders
    PERMISSION_KEYS.RESTAURANT_ORDERS_CREATE,
    PERMISSION_KEYS.RESTAURANT_ORDERS_VIEW,
    PERMISSION_KEYS.RESTAURANT_POS_ACCESS,
    PERMISSION_KEYS.RESTAURANT_READY_ORDERS_VIEW,
    PERMISSION_KEYS.POS_ACCESS,
    PERMISSION_KEYS.PAYMENTS_RECORD,
  ],
};

export interface PermissionContextUser {
  userId: string;
  role: UserRole;
  staffId?: string | null;
  permissions?: PermissionKey[];
  name?: string;
  email?: string;
}

export interface ResourceContext {
  staffId?: string | null;
  refundPesewas?: number;
  discountPercent?: number;
  targetRole?: UserRole;
}

/**
 * Server-side evaluation: can(user, permission, resource?)
 * Evaluates role permissions, scope, and numeric limits.
 */
export function can(
  user: PermissionContextUser | null | undefined,
  permission: PermissionKey,
  resource?: ResourceContext
): boolean {
  if (!user || !user.role) {
    return false;
  }

  // 1. Check if user's role possesses the permission
  const userPermissions = user.permissions || DEFAULT_ROLE_PERMISSIONS[user.role] || [];
  const hasBasePermission = userPermissions.includes(permission);

  // If user is checking view_own and has view_all, allow
  if (permission === PERMISSION_KEYS.BOOKINGS_VIEW_OWN && userPermissions.includes(PERMISSION_KEYS.BOOKINGS_VIEW_ALL)) {
    return true;
  }

  if (!hasBasePermission) {
    return false;
  }

  // 2. Scoped check: bookings.view_own (if user does not have view_all)
  if (permission === PERMISSION_KEYS.BOOKINGS_VIEW_OWN) {
    if (!userPermissions.includes(PERMISSION_KEYS.BOOKINGS_VIEW_ALL)) {
      if (resource?.staffId && user.staffId && resource.staffId !== user.staffId) {
        return false;
      }
    }
  }

  // 3. Numeric limits: refunds
  if (permission === PERMISSION_KEYS.PAYMENTS_REFUND && resource?.refundPesewas !== undefined) {
    const limits = ROLE_DEFAULT_LIMITS[user.role];
    if (resource.refundPesewas > limits.maxRefundPesewas) {
      return false;
    }
  }

  // 4. Numeric limits: discounts
  if (permission === PERMISSION_KEYS.DISCOUNTS_APPLY && resource?.discountPercent !== undefined) {
    const limits = ROLE_DEFAULT_LIMITS[user.role];
    if (resource.discountPercent > limits.maxDiscountPercent) {
      return false;
    }
  }

  // 5. Hierarchy check for managing users/roles: cannot manage users of equal or higher level
  if ((permission === PERMISSION_KEYS.USERS_MANAGE || permission === PERMISSION_KEYS.ROLES_MANAGE) && resource?.targetRole) {
    const actorLevel = ROLE_HIERARCHY_LEVELS[user.role];
    const targetLevel = ROLE_HIERARCHY_LEVELS[resource.targetRole];
    // Level 1 = Owner, Level 2 = Manager, Level 3 = Staff. Smaller number = higher rank.
    if (actorLevel >= targetLevel && user.role !== ROLES.OWNER_ADMIN) {
      return false;
    }
  }

  return true;
}

/**
 * Enforces permission on server. Throws AppError(403) if authorization fails.
 */
export function requirePermission(
  user: PermissionContextUser | null | undefined,
  permission: PermissionKey,
  resource?: ResourceContext
): void {
  if (!user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }

  if (!can(user, permission, resource)) {
    throw new AppError(
      `Forbidden: Insufficient permissions for "${permission}"`,
      403,
      "FORBIDDEN",
      { requiredPermission: permission, userRole: user.role }
    );
  }
}

/**
 * Backward compatibility alias for Prompt 1 test helpers.
 */
export const PERMISSIONS = {
  ...PERMISSION_KEYS,
  AUDIT_LOG_READ: PERMISSION_KEYS.AUDIT_VIEW,
  POS_ACCESS: PERMISSION_KEYS.PAYMENTS_RECORD,
} as const;

export function hasPermission(role: UserRole, permission: PermissionKey | string): boolean {
  return can({ userId: "mock", role }, permission as PermissionKey);
}
