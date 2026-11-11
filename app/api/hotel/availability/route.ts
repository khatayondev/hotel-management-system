import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-response";
import { getRoomTypeAvailability } from "@/lib/hotel/availability";
import { availabilityQuerySchema } from "@/lib/hotel/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const checkIn = searchParams.get("checkIn") || "";
    const checkOut = searchParams.get("checkOut") || "";
    const roomTypeId = searchParams.get("roomTypeId") || undefined;
    const adults = searchParams.get("adults") || "1";
    const children = searchParams.get("children") || "0";

    const parsed = availabilityQuerySchema.parse({
      checkIn,
      checkOut,
      roomTypeId,
      adults,
      children,
    });

    const availability = await getRoomTypeAvailability(parsed);
    return successResponse(availability);
  } catch (err) {
    return handleRouteError(err);
  }
}

