import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { ROLES, UserRole } from "@/lib/rbac";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { getRestaurantOrders } from "@/lib/restaurant/orders";
import { RestaurantOrderStatus } from "@prisma/client";

const WAITER_ALLOWED_ROLES: UserRole[] = [
  ROLES.WAITER,
  ROLES.FRONT_DESK,
  ROLES.MANAGER,
  ROLES.OWNER_ADMIN,
];

/**
 * GET /api/restaurant/waiter/orders
 * Returns orders for the floor waiter view (defaulting to READY orders awaiting service).
 * Gated to WAITER, FRONT_DESK, MANAGER, OWNER_ADMIN.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    if (!WAITER_ALLOWED_ROLES.includes(session.role)) {
      return errorResponse(
        "Forbidden: Waiter View is restricted to Waiters, Front Desk, and Management",
        "FORBIDDEN",
        403
      );
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") as RestaurantOrderStatus | null;

    // Default to READY if not specified, or allow all active
    let filterStatus: RestaurantOrderStatus | undefined = undefined;
    if (statusParam) {
      filterStatus = statusParam;
    }

    const allOrders = await getRestaurantOrders({
      status: filterStatus,
    });

    // If no specific status query, default to active floor orders (READY + PREPARING)
    const activeFloor = filterStatus
      ? allOrders
      : allOrders.filter((o) =>
          (
            [
              RestaurantOrderStatus.READY,
              RestaurantOrderStatus.PREPARING,
              RestaurantOrderStatus.SERVED,
            ] as RestaurantOrderStatus[]
          ).includes(o.status)
        );

    return successResponse({
      orders: activeFloor,
      counts: {
        ready: allOrders.filter((o) => o.status === RestaurantOrderStatus.READY).length,
        preparing: allOrders.filter((o) => o.status === RestaurantOrderStatus.PREPARING).length,
        servedToday: allOrders.filter((o) => o.status === RestaurantOrderStatus.SERVED).length,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
