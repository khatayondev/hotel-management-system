import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { requirePermission, PERMISSION_KEYS } from "@/lib/rbac";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { getTapeChartData, moveExtendReservationRoom } from "@/lib/hotel/operations";
import { z } from "zod";

const moveExtendSchema = z.object({
  reservationRoomId: z.string().uuid("Invalid reservationRoomId"),
  newRoomId: z.string().uuid().optional(),
  newCheckIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  newCheckOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }
    requirePermission(session, PERMISSION_KEYS.RESERVATIONS_VIEW);

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate") || undefined;
    const days = Number(searchParams.get("days") || 14);

    const data = await getTapeChartData(startDate, days);
    return successResponse(data);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }
    requirePermission(session, PERMISSION_KEYS.RESERVATIONS_MANAGE);

    const body = await req.json();
    const parsed = moveExtendSchema.parse(body);

    const result = await moveExtendReservationRoom({
      ...parsed,
      user: session,
    });

    return successResponse(result, "Reservation room updated successfully");
  } catch (err) {
    return handleRouteError(err);
  }
}
