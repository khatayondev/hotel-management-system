import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import {
  getRestaurantOrderById,
  updateOrderStatus,
} from "@/lib/restaurant/orders";
import { RestaurantOrderStatus } from "@prisma/client";
import { z } from "zod";

const updateStatusSchema = z.object({
  status: z.nativeEnum(RestaurantOrderStatus),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    const { id } = await params;
    const order = await getRestaurantOrderById(id);
    if (!order) {
      return errorResponse("Order not found", "NOT_FOUND", 404);
    }

    return successResponse({ order });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = updateStatusSchema.parse(body);

    const updated = await updateOrderStatus({
      orderId: id,
      newStatus: parsed.status,
      user: session,
    });

    return successResponse({ order: updated }, `Order status updated to ${parsed.status}`);
  } catch (err) {
    return handleRouteError(err);
  }
}

