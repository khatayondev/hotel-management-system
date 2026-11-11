import { prisma } from "../db";
import { AppError } from "../api-response";
import { getSettings } from "../settings";
import { RoomExtraPricing } from "@prisma/client";
import { calculateStayNights, getStayNightDates, parseDateOnly } from "./date-utils";
import {
  PricingQueryInput,
  StayPricingResult,
  NightlyRate,
  ExtraCalculation,
  TaxCalculation,
  pricingQuerySchema,
} from "./types";

/**
 * Computes complete pricing breakdown for a hotel stay.
 * Returns all monetary values in integer pesewas (GHS).
 */
export async function computeStayPricing(
  input: PricingQueryInput,
  txPrisma = prisma
): Promise<StayPricingResult> {
  const parsed = pricingQuerySchema.parse(input);
  const { roomTypeId, checkIn, checkOut, quantity, adults, children, extras: selectedExtras } = parsed;

  const nights = calculateStayNights(checkIn, checkOut);
  const stayDates = getStayNightDates(checkIn, checkOut);

  // 1. Fetch RoomType with RateOverrides
  const roomType = await txPrisma.roomType.findUnique({
    where: { id: roomTypeId },
    include: {
      rateOverrides: {
        where: {
          startDate: { lte: parseDateOnly(checkOut) },
          endDate: { gte: parseDateOnly(checkIn) },
        },
      },
    },
  });

  if (!roomType) {
    throw new AppError("Room type not found", 404, "ROOM_TYPE_NOT_FOUND");
  }

  // 2. Fetch business settings (taxes & deposit rules)
  const settings = await getSettings();

  // 3. Compute Per-Night Rates with RateOverrides
  const nightlyRates: NightlyRate[] = stayDates.map((dateStr) => {
    const nightDate = parseDateOnly(dateStr);

    // Find all overrides matching this specific date
    const matchingOverrides = roomType.rateOverrides.filter((ro) => {
      const roStart = parseDateOnly(ro.startDate);
      const roEnd = parseDateOnly(ro.endDate);
      return nightDate >= roStart && nightDate <= roEnd;
    });

    if (matchingOverrides.length > 0) {
      // Pick the most specific matching override (smallest date range)
      matchingOverrides.sort((a, b) => {
        const spanA = parseDateOnly(a.endDate).getTime() - parseDateOnly(a.startDate).getTime();
        const spanB = parseDateOnly(b.endDate).getTime() - parseDateOnly(b.startDate).getTime();
        return spanA - spanB;
      });

      const best = matchingOverrides[0];
      return {
        date: dateStr,
        pricePesewas: best.pricePesewas,
        rateLabel: best.label || "Special Rate Override",
        isOverridden: true,
      };
    }

    return {
      date: dateStr,
      pricePesewas: roomType.basePricePesewas,
      rateLabel: "Standard Base Rate",
      isOverridden: false,
    };
  });

  const singleRoomNightlySum = nightlyRates.reduce((sum, n) => sum + n.pricePesewas, 0);
  const roomSubtotalPesewas = singleRoomNightlySum * quantity;

  // 4. Compute Extras
  let extrasCalculations: ExtraCalculation[] = [];
  let extrasSubtotalPesewas = 0;

  if (selectedExtras && selectedExtras.length > 0) {
    const extraIds = selectedExtras.map((e) => e.extraId);
    const dbExtras = await txPrisma.roomExtra.findMany({
      where: {
        id: { in: extraIds },
        isActive: true,
      },
    });

    const extraMap = new Map(dbExtras.map((e) => [e.id, e]));

    extrasCalculations = selectedExtras.map((sel) => {
      const extra = extraMap.get(sel.extraId);
      if (!extra) {
        throw new AppError(`Room extra ${sel.extraId} not found or inactive`, 404, "EXTRA_NOT_FOUND");
      }

      let itemTotal = 0;
      switch (extra.pricing) {
        case RoomExtraPricing.PER_STAY:
          itemTotal = extra.pricePesewas * sel.quantity;
          break;
        case RoomExtraPricing.PER_NIGHT:
          itemTotal = extra.pricePesewas * sel.quantity * nights;
          break;
        case RoomExtraPricing.PER_PERSON:
          itemTotal = extra.pricePesewas * sel.quantity * (adults + children);
          break;
      }

      extrasSubtotalPesewas += itemTotal;

      return {
        extraId: extra.id,
        name: extra.name,
        pricing: extra.pricing,
        unitPricePesewas: extra.pricePesewas,
        quantity: sel.quantity,
        totalPesewas: itemTotal,
      };
    });
  }

  // 5. Compute Subtotal (Rooms + Extras)
  const subtotalPesewas = roomSubtotalPesewas + extrasSubtotalPesewas;

  // 6. Compute Taxes from Settings
  const activeTaxes = settings.taxes.filter((t) => t.enabled);
  let taxTotalPesewas = 0;

  const taxesCalculations: TaxCalculation[] = activeTaxes.map((tax) => {
    // Integer pesewas math: Math.round((subtotal * percentage) / 100)
    const taxAmount = Math.round((subtotalPesewas * tax.percentage) / 100);
    taxTotalPesewas += taxAmount;
    return {
      id: tax.id,
      name: tax.name,
      percentage: tax.percentage,
      taxPesewas: taxAmount,
    };
  });

  // 7. Grand Total
  const totalPesewas = subtotalPesewas + taxTotalPesewas;

  // 8. Deposit Calculation using settings policy
  let depositRequiredPesewas = 0;
  if (settings.depositRefundPolicy === "NON_REFUNDABLE") {
    depositRequiredPesewas = totalPesewas; // 100% upfront
  } else if (settings.depositRefundPolicy === "PARTIAL_50") {
    depositRequiredPesewas = Math.round(totalPesewas * 0.5); // 50% deposit
  } else {
    // Default 50% deposit for stays, or full stay if 1 night
    const depositPct = nights === 1 ? 1.0 : 0.5;
    depositRequiredPesewas = Math.round(totalPesewas * depositPct);
  }

  return {
    roomTypeId: roomType.id,
    roomTypeName: roomType.name,
    checkIn,
    checkOut,
    nights,
    quantity,
    adults,
    children,
    nightlyRates,
    roomSubtotalPesewas,
    extras: extrasCalculations,
    extrasSubtotalPesewas,
    subtotalPesewas,
    taxes: taxesCalculations,
    taxTotalPesewas,
    totalPesewas,
    depositRequiredPesewas,
    currency: "GHS",
  };
}

