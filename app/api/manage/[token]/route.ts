import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, handleRouteError } from "@/lib/api-response";
import { getBookingByManageToken } from "@/lib/self-service/service";
import { generateGoogleCalendarUrl } from "@/lib/self-service/ics";
import { getSettings } from "@/lib/settings";
import { getHoursUntilCheckIn } from "@/lib/hotel/date-utils";

export async function GET(
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
      include: {
        guest: true,
        rooms: { include: { roomType: true, room: true } },
        extras: { include: { extra: true } },
        folios: { include: { charges: true } },
      },
    });

    if (hotelReservation) {
      const settings = await getSettings();
      const hoursUntilCheckIn = getHoursUntilCheckIn(
        hotelReservation.checkInDate,
        settings.standardCheckInTime || "14:00"
      );

      const isBeforeCutoff = hoursUntilCheckIn >= settings.freeCancelHoursBeforeCheckIn;
      const penaltyRate = settings.cancellationPenaltyPercent / 100;
      const penaltyPesewas = isBeforeCutoff
        ? 0
        : Math.round(hotelReservation.totalPesewas * penaltyRate);
      const refundPesewas = isBeforeCutoff
        ? hotelReservation.amountPaidPesewas
        : Math.max(0, hotelReservation.amountPaidPesewas - penaltyPesewas);

      const balanceDuePesewas = Math.max(
        0,
        hotelReservation.totalPesewas - hotelReservation.amountPaidPesewas
      );

      return successResponse({
        isHotel: true,
        id: hotelReservation.id,
        reference: hotelReservation.reference,
        status: hotelReservation.status,
        checkInDate: hotelReservation.checkInDate.toISOString().slice(0, 10),
        checkOutDate: hotelReservation.checkOutDate.toISOString().slice(0, 10),
        standardCheckInTime: settings.standardCheckInTime || "14:00",
        standardCheckOutTime: settings.standardCheckOutTime || "11:00",
        adults: hotelReservation.adults,
        children: hotelReservation.children,
        customerName: hotelReservation.guest.name,
        customerPhone: hotelReservation.guest.phone,
        customerEmail: hotelReservation.guest.email,
        subtotalPesewas: hotelReservation.subtotalPesewas,
        taxPesewas: hotelReservation.taxPesewas,
        totalPesewas: hotelReservation.totalPesewas,
        depositRequiredPesewas: hotelReservation.depositRequiredPesewas,
        amountPaidPesewas: hotelReservation.amountPaidPesewas,
        balanceDuePesewas,
        rooms: hotelReservation.rooms.map((r) => ({
          id: r.id,
          roomTypeId: r.roomTypeId,
          roomTypeName: r.roomType.name,
          roomNumber: r.room?.number || "Assigned upon check-in",
          bedConfiguration: r.roomType.bedConfiguration,
        })),
        extras: hotelReservation.extras.map((e) => ({
          name: e.extra.name,
          quantity: e.quantity,
          pricePesewas: e.pricePesewas,
        })),
        cancellationPolicy: {
          freeCancelHoursBeforeCheckIn: settings.freeCancelHoursBeforeCheckIn,
          cancellationPenaltyPercent: settings.cancellationPenaltyPercent,
          hoursUntilCheckIn,
          isBeforeCutoff,
          penaltyPesewas,
          refundPesewas,
        },
        canCancel: hotelReservation.status !== "CANCELLED" && hotelReservation.status !== "CHECKED_OUT",
        canReschedule: hotelReservation.status !== "CANCELLED" && hotelReservation.status !== "CHECKED_OUT",
        calendarUrls: {
          icsDownload: `/api/manage/${encodeURIComponent(hotelReservation.reference)}/calendar`,
        },
      });
    }

    // Fallback to legacy studio booking
    const booking = await getBookingByManageToken(token);

    const primaryService = booking.services[0]?.name || "Beauty Appointment";
    const googleCalendarUrl = generateGoogleCalendarUrl({
      reference: booking.reference,
      summary: `${primaryService} - Becca's Crown Beauty Vault`,
      description: `Appointment for ${booking.customerName}\nReference: ${booking.reference}\nStaff: ${booking.staffName}\nManage Link: ${req.nextUrl.origin}/manage/${token}`,
      startUtc: new Date(booking.startUtc),
      endUtc: new Date(booking.endUtc),
    });

    return successResponse({
      ...booking,
      calendarUrls: {
        google: googleCalendarUrl,
        icsDownload: `/api/manage/${encodeURIComponent(token)}/calendar`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
