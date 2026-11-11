import { getCurrentSession } from "@/lib/auth";
import { requirePermission, PERMISSION_KEYS } from "@/lib/rbac";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { getHotelDashboardKPIs } from "@/lib/hotel/operations";

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }
    // Any front desk, manager or owner with reservations view can read KPIs
    requirePermission(session, PERMISSION_KEYS.RESERVATIONS_VIEW);

    const data = await getHotelDashboardKPIs();
    return successResponse(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
