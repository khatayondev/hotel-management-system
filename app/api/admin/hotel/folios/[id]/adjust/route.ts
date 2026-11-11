import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { applyFolioAdjustment } from "@/lib/hotel/billing";
import { z } from "zod";

const adjustSchema = z.object({
  amountPesewas: z.number().int().positive("Adjustment amount must be a positive integer in pesewas"),
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
    const parsed = adjustSchema.parse(body);

    const adjustment = await applyFolioAdjustment({
      folioId: id,
      amountPesewas: parsed.amountPesewas,
      reason: parsed.reason,
      user: session,
    });

    return successResponse({ adjustment }, "Folio adjustment applied successfully", 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
