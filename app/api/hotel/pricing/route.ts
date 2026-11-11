import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-response";
import { computeStayPricing } from "@/lib/hotel/pricing";
import { pricingQuerySchema } from "@/lib/hotel/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = pricingQuerySchema.parse(body);
    const pricing = await computeStayPricing(parsed);
    return successResponse(pricing);
  } catch (err) {
    return handleRouteError(err);
  }
}

