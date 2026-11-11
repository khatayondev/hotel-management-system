import { prisma } from "../db";
import { AppError } from "../api-response";
import { getSettings } from "../settings";
import { RoomStatus, ReservationStatus } from "@prisma/client";
import {
  calculateStayNights,
  getStayNightDates,
  parseDateOnly,
  getHoursUntilCheckIn,
} from "./date-utils";
import {
  AvailabilityQueryInput,
  RoomTypeAvailability,
  availabilityQuerySchema,
} from "./types";
import { computeStayPricing } from "./pricing";

const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.HELD,
  ReservationStatus.PENDING_PAYMENT,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

/**
 * Calculates availability for one or all room types across a requested date range.
 * Respects:
 * - Total operational rooms (excluding OUT_OF_ORDER rooms)
 * - Overlapping active reservations ([checkIn, checkOut) half-open interval)
 * - Active unexpired RoomHolds
 * - Studio settings: minimum notice, max days ahead, minimum nights from RateOverrides
 */
export async function getRoomTypeAvailability(
  input: AvailabilityQueryInput,
  txPrisma = prisma
): Promise<RoomTypeAvailability[]> {
  const parsed = availabilityQuerySchema.parse(input);
  const { checkIn: checkInStr, checkOut: checkOutStr, roomTypeId, adults, children } = parsed;

  const checkInDate = parseDateOnly(checkInStr);
  const checkOutDate = parseDateOnly(checkOutStr);
  const nights = calculateStayNights(checkInDate, checkOutDate);
  const stayNightDates = getStayNightDates(checkInDate, checkOutDate);
  const now = new Date();

  // 1. Check Studio Settings (Notice & Booking Window)
  const settings = await getSettings();
  const hoursNotice = getHoursUntilCheckIn(checkInDate, settings.standardCheckInTime || "14:00", now);

  const isNoticeViolated = hoursNotice < settings.minimumNoticeHours;

  const maxFutureDate = new Date(now.getTime() + settings.maxDaysAhead * 24 * 60 * 60 * 1000);
  const isMaxDaysViolated = checkInDate.getTime() > maxFutureDate.getTime();

  // 2. Fetch RoomTypes (single or all active)
  const roomTypes = await txPrisma.roomType.findMany({
    where: {
      ...(roomTypeId ? { id: roomTypeId } : {}),
      isActive: true,
    },
    include: {
      rooms: true,
      rateOverrides: {
        where: {
          startDate: { lte: checkOutDate },
          endDate: { gte: checkInDate },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  if (roomTypeId && roomTypes.length === 0) {
    throw new AppError("Room type not found or inactive", 404, "ROOM_TYPE_NOT_FOUND");
  }

  // 3. Query all overlapping active reservation rooms across the stay window
  const overlappingReservationRooms = await txPrisma.reservationRoom.findMany({
    where: {
      roomTypeId: { in: roomTypes.map((rt) => rt.id) },
      status: { in: ACTIVE_RESERVATION_STATUSES },
      checkIn: { lt: checkOutDate },
      checkOut: { gt: checkInDate },
    },
    select: {
      id: true,
      roomTypeId: true,
      roomId: true,
      checkIn: true,
      checkOut: true,
    },
  });

  // 4. Query all active unexpired RoomHolds across the stay window
  const activeRoomHolds = await txPrisma.roomHold.findMany({
    where: {
      roomTypeId: { in: roomTypes.map((rt) => rt.id) },
      expiresAt: { gt: now },
      checkIn: { lt: checkOutDate },
      checkOut: { gt: checkInDate },
    },
    select: {
      id: true,
      roomTypeId: true,
      quantity: true,
      checkIn: true,
      checkOut: true,
    },
  });

  // 5. Evaluate Availability for each RoomType
  const results: RoomTypeAvailability[] = [];

  for (const rt of roomTypes) {
    // A. Operational rooms count (exclude OUT_OF_ORDER)
    const operationalRooms = rt.rooms.filter((r) => r.status !== RoomStatus.OUT_OF_ORDER);
    const totalOperational = operationalRooms.length;

    // B. Minimum nights check from matching RateOverrides
    let minNightsRequired = 1;
    for (const ro of rt.rateOverrides) {
      if (ro.minNights && ro.minNights > minNightsRequired) {
        minNightsRequired = ro.minNights;
      }
    }
    const isMinNightsViolated = nights < minNightsRequired;

    // C. Guest capacity check
    const isCapacityViolated = adults > rt.maxAdults || children > rt.maxChildren;

    // If booking rules, capacity, or notice is violated, available quantity is 0
    if (isNoticeViolated || isMaxDaysViolated || isMinNightsViolated || isCapacityViolated || totalOperational === 0) {
      results.push({
        roomTypeId: rt.id,
        name: rt.name,
        slug: rt.slug,
        basePricePesewas: rt.basePricePesewas,
        maxAdults: rt.maxAdults,
        maxChildren: rt.maxChildren,
        bedConfiguration: rt.bedConfiguration,
        amenities: rt.amenities,
        imageUrls: rt.imageUrls,
        totalOperationalRooms: totalOperational,
        bookedRooms: 0,
        heldRooms: 0,
        availableQuantity: 0,
        isAvailable: false,
        minNightsRequired,
      });
      continue;
    }

    // D. Filter reservations & holds specific to this room type
    const rtResRooms = overlappingReservationRooms.filter((rr) => rr.roomTypeId === rt.id);
    const rtHolds = activeRoomHolds.filter((h) => h.roomTypeId === rt.id);

    // E. Evaluate night-by-night availability across every night of the stay
    let minAvailableAcrossStay = totalOperational;
    let maxBookedAcrossStay = 0;
    let maxHeldAcrossStay = 0;

    for (const nightStr of stayNightDates) {
      const nightDate = parseDateOnly(nightStr);

      // Count active reservation rooms occupying this night: checkIn <= nightDate && checkOut > nightDate
      const bookedOnNight = rtResRooms.filter((rr) => {
        const rrStart = parseDateOnly(rr.checkIn);
        const rrEnd = parseDateOnly(rr.checkOut);
        return rrStart <= nightDate && rrEnd > nightDate;
      }).length;

      // Sum active unexpired holds on this night
      const heldOnNight = rtHolds
        .filter((h) => {
          const hStart = parseDateOnly(h.checkIn);
          const hEnd = parseDateOnly(h.checkOut);
          return hStart <= nightDate && hEnd > nightDate;
        })
        .reduce((sum, h) => sum + h.quantity, 0);

      const availableOnNight = Math.max(0, totalOperational - bookedOnNight - heldOnNight);

      if (availableOnNight < minAvailableAcrossStay) {
        minAvailableAcrossStay = availableOnNight;
      }
      if (bookedOnNight > maxBookedAcrossStay) {
        maxBookedAcrossStay = bookedOnNight;
      }
      if (heldOnNight > maxHeldAcrossStay) {
        maxHeldAcrossStay = heldOnNight;
      }
    }

    const availableQuantity = minAvailableAcrossStay;
    const isAvailable = availableQuantity >= 1;

    // Optional pricing preview for convenience
    let pricingPreview;
    try {
      pricingPreview = await computeStayPricing(
        {
          roomTypeId: rt.id,
          checkIn: checkInStr,
          checkOut: checkOutStr,
          quantity: 1,
          adults,
          children,
        },
        txPrisma
      );
    } catch {
      // Preview failure shouldn't block availability response
    }

    results.push({
      roomTypeId: rt.id,
      name: rt.name,
      slug: rt.slug,
      basePricePesewas: rt.basePricePesewas,
      maxAdults: rt.maxAdults,
      maxChildren: rt.maxChildren,
      bedConfiguration: rt.bedConfiguration,
      amenities: rt.amenities,
      imageUrls: rt.imageUrls,
      totalOperationalRooms: totalOperational,
      bookedRooms: maxBookedAcrossStay,
      heldRooms: maxHeldAcrossStay,
      availableQuantity,
      isAvailable,
      minNightsRequired,
      pricingPreview,
    });
  }

  return results;
}

