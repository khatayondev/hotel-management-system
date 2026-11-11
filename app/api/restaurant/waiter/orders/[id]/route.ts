import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { ROLES, UserRole } from "@/lib/rbac";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { updateOrderStatus } from "@/lib/restaurant/orders";
import { RestaurantOrderStatus } from "@prisma/client";
import { z } from "zod";

const WAITER_ALLOWED_ROLES: UserRole[] = [
  ROLES.WAITER,
  ROLES.FRONT_DESK,
  ROLES.MANAGER,
  ROLES.OWNER_ADMIN,
];

const waiterActionSchema = z.object({
  status: z.nativeEnum(RestaurantOrderStatus).optional(),
  action: z.enum(["SERVE"]).optional(),
});

/**
 * PATCH /api/restaurant/waiter/orders/[id]
 * Advances an order from READY to SERVED.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    if (!WAITER_ALLOWED_ROLES.includes(session.role)) {
      return errorResponse("Forbidden", "FORBIDDEN", 403);
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = waiterActionSchema.parse(body);

    const targetStatus =
      parsed.action === "SERVE"
        ? RestaurantOrderStatus.SERVED
        : parsed.status || RestaurantOrderStatus.SERVED;

    const updated = await updateOrderStatus({
      orderId: id,
      newStatus: targetStatus,
      user: session,
    });

    return successResponse({ order: updated }, `Order marked as ${targetStatus}`);
  } catch (err) {
    return handleRouteError(err);
  }
}
