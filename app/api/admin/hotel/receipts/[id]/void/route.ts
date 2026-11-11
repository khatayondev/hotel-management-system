import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { voidHotelReceipt } from "@/lib/hotel/billing";
import { z } from "zod";

const voidReceiptSchema = z.object({
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
    const parsed = voidReceiptSchema.parse(body);

    const receipt = await voidHotelReceipt(id, parsed.reason, session);

    return successResponse({ receipt }, "Hotel receipt voided successfully");
  } catch (err) {
    return handleRouteError(err);
  }
}
