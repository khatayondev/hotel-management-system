import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { rescheduleBookingByCustomer } from "@/lib/self-service/service";
import { moveReservation } from "@/lib/hotel/reservations";

const rescheduleSchema = z.object({
  newStartUtc: z.string().datetime("newStartUtc must be a valid ISO datetime").optional(),
  newCheckIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Check-in must be YYYY-MM-DD").optional(),
  newCheckOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Check-out must be YYYY-MM-DD").optional(),
  newRoomTypeId: z.string().uuid().optional(),
});

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await props.params;
    const body = await req.json();
    const parsed = rescheduleSchema.parse(body);

    const cleanToken = token.trim().toUpperCase();
    const hotelReservation = await prisma.reservation.findFirst({
      where: {
        OR: [{ reference: cleanToken }, { id: token }],
      },
    });

    if (hotelReservation) {
      if (!parsed.newCheckIn || !parsed.newCheckOut) {
        return errorResponse("Both newCheckIn and newCheckOut (YYYY-MM-DD) are required for hotel date modifications.", "BAD_REQUEST", 400);
      }

      const moved = await moveReservation({
        reservationId: hotelReservation.id,
        newCheckIn: parsed.newCheckIn,
        newCheckOut: parsed.newCheckOut,
        newRoomTypeId: parsed.newRoomTypeId,
      });

      return successResponse(
        {
          isHotel: true,
          ...moved,
        },
        "Reservation dates successfully updated."
      );
    }

    if (!parsed.newStartUtc) {
      return errorResponse("newStartUtc is required for appointments", "BAD_REQUEST", 400);
    }

    const result = await rescheduleBookingByCustomer(token, parsed.newStartUtc);

    return successResponse(result, "Appointment successfully rescheduled.");
  } catch (error) {
    return handleRouteError(error);
  }
}
