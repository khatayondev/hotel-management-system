import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { cancelRestaurantOrder } from "@/lib/restaurant/orders";
import { z } from "zod";

const cancelSchema = z.object({
  reason: z.string().min(1, "Reason is required"),
});

export async function POST(
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
    const parsed = cancelSchema.parse(body);

    const order = await cancelRestaurantOrder({
      orderId: id,
      reason: parsed.reason,
      user: session,
    });

    return successResponse({ order }, "Order cancelled successfully");
  } catch (err) {
    return handleRouteError(err);
  }
}
