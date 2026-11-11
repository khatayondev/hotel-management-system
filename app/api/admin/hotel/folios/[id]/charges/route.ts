import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { chargeToRoomFromPos } from "@/lib/hotel/billing";
import { z } from "zod";

const chargeSchema = z.object({
  description: z.string().min(1, "Description is required"),
  source: z.enum(["RESTAURANT", "EXTRA"]),
  amountPesewas: z.number().int().positive("Amount must be a positive integer in pesewas"),
  referenceId: z.string().optional(),
  items: z.array(z.object({
    name: z.string(),
    pricePesewas: z.number().int(),
    quantity: z.number().int().optional(),
  })).optional(),
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
    const parsed = chargeSchema.parse(body);

    const charge = await chargeToRoomFromPos({
      folioId: id,
      description: parsed.description,
      source: parsed.source,
      amountPesewas: parsed.amountPesewas,
      referenceId: parsed.referenceId,
      items: parsed.items,
      user: session,
    });

    return successResponse({ charge }, "Charge added to folio successfully", 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
