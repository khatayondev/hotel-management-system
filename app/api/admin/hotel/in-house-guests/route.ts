import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { requirePermission, PERMISSION_KEYS, ROLES } from "@/lib/rbac";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { getInHouseGuests } from "@/lib/hotel/billing";

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    // Front Desk, Waiter, Manager, Owner Admin can search in-house guests for charging
    const allowed: string[] = [ROLES.FRONT_DESK, ROLES.WAITER, ROLES.MANAGER, ROLES.OWNER_ADMIN, ROLES.STAFF_RECEPTIONIST];
    if (!allowed.includes(session.role)) {
      requirePermission(session, PERMISSION_KEYS.RESERVATIONS_VIEW);
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || undefined;

    const guests = await getInHouseGuests(query);
    return successResponse({ guests });
  } catch (err) {
    return handleRouteError(err);
  }
}
