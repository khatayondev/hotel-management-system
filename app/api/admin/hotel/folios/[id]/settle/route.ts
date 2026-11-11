import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { settleHotelCheckoutWithSplitPayments, type HotelPaymentMethod } from "@/lib/hotel/billing";
import { z } from "zod";

const settleSchema = z.object({
  payments: z.array(
    z.object({
      method: z.enum(["CASH", "MOBILE_MONEY", "CARD", "DEPOSIT_CREDIT"]),
      amountPesewas: z.number().int().min(0),
      tenderedPesewas: z.number().int().min(0).optional(),
      reference: z.string().optional(),
      provider: z.string().optional(),
      notes: z.string().optional(),
    })
  ).min(1, "At least one payment method is required"),
  checkOut: z.boolean().optional(),
  overrideUnpaidBalance: z.boolean().optional(),
  overrideReason: z.string().optional(),
  notes: z.string().optional(),
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
    const parsed = settleSchema.parse(body);

    const receipt = await settleHotelCheckoutWithSplitPayments({
      folioId: id,
      payments: parsed.payments.map((p) => ({
        ...p,
        method: p.method as HotelPaymentMethod,
      })),
      checkOut: parsed.checkOut,
      overrideUnpaidBalance: parsed.overrideUnpaidBalance,
      overrideReason: parsed.overrideReason,
      notes: parsed.notes,
      user: session,
    });

    return successResponse({ receipt }, "Folio settled and receipt generated successfully", 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

