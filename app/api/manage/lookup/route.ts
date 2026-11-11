import { NextRequest } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { getClientIp } from "@/lib/rate-limit";
import { lookupBookingByReferenceAndPhone, verifyLookupOtp } from "@/lib/self-service/service";
import { normalizeGhanaPhone } from "@/lib/sms";

const lookupSchema = z.object({
  reference: z.string().min(3, "Booking reference is required"),
  phone: z.string().min(9, "Phone number is required"),
  otp: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = lookupSchema.parse(body);
    const clientIp = getClientIp(req);
    const cleanRef = parsed.reference.trim().toUpperCase();

    // Check hotel reservation first
    const hotelReservation = await prisma.reservation.findUnique({
      where: { reference: cleanRef },
      include: { guest: true, rooms: { include: { roomType: true } } },
    });

    if (hotelReservation) {
      const normInputPhone = normalizeGhanaPhone(parsed.phone);
      const normGuestPhone = normalizeGhanaPhone(hotelReservation.guest.phone || "");

      if (normInputPhone !== normGuestPhone) {
        return errorResponse("No reservation found matching reference and phone number.", "NOT_FOUND", 404);
      }

      if (parsed.otp) {
        verifyLookupOtp(cleanRef, parsed.phone, parsed.otp);
      }

      return successResponse({
        isHotel: true,
        reservation: {
          id: hotelReservation.id,
          reference: hotelReservation.reference,
          status: hotelReservation.status,
          guestName: hotelReservation.guest.name,
          checkInDate: hotelReservation.checkInDate,
          checkOutDate: hotelReservation.checkOutDate,
          totalPesewas: hotelReservation.totalPesewas,
          amountPaidPesewas: hotelReservation.amountPaidPesewas,
        },
        manageToken: cleanRef,
        manageUrl: `/manage/${cleanRef}`,
      });
    }

    // If OTP provided, verify OTP
    if (parsed.otp) {
      verifyLookupOtp(parsed.reference, parsed.phone, parsed.otp);
    }

    const summary = await lookupBookingByReferenceAndPhone({
      reference: parsed.reference,
      phone: parsed.phone,
      clientIp,
    });

    // Generate fresh secure 24-byte manage token upon verified lookup
    const rawManageToken = crypto.randomBytes(24).toString("hex");
    const manageTokenHash = crypto.createHash("sha256").update(rawManageToken).digest("hex");

    await prisma.booking.update({
      where: { id: summary.bookingId },
      data: { manageTokenHash },
    });

    return successResponse({
      booking: summary,
      manageToken: rawManageToken,
      manageUrl: `/manage/${rawManageToken}`,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
