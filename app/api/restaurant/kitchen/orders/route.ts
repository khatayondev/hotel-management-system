import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { ROLES, UserRole } from "@/lib/rbac";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { getRestaurantOrders } from "@/lib/restaurant/orders";
import { getSettings } from "@/lib/settings";
import { PrepStation, RestaurantOrderStatus } from "@prisma/client";

const KITCHEN_ALLOWED_ROLES: UserRole[] = [
  ROLES.KITCHEN,
  ROLES.MANAGER,
  ROLES.OWNER_ADMIN,
];

/**
 * GET /api/restaurant/kitchen/orders
 * Returns active KDS tickets filtered by PrepStation (KITCHEN vs BAR).
 * Gated strictly to KITCHEN, MANAGER, and OWNER_ADMIN.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    if (!KITCHEN_ALLOWED_ROLES.includes(session.role)) {
      return errorResponse(
        "Forbidden: Kitchen Display System is restricted to Kitchen staff and Management",
        "FORBIDDEN",
        403
      );
    }

    const { searchParams } = new URL(req.url);
    const stationParam = searchParams.get("station")?.toUpperCase();

    let stationFilter: PrepStation | undefined = undefined;
    if (stationParam === "BAR" || stationParam === "KITCHEN") {
      stationFilter = stationParam as PrepStation;
    }

    // Load active orders: PLACED, ACCEPTED, PREPARING, READY
    const allActive = await getRestaurantOrders({
      station: stationFilter,
      isKitchenView: true,
    });

    // Filter to active workflow states
    const activeStates: RestaurantOrderStatus[] = [
      RestaurantOrderStatus.PLACED,
      RestaurantOrderStatus.ACCEPTED,
      RestaurantOrderStatus.PREPARING,
      RestaurantOrderStatus.READY,
    ];

    const orders = allActive.filter((o) => activeStates.includes(o.status));

    // Also return KDS settings for timers
    const settings = await getSettings();

    return successResponse({
      orders,
      station: stationFilter || "ALL",
      settings: {
        kdsAmberMinutes: settings.kdsAmberMinutes,
        kdsRedMinutes: settings.kdsRedMinutes,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
