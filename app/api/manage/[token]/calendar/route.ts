import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBookingByManageToken } from "@/lib/self-service/service";
import { generateIcsCalendar } from "@/lib/self-service/ics";
import { handleRouteError } from "@/lib/api-response";
import { getSettings } from "@/lib/settings";

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
        rooms: { include: { roomType: true } },
      },
    });

    if (hotelReservation) {
      const settings = await getSettings();
      const checkInDateStr = hotelReservation.checkInDate.toISOString().slice(0, 10);
      const checkOutDateStr = hotelReservation.checkOutDate.toISOString().slice(0, 10);

      const checkInTime = settings.standardCheckInTime || "14:00";
      const checkOutTime = settings.standardCheckOutTime || "11:00";

      const startUtc = new Date(`${checkInDateStr}T${checkInTime}:00Z`);
      const endUtc = new Date(`${checkOutDateStr}T${checkOutTime}:00Z`);

      const roomName = hotelReservation.rooms[0]?.roomType?.name || "Luxury Suite";

      const icsContent = generateIcsCalendar({
        reference: hotelReservation.reference,
        summary: `Stay at Aura Royal Hotel - ${roomName}`,
        description: `Hotel Reservation for ${hotelReservation.guest.name}\\nReference: ${hotelReservation.reference}\\nCheck-in: ${checkInDateStr} at ${checkInTime}\\nCheck-out: ${checkOutDateStr} at ${checkOutTime}\\nManage: ${req.nextUrl.origin}/manage/${hotelReservation.reference}`,
        startUtc,
        endUtc,
        location: `${settings.hotelName || "Aura Royal Hotel & Restaurant"}, Accra, Ghana`,
        url: `${req.nextUrl.origin}/manage/${hotelReservation.reference}`,
      });

      return new NextResponse(icsContent, {
        status: 200,
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": `attachment; filename="aura-hotel-stay-${hotelReservation.reference}.ics"`,
          "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate",
        },
      });
    }

    const booking = await getBookingByManageToken(token);

    const primaryService = booking.services[0]?.name || "Beauty Appointment";
    const icsContent = generateIcsCalendar({
      reference: booking.reference,
      summary: `${primaryService} - Becca's Crown Beauty Vault`,
      description: `Appointment for ${booking.customerName}\\nReference: ${booking.reference}\\nStaff: ${booking.staffName}\\nManage: ${req.nextUrl.origin}/manage/${token}`,
      startUtc: new Date(booking.startUtc),
      endUtc: new Date(booking.endUtc),
      url: `${req.nextUrl.origin}/manage/${token}`,
    });

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="beccascrown-booking-${booking.reference}.ics"`,
        "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
