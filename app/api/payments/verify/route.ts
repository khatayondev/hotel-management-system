import { NextRequest } from "next/server";
import { getPaymentProvider } from "@/lib/payments/provider";
import { reconcilePaymentTransaction } from "@/lib/payments/reconciliation";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";

import { BookingSummaryData, BookingStatusType } from "@/lib/payments/types";

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    checkRateLimit(`pay_verify:${ip}`, 40, 60);

    const { searchParams } = new URL(req.url);
    const reference = searchParams.get("reference") || searchParams.get("ref");

    if (!reference) {
      return errorResponse("Transaction reference is required", "BAD_REQUEST", 400);
    }

    // Direct lookup if reference is a booking reference
    const directBooking = await prisma.booking.findUnique({
      where: { reference },
      include: {
        customer: true,
        staff: true,
        items: { include: { service: true } },
      },
    });

    if (directBooking) {
      const bookingData: BookingSummaryData = {
        id: directBooking.id,
        reference: directBooking.reference,
        status: directBooking.status as BookingStatusType,
        startUtc: directBooking.startUtc,
        endUtc: directBooking.endUtc,
        totalPesewas: directBooking.totalPesewas,
        depositRequiredPesewas: directBooking.depositRequiredPesewas,
        amountPaidPesewas: directBooking.amountPaidPesewas,
        customerName: directBooking.customer.name,
        customerPhone: directBooking.customer.phone,
        staffName: directBooking.staff.name,
        items: directBooking.items.map((i) => ({
          name: i.service.name,
          pricePesewas: i.pricePesewas,
          durationMin: i.durationMin,
        })),
      };

      return successResponse({
        verified: true,
        status: directBooking.status,
        booking: bookingData,
        message: "Booking retrieved successfully",
      });
    }

    // Direct lookup if reference is a hotel reservation reference
    const directReservation = await prisma.reservation.findUnique({
      where: { reference },
      include: {
        guest: true,
        rooms: { include: { roomType: true, room: true } },
        extras: { include: { extra: true } },
      },
    });

    if (directReservation) {
      return successResponse({
        verified: true,
        status: directReservation.status,
        isHotel: true,
        reservation: {
          id: directReservation.id,
          reference: directReservation.reference,
          status: directReservation.status,
          checkInDate: directReservation.checkInDate,
          checkOutDate: directReservation.checkOutDate,
          adults: directReservation.adults,
          children: directReservation.children,
          totalPesewas: directReservation.totalPesewas,
          depositRequiredPesewas: directReservation.depositRequiredPesewas,
          amountPaidPesewas: directReservation.amountPaidPesewas,
          guestName: directReservation.guest.name,
          guestPhone: directReservation.guest.phone,
          rooms: directReservation.rooms.map((r) => ({
            roomTypeName: r.roomType.name,
            roomNumber: r.room?.number || "To be assigned at check-in",
          })),
        },
        message: "Reservation retrieved successfully",
      });
    }

    // 1. Fetch provider status safely
    let providerResult;
    try {
      const provider = getPaymentProvider();
      providerResult = await provider.verify(reference);
    } catch (providerErr: unknown) {
      const msg = providerErr instanceof Error ? providerErr.message : "Payment verification failed";
      return errorResponse(msg, "PAYMENT_NOT_FOUND", 404);
    }

    // 2. Reconcile with atomic row locking
    const reconcileResult = await reconcilePaymentTransaction({
      reference,
      providerResult,
      source: "RETURN_URL",
    });

    // 3. Fetch detailed booking details for return page display
    let bookingData: BookingSummaryData | null = null;
    if (reconcileResult.bookingId) {
      const b = await prisma.booking.findUnique({
        where: { id: reconcileResult.bookingId },
        include: {
          customer: true,
          staff: true,
          items: {
            include: { service: true },
          },
        },
      });
      if (b) {
        bookingData = {
          id: b.id,
          reference: b.reference,
          status: b.status as BookingStatusType,
          startUtc: b.startUtc,
          endUtc: b.endUtc,
          totalPesewas: b.totalPesewas,
          depositRequiredPesewas: b.depositRequiredPesewas,
          amountPaidPesewas: b.amountPaidPesewas,
          customerName: b.customer.name,
          customerPhone: b.customer.phone,
          staffName: b.staff.name,
          items: b.items.map((i) => ({
            name: i.service.name,
            pricePesewas: i.pricePesewas,
            durationMin: i.durationMin,
          })),
        };
      }
    }

    let reservationData = null;
    const resIdOrRef = reconcileResult.reservationId || reconcileResult.reservationReference;
    if (resIdOrRef) {
      const res = await prisma.reservation.findFirst({
        where: {
          OR: [{ id: resIdOrRef }, { reference: resIdOrRef }],
        },
        include: {
          guest: true,
          rooms: { include: { roomType: true, room: true } },
        },
      });

      if (res) {
        reservationData = {
          id: res.id,
          reference: res.reference,
          status: res.status,
          checkInDate: res.checkInDate,
          checkOutDate: res.checkOutDate,
          adults: res.adults,
          children: res.children,
          totalPesewas: res.totalPesewas,
          depositRequiredPesewas: res.depositRequiredPesewas,
          amountPaidPesewas: res.amountPaidPesewas,
          guestName: res.guest.name,
          guestPhone: res.guest.phone,
          rooms: res.rooms.map((r) => ({
            roomTypeName: r.roomType.name,
            roomNumber: r.room?.number || "To be assigned at check-in",
          })),
        };
      }
    }

    return successResponse({
      verified: reconcileResult.success,
      alreadyProcessed: reconcileResult.alreadyProcessed,
      paymentStatus: reconcileResult.paymentStatus,
      bookingStatus: reconcileResult.bookingStatus,
      reservationStatus: reconcileResult.reservationStatus,
      amountPaidPesewas: reconcileResult.amountPaidPesewas,
      booking: bookingData,
      isHotel: Boolean(reservationData),
      reservation: reservationData,
      message: reconcileResult.message,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
