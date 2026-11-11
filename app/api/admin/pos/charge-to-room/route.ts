import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { chargeToRoomFromPos } from "@/lib/hotel/billing";
import { z } from "zod";

const posChargeToRoomSchema = z.object({
  folioId: z.string().uuid("Invalid folio ID"),
  description: z.string().min(1, "Description is required"),
  source: z.enum(["RESTAURANT", "EXTRA"]).default("RESTAURANT"),
  amountPesewas: z.number().int().positive("Amount must be a positive integer in pesewas"),
  referenceId: z.string().optional(),
  items: z.array(z.object({
    name: z.string(),
    pricePesewas: z.number().int(),
    quantity: z.number().int().optional(),
  })).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    const body = await req.json();
    const parsed = posChargeToRoomSchema.parse(body);

    const charge = await chargeToRoomFromPos({
      folioId: parsed.folioId,
      description: parsed.description,
      source: parsed.source,
      amountPesewas: parsed.amountPesewas,
      referenceId: parsed.referenceId,
      items: parsed.items,
      user: session,
    });

    return successResponse({ charge }, "Charged to room folio successfully", 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

