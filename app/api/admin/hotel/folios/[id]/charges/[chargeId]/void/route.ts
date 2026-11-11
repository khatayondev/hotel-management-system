import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { voidFolioCharge } from "@/lib/hotel/billing";
import { z } from "zod";

const voidSchema = z.object({
  reason: z.string().min(1, "Reason is required"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; chargeId: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    const { chargeId } = await params;
    const body = await req.json();
    const parsed = voidSchema.parse(body);

    const result = await voidFolioCharge(chargeId, parsed.reason, session);

    return successResponse(result, "Folio charge voided successfully");
  } catch (err) {
    return handleRouteError(err);
  }
}
