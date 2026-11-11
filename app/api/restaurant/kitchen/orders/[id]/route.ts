import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth";
import { ROLES, UserRole } from "@/lib/rbac";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { updateOrderStatus, cancelRestaurantOrder } from "@/lib/restaurant/orders";
import { RestaurantOrderStatus } from "@prisma/client";
import { z } from "zod";

const KITCHEN_ALLOWED_ROLES: UserRole[] = [
  ROLES.KITCHEN,
  ROLES.MANAGER,
  ROLES.OWNER_ADMIN,
];

const kitchenActionSchema = z.object({
  status: z.nativeEnum(RestaurantOrderStatus).optional(),
  action: z.enum(["START", "READY", "CANCEL"]).optional(),
  reason: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    if (!KITCHEN_ALLOWED_ROLES.includes(session.role)) {
      return errorResponse("Forbidden", "FORBIDDEN", 403);
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = kitchenActionSchema.parse(body);

    // 1. Cancellation branch
    if (parsed.action === "CANCEL" || parsed.status === RestaurantOrderStatus.CANCELLED) {
      const isManagerOrAdmin =
        session.role === ROLES.MANAGER || session.role === ROLES.OWNER_ADMIN;

      if (!isManagerOrAdmin) {
        return errorResponse(
          "Only Managers or Administrators can cancel restaurant tickets from the KDS screen",
          "MANAGER_OVERRIDE_REQUIRED",
          403
        );
      }

      if (!parsed.reason?.trim()) {
        return errorResponse("Cancellation reason is required", "REASON_REQUIRED", 400);
      }

      const cancelled = await cancelRestaurantOrder({
        orderId: id,
        reason: parsed.reason.trim(),
        user: session,
      });

      return successResponse({ order: cancelled }, "Order ticket cancelled");
    }

    // 2. Status Progression (START -> PREPARING, READY -> READY)
    let targetStatus: RestaurantOrderStatus;
    if (parsed.action === "START") {
      targetStatus = RestaurantOrderStatus.PREPARING;
    } else if (parsed.action === "READY") {
      targetStatus = RestaurantOrderStatus.READY;
    } else if (parsed.status) {
      targetStatus = parsed.status;
    } else {
      return errorResponse("Valid status or action required", "BAD_REQUEST", 400);
    }

    const currentOrder = await prisma.restaurantOrder.findUnique({ where: { id } });
    if (!currentOrder) {
      return errorResponse("Order not found", "NOT_FOUND", 404);
    }

    // If order is currently PLACED and target is PREPARING, advance through ACCEPTED first
    if (
      currentOrder.status === RestaurantOrderStatus.PLACED &&
      targetStatus === RestaurantOrderStatus.PREPARING
    ) {
      await updateOrderStatus({
        orderId: id,
        newStatus: RestaurantOrderStatus.ACCEPTED,
        user: session,
      });
    }

    const updated = await updateOrderStatus({
      orderId: id,
      newStatus: targetStatus,
      user: session,
    });

    return successResponse({ order: updated }, `Ticket moved to ${targetStatus}`);
  } catch (err) {
    return handleRouteError(err);
  }
}
