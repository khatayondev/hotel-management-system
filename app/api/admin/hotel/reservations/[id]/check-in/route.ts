import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { requirePermission, PERMISSION_KEYS } from "@/lib/rbac";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { checkInReservation } from "@/lib/hotel/operations";
import { z } from "zod";

const checkInSchema = z.object({
  roomId: z.string().uuid().optional(),
  guestDetails: z
    .object({
      idType: z.string().optional(),
      idNumber: z.string().optional(),
      nationality: z.string().optional(),
      vehiclePlate: z.string().optional(),
      company: z.string().optional(),
    })
    .optional(),
  earlyCheckInApproved: z.boolean().optional(),
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
    const parsed = checkInSchema.parse(body);

    const result = await checkInReservation({
      reservationId: id,
      roomId: parsed.roomId,
      guestDetails: parsed.guestDetails,
      earlyCheckInApproved: parsed.earlyCheckInApproved,
      notes: parsed.notes,
      user: session,
    });

    return successResponse(result, "Guest checked in successfully");
  } catch (err) {
    return handleRouteError(err);
  }
}
