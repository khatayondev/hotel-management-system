import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { requirePermission, PERMISSION_KEYS } from "@/lib/rbac";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { getFolioDetails } from "@/lib/hotel/billing";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }
    requirePermission(session, PERMISSION_KEYS.RESERVATIONS_VIEW);

    const { id } = await params;
    const folio = await getFolioDetails({ folioId: id }, session);

    return successResponse({ folio });
  } catch (err) {
    return handleRouteError(err);
  }
}
