import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { successResponse, handleRouteError } from "@/lib/api-response";
import { cancelBookingByCustomer } from "@/lib/self-service/service";
import { cancelReservation } from "@/lib/hotel/reservations";

const cancelSchema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await props.params;
    let reason: string | undefined;

    try {
      const body = await req.json();
      const parsed = cancelSchema.parse(body);
      reason = parsed.reason;
    } catch {
      // Body is optional
    }

    const cleanToken = token.trim().toUpperCase();
    const hotelReservation = await prisma.reservation.findFirst({
      where: {
        OR: [{ reference: cleanToken }, { id: token }],
      },
    });

    if (hotelReservation) {
      const result = await cancelReservation({
        reservationId: hotelReservation.id,
        reason: reason || "Cancelled by guest in self-service portal",
      });

      return successResponse(
        {
          isHotel: true,
          ...result,
        },
        "Reservation successfully cancelled."
      );
    }

    const result = await cancelBookingByCustomer(token, reason);

    return successResponse(
      result,
      result.alreadyCancelled
        ? "Appointment was already cancelled."
        : "Appointment successfully cancelled."
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
