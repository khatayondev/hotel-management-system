import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { requirePermission, PERMISSION_KEYS } from "@/lib/rbac";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { checkOutReservation } from "@/lib/hotel/operations";
import { z } from "zod";

const checkOutSchema = z.object({
  overrideUnpaidBalance: z.boolean().optional(),
  overrideReason: z.string().optional(),
  notes: z.string().optional(),
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
    requirePermission(session, PERMISSION_KEYS.CHECKIN_CHECKOUT);

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = checkOutSchema.parse(body);

    const result = await checkOutReservation({
      reservationId: id,
      overrideUnpaidBalance: parsed.overrideUnpaidBalance,
      overrideReason: parsed.overrideReason,
      notes: parsed.notes,
      user: session,
    });

    return successResponse(result, "Guest checked out successfully");
  } catch (err) {
    return handleRouteError(err);
  }
}
