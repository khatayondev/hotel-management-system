import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { requirePermission, PERMISSION_KEYS } from "@/lib/rbac";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { getHousekeepingBoard, updateHousekeepingStatus } from "@/lib/hotel/operations";
import { RoomStatus } from "@prisma/client";
import { z } from "zod";

const updateStatusSchema = z.object({
  taskId: z.string().uuid().optional(),
  roomId: z.string().uuid("Invalid roomId"),
  status: z.nativeEnum(RoomStatus),
  notes: z.string().optional(),
  assignedToUserId: z.string().uuid().optional(),
});

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }
    // Gated by housekeeping.tasks_view
    requirePermission(session, PERMISSION_KEYS.HOUSEKEEPING_TASKS_VIEW);

    const data = await getHousekeepingBoard();
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
    // Gated by rooms.status_update
    requirePermission(session, PERMISSION_KEYS.ROOMS_STATUS_UPDATE);

    const body = await req.json();
    const parsed = updateStatusSchema.parse(body);

    const updated = await updateHousekeepingStatus({
      ...parsed,
      user: session,
    });

    return successResponse(updated, "Housekeeping status updated successfully");
  } catch (err) {
    return handleRouteError(err);
  }
}

