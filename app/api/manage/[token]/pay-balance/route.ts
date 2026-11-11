import { NextRequest } from "next/server";
import { successResponse, handleRouteError, AppError } from "@/lib/api-response";
import { getBookingByManageToken } from "@/lib/self-service/service";
import { getPaymentProvider } from "@/lib/payments/provider";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await props.params;
    const cleanToken = token.trim().toUpperCase();

    // Check hotel reservation first
    const hotelReservation = await prisma.reservation.findFirst({
      where: {
        OR: [{ reference: cleanToken }, { id: token }],
      },
      include: { guest: true },
    });

    if (hotelReservation) {
      const balanceDuePesewas = Math.max(
        0,
        hotelReservation.totalPesewas - hotelReservation.amountPaidPesewas
      );

      if (balanceDuePesewas <= 0) {
        throw new AppError("No outstanding balance due for this reservation.", 400, "NO_BALANCE_DUE");
      }

      if (hotelReservation.status === "CANCELLED") {
        throw new AppError("Cannot pay balance for a cancelled reservation.", 400, "RESERVATION_CANCELLED");
      }

      const paystackRef = `BAL-HOTEL-${hotelReservation.reference}-${Date.now().toString().slice(-6)}`;
      const provider = getPaymentProvider();
      const guestEmail = hotelReservation.guest.email || `guest-${hotelReservation.guest.phone.replace("+", "")}@hotel.gh`;

      const initResult = await provider.initialize({
        reference: paystackRef,
        amountPesewas: balanceDuePesewas,
        email: guestEmail,
        currency: "GHS",
        channels: ["card", "mobile_money"],
        callbackUrl: `${req.nextUrl.origin}/manage/${token}?payment=success&ref=${paystackRef}`,
        metadata: {
          reservationId: hotelReservation.id,
          reservationReference: hotelReservation.reference,
          paymentType: "BALANCE",
        },
      });

      await prisma.payment.create({
        data: {
          bookingId: null,
          reference: paystackRef,
          amountPesewas: balanceDuePesewas,
          currency: "GHS",
          status: "PENDING",
          channel: "PAYSTACK",
        },
      });

      return successResponse({
        isHotel: true,
        authorizationUrl: initResult.authorizationUrl,
        reference: paystackRef,
        amountPesewas: balanceDuePesewas,
      });
    }

    const booking = await getBookingByManageToken(token);

    if (booking.balanceDuePesewas <= 0) {
      throw new AppError("No outstanding balance due for this booking.", 400, "NO_BALANCE_DUE");
    }

    if (booking.status === "CANCELLED") {
      throw new AppError("Cannot pay balance for a cancelled booking.", 400, "BOOKING_CANCELLED");
    }

    const paystackRef = `BAL-${booking.reference}-${Date.now().toString().slice(-6)}`;
    const provider = getPaymentProvider();

    const initResult = await provider.initialize({
      reference: paystackRef,
      amountPesewas: booking.balanceDuePesewas,
      email: booking.customerEmail || `customer-${booking.reference.toLowerCase()}@beccascrown.gh`,
      currency: "GHS",
      callbackUrl: `${req.nextUrl.origin}/manage/${token}?payment=success&ref=${paystackRef}`,
      metadata: {
        bookingId: booking.id,
        bookingReference: booking.reference,
        paymentType: "BALANCE",
      },
    });

    // Record pending payment
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        reference: paystackRef,
        amountPesewas: booking.balanceDuePesewas,
        currency: "GHS",
        status: "PENDING",
        channel: "PAYSTACK",
      },
    });

    return successResponse({
      authorizationUrl: initResult.authorizationUrl,
      reference: paystackRef,
      amountPesewas: booking.balanceDuePesewas,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
