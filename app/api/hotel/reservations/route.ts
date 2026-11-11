import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-response";
import { createReservationFromHold } from "@/lib/hotel/reservations";
import { createReservationFromHoldSchema } from "@/lib/hotel/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createReservationFromHoldSchema.parse(body);
    const reservation = await createReservationFromHold(parsed);
    return successResponse(reservation, "Reservation created successfully", 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

