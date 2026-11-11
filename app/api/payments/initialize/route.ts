import { NextRequest } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments/provider";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const initializeSchema = z
  .object({
    bookingId: z.string().uuid("Invalid booking ID").optional(),
    reservationId: z.string().uuid("Invalid reservation ID").optional(),
    paymentType: z.enum(["DEPOSIT", "FULL", "BALANCE"]).default("DEPOSIT"),
  })
  .refine((data) => Boolean(data.bookingId || data.reservationId), {
    message: "Either bookingId or reservationId must be provided",
  });

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    checkRateLimit(`pay_init:${ip}`, 30, 60);

    const body = await req.json();
    const parsed = initializeSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        parsed.error.issues[0]?.message || "Invalid payload",
        "BAD_REQUEST",
        400
      );
    }

    const { bookingId, reservationId, paymentType } = parsed.data;

    // A. Hotel Reservation Flow
    if (reservationId) {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: { guest: true },
      });

      if (!reservation) {
        return errorResponse("Reservation not found", "NOT_FOUND", 404);
      }

      let amountToPayPesewas = 0;
      if (paymentType === "DEPOSIT") {
        amountToPayPesewas = reservation.depositRequiredPesewas;
      } else if (paymentType === "FULL") {
        amountToPayPesewas = reservation.totalPesewas;
      } else if (paymentType === "BALANCE") {
        amountToPayPesewas = Math.max(0, reservation.totalPesewas - reservation.amountPaidPesewas);
        if (amountToPayPesewas === 0) {
          return errorResponse("This reservation is already fully paid", "BAD_REQUEST", 400);
        }
      }

      const uniqueRef = `PAY-HOTEL-${Date.now().toString().slice(-6)}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

      const payment = await prisma.payment.create({
        data: {
          bookingId: null,
          reference: uniqueRef,
          amountPesewas: amountToPayPesewas,
          currency: "GHS",
          status: "PENDING",
          channel: "MOBILE_MONEY",
        },
      });

      const provider = getPaymentProvider();
      const guestEmail = reservation.guest.email || `guest-${reservation.guest.phone.replace("+", "")}@hotel.gh`;

      const initResult = await provider.initialize({
        reference: uniqueRef,
        amountPesewas: amountToPayPesewas,
        email: guestEmail,
        currency: "GHS",
        channels: ["card", "mobile_money"],
        callbackUrl: `${req.nextUrl.origin}/booking/confirmation?ref=${uniqueRef}`,
        metadata: {
          reservationId: reservation.id,
          reservationReference: reservation.reference,
          paymentId: payment.id,
          paymentType,
          customerPhone: reservation.guest.phone,
        },
      });

      return successResponse(
        {
          authorizationUrl: initResult.authorizationUrl,
          accessCode: initResult.accessCode,
          reference: initResult.reference,
          amountPesewas: amountToPayPesewas,
          paymentType,
        },
        "Payment session initialized",
        201
      );
    }

    // B. Legacy Studio Booking Flow
    if (!bookingId) {
      return errorResponse("Booking ID is required", "BAD_REQUEST", 400);
    }

    // 1. Fetch booking with customer
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true },
    });

    if (!booking) {
      return errorResponse("Booking not found", "NOT_FOUND", 404);
    }

    // 2. Compute amount strictly on the server
    let amountToPayPesewas = 0;
    if (paymentType === "DEPOSIT") {
      amountToPayPesewas = booking.depositRequiredPesewas;
    } else if (paymentType === "FULL") {
      amountToPayPesewas = booking.totalPesewas;
    } else if (paymentType === "BALANCE") {
      amountToPayPesewas = Math.max(0, booking.totalPesewas - booking.amountPaidPesewas);
      if (amountToPayPesewas === 0) {
        return errorResponse("This booking is already fully paid", "BAD_REQUEST", 400);
      }
    }

    // 3. Generate unique transaction reference
    const uniqueRef = `PAY-${Date.now().toString().slice(-6)}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    // 4. Create pending Payment record in DB
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        reference: uniqueRef,
        amountPesewas: amountToPayPesewas,
        currency: "GHS",
        status: "PENDING",
        channel: "MOBILE_MONEY",
      },
    });

    // 5. Initialize via Payment Provider
    const provider = getPaymentProvider();
    const initResult = await provider.initialize({
      reference: uniqueRef,
      amountPesewas: amountToPayPesewas,
      email: booking.customer.email || `customer-${booking.customer.phone.replace("+", "")}@beccascrown.gh`,
      currency: "GHS",
      channels: ["card", "mobile_money"],
      metadata: {
        bookingId: booking.id,
        bookingReference: booking.reference,
        paymentId: payment.id,
        paymentType,
        customerPhone: booking.customer.phone,
      },
    });

    return successResponse(
      {
        authorizationUrl: initResult.authorizationUrl,
        accessCode: initResult.accessCode,
        reference: initResult.reference,
        amountPesewas: amountToPayPesewas,
        paymentType,
      },
      "Payment session initialized",
      201
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
