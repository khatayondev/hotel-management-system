import { prisma } from "../db";
import { AppError } from "../api-response";
import { getSettings } from "../settings";
import {
  ReservationStatus,
  RoomStatus,
  FolioStatus,
  FolioChargeSource,
  HousekeepingTaskStatus,
  Prisma,
} from "@prisma/client";
import { formatPesewas } from "../money";
import { formatDateOnly } from "./date-utils";
import { generateNextReceiptNumber } from "../pos/receipt-counter";
import { normalizeGhanaPhone, sendSms } from "../sms";
import {
  ROLES,
  type PermissionContextUser,
  PERMISSION_KEYS,
  requirePermission,
  ROLE_DEFAULT_LIMITS,
} from "../rbac";

// -------------------------------------------------------------
// Types & Interfaces
// -------------------------------------------------------------

export interface InHouseGuestSummary {
  reservationId: string;
  reservationReference: string;
  folioId: string;
  folioNumber: string;
  guestId: string;
  guestName: string;
  guestPhone: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  checkInDate: string;
  checkOutDate: string;
  balancePesewas: number;
}

export interface FolioChargeItem {
  id: string;
  folioId: string;
  description: string;
  source: FolioChargeSource;
  amountPesewas: number;
  referenceId: string | null;
  createdByUserId: string | null;
  createdByName?: string | null;
  createdAt: string;
}

export interface FolioDetails {
  folioId: string;
  folioNumber: string;
  reservationId: string | null;
  reservationReference?: string | null;
  status: FolioStatus;
  guestName?: string;
  guestPhone?: string;
  roomNumber?: string;
  roomTypeName?: string;
  checkInDate?: string;
  checkOutDate?: string;
  charges: FolioChargeItem[];
  financials: {
    roomChargesPesewas: number;
    restaurantChargesPesewas: number;
    extraChargesPesewas: number;
    adjustmentPesewas: number; // discounts (negative) or corrections
    totalGrossChargesPesewas: number;
    totalNetChargesPesewas: number;
    totalPaymentsPesewas: number;
    runningBalancePesewas: number;
    isSettled: boolean;
  };
}

export interface ChargeToRoomInput {
  folioId: string;
  description: string;
  source: "RESTAURANT" | "EXTRA";
  amountPesewas: number;
  referenceId?: string; // Receipt number or POS order reference
  items?: Array<{ name: string; pricePesewas: number; quantity?: number }>;
  user: PermissionContextUser;
}

export interface FolioAdjustmentInput {
  folioId: string;
  amountPesewas: number; // positive number representing discount/credit to reduce balance
  reason: string;
  user: PermissionContextUser;
}

export type HotelPaymentMethod = "CASH" | "MOBILE_MONEY" | "CARD" | "DEPOSIT_CREDIT";

export interface HotelPaymentSplitInput {
  method: HotelPaymentMethod;
  amountPesewas: number;
  tenderedPesewas?: number; // for CASH
  reference?: string; // e.g. MoMo ref or card auth code
  provider?: string; // e.g. "MTN", "TELECEL", "VISA"
  notes?: string;
}

export interface SettleHotelFolioInput {
  folioId: string;
  payments: HotelPaymentSplitInput[];
  checkOut?: boolean; // if true, also update reservation to CHECKED_OUT and room to DIRTY
  overrideUnpaidBalance?: boolean;
  overrideReason?: string;
  notes?: string;
  user: PermissionContextUser;
}

export interface HotelReceiptItemSnapshot {
  category: "ROOM_NIGHT" | "RESTAURANT" | "EXTRA" | "TAX" | "ADJUSTMENT";
  description: string;
  amountPesewas: number;
  details?: Record<string, unknown>;
}

export interface HotelReceiptDetail {
  id: string;
  receiptNumber: string;
  reservationId: string | null;
  reservationReference: string | null;
  folioId: string;
  folioNumber: string;
  customerName: string;
  customerPhone: string;
  roomNumber: string | null;
  roomTypeName: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  subtotalPesewas: number;
  discountPesewas: number;
  discountReason: string | null;
  taxesPesewas: number;
  totalPesewas: number;
  amountPaidPesewas: number;
  changePesewas: number;
  balanceDuePesewas: number;
  status: "PAID" | "PARTIALLY_PAID" | "VOIDED";
  cashierName: string;
  items: HotelReceiptItemSnapshot[];
  payments: HotelPaymentSplitInput[];
  notes: string | null;
  createdAt: string;
}

// -------------------------------------------------------------
// 1. Search In-House Guests
// -------------------------------------------------------------

/**
 * Searches in-house guests (reservations with status CHECKED_IN and active rooms).
 * Staff can search by room number, guest name, or phone number.
 */
export async function getInHouseGuests(query?: string): Promise<InHouseGuestSummary[]> {
  const trimmed = query?.trim().toLowerCase();

  const reservations = await prisma.reservation.findMany({
    where: {
      status: ReservationStatus.CHECKED_IN,
      rooms: {
        some: {
          roomId: { not: null },
        },
      },
      ...(trimmed
        ? {
            OR: [
              { guest: { name: { contains: trimmed, mode: "insensitive" } } },
              { guest: { phone: { contains: trimmed } } },
              { reference: { contains: trimmed, mode: "insensitive" } },
              {
                rooms: {
                  some: {
                    room: { number: { contains: trimmed, mode: "insensitive" } },
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      guest: true,
      rooms: {
        include: {
          room: true,
          roomType: true,
        },
      },
      folios: {
        include: {
          charges: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const results: InHouseGuestSummary[] = [];

  for (const res of reservations) {
    const resRoom = res.rooms[0];
    const folio = res.folios[0];
    if (!folio) continue;

    let totalCharges = 0;
    let totalPayments = 0;

    for (const c of folio.charges) {
      if (c.source === FolioChargeSource.PAYMENT) {
        totalPayments += c.amountPesewas;
      } else {
        totalCharges += c.amountPesewas;
      }
    }

    const balancePesewas = Math.max(0, totalCharges - totalPayments);

    results.push({
      reservationId: res.id,
      reservationReference: res.reference,
      folioId: folio.id,
      folioNumber: folio.folioNumber,
      guestId: res.guestId,
      guestName: res.guest?.name || "Guest",
      guestPhone: res.guest?.phone || "",
      roomNumber: resRoom?.room?.number || "Unassigned",
      roomTypeId: resRoom?.roomTypeId || "",
      roomTypeName: resRoom?.roomType?.name || "Standard Room",
      checkInDate: formatDateOnly(res.checkInDate),
      checkOutDate: formatDateOnly(res.checkOutDate),
      balancePesewas,
    });
  }

  return results;
}

// -------------------------------------------------------------
// 2. Get Folio Details & Running Balance
// -------------------------------------------------------------

/**
 * Retrieves full folio ledger with all itemized charges, payments, and running balance.
 */
export async function getFolioDetails(
  identifier: { folioId?: string; reservationId?: string },
  _user: PermissionContextUser
): Promise<FolioDetails> {
  const folio = await prisma.folio.findFirst({
    where: identifier.folioId
      ? { id: identifier.folioId }
      : { reservationId: identifier.reservationId },
    include: {
      charges: {
        include: {
          createdByUser: {
            select: { id: true, name: true, role: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      reservation: {
        include: {
          guest: true,
          rooms: {
            include: {
              room: true,
              roomType: true,
            },
          },
        },
      },
    },
  });

  if (!folio) {
    throw new AppError("Folio not found", 404, "FOLIO_NOT_FOUND");
  }

  let roomChargesPesewas = 0;
  let restaurantChargesPesewas = 0;
  let extraChargesPesewas = 0;
  let adjustmentPesewas = 0;
  let totalPaymentsPesewas = 0;

  const chargeItems: FolioChargeItem[] = [];

  for (const c of folio.charges) {
    chargeItems.push({
      id: c.id,
      folioId: c.folioId,
      description: c.description,
      source: c.source,
      amountPesewas: c.amountPesewas,
      referenceId: c.referenceId,
      createdByUserId: c.createdByUserId,
      createdByName: c.createdByUser?.name || null,
      createdAt: c.createdAt.toISOString(),
    });

    switch (c.source) {
      case FolioChargeSource.ROOM:
        roomChargesPesewas += c.amountPesewas;
        break;
      case FolioChargeSource.RESTAURANT:
        restaurantChargesPesewas += c.amountPesewas;
        break;
      case FolioChargeSource.EXTRA:
        extraChargesPesewas += c.amountPesewas;
        break;
      case FolioChargeSource.ADJUSTMENT:
        adjustmentPesewas += c.amountPesewas; // can be negative (discount) or positive
        break;
      case FolioChargeSource.PAYMENT:
        totalPaymentsPesewas += c.amountPesewas;
        break;
    }
  }

  const totalGrossChargesPesewas =
    roomChargesPesewas + restaurantChargesPesewas + extraChargesPesewas;
  const totalNetChargesPesewas = totalGrossChargesPesewas + adjustmentPesewas;
  const runningBalancePesewas = Math.max(0, totalNetChargesPesewas - totalPaymentsPesewas);

  const resRoom = folio.reservation?.rooms[0];

  return {
    folioId: folio.id,
    folioNumber: folio.folioNumber,
    reservationId: folio.reservationId,
    reservationReference: folio.reservation?.reference || null,
    status: folio.status,
    guestName: folio.reservation?.guest?.name || undefined,
    guestPhone: folio.reservation?.guest?.phone || undefined,
    roomNumber: resRoom?.room?.number || undefined,
    roomTypeName: resRoom?.roomType?.name || undefined,
    checkInDate: folio.reservation ? formatDateOnly(folio.reservation.checkInDate) : undefined,
    checkOutDate: folio.reservation ? formatDateOnly(folio.reservation.checkOutDate) : undefined,
    charges: chargeItems,
    financials: {
      roomChargesPesewas,
      restaurantChargesPesewas,
      extraChargesPesewas,
      adjustmentPesewas,
      totalGrossChargesPesewas,
      totalNetChargesPesewas,
      totalPaymentsPesewas,
      runningBalancePesewas,
      isSettled: runningBalancePesewas === 0,
    },
  };
}

// -------------------------------------------------------------
// 3. POS: Charge to Room Tender
// -------------------------------------------------------------

/**
 * Posts a charge from the POS or Restaurant terminal directly to an in-house guest's folio.
 * RBAC Rules:
 * - Only FRONT_DESK, WAITER, MANAGER, and OWNER_ADMIN may use it.
 * - WAITER role is strictly limited to restaurant items only (source: RESTAURANT).
 */
export async function chargeToRoomFromPos(input: ChargeToRoomInput): Promise<FolioChargeItem> {
  const { user, folioId, description, source, amountPesewas, referenceId, items } = input;

  // 1. Role verification
  const allowedRoles: string[] = [
    ROLES.FRONT_DESK,
    ROLES.WAITER,
    ROLES.MANAGER,
    ROLES.OWNER_ADMIN,
  ];

  if (!allowedRoles.includes(user.role)) {
    throw new AppError(
      `Role ${user.role} is not authorized to charge to room folios`,
      403,
      "FORBIDDEN_CHARGE_TO_ROOM"
    );
  }

  // 2. If WAITER, enforce restaurant items only
  if (user.role === ROLES.WAITER && source !== "RESTAURANT") {
    throw new AppError(
      "Waiters are only authorized to post restaurant charges to room folios",
      403,
      "WAITER_RESTAURANT_ONLY"
    );
  }

  if (amountPesewas <= 0) {
    throw new AppError("Charge amount must be greater than zero", 400);
  }

  // 3. Verify Folio exists and guest is currently in-house
  const folio = await prisma.folio.findUnique({
    where: { id: folioId },
    include: {
      reservation: {
        include: {
          guest: true,
          rooms: { include: { room: true } },
        },
      },
    },
  });

  if (!folio) {
    throw new AppError("Folio not found", 404, "FOLIO_NOT_FOUND");
  }

  if (folio.status !== FolioStatus.OPEN) {
    throw new AppError(
      `Cannot post charges to a folio with status ${folio.status}`,
      400,
      "FOLIO_NOT_OPEN"
    );
  }

  if (folio.reservation && folio.reservation.status !== ReservationStatus.CHECKED_IN) {
    throw new AppError(
      `Cannot post room charges: reservation status is ${folio.reservation.status} (guest must be CHECKED_IN)`,
      400,
      "GUEST_NOT_IN_HOUSE"
    );
  }

  const roomNumber = folio.reservation?.rooms[0]?.room?.number || "Unknown";
  const guestName = folio.reservation?.guest?.name || "Guest";

  // 4. Create FolioCharge and AuditLog atomically
  const result = await prisma.$transaction(async (tx) => {
    const charge = await tx.folioCharge.create({
      data: {
        folioId,
        description,
        source: source === "RESTAURANT" ? FolioChargeSource.RESTAURANT : FolioChargeSource.EXTRA,
        amountPesewas,
        referenceId: referenceId || null,
        createdByUserId: user.userId,
      },
      include: {
        createdByUser: { select: { id: true, name: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.userId,
        action: "POS_CHARGE_TO_ROOM",
        entityType: "FolioCharge",
        entityId: charge.id,
        newValues: {
          folioId,
          folioNumber: folio.folioNumber,
          roomNumber,
          guestName,
          source,
          amountPesewas,
          amountGhs: formatPesewas(amountPesewas),
          referenceId,
          itemCount: items?.length || 1,
        },
      },
    });

    return charge;
  });

  return {
    id: result.id,
    folioId: result.folioId,
    description: result.description,
    source: result.source,
    amountPesewas: result.amountPesewas,
    referenceId: result.referenceId,
    createdByUserId: result.createdByUserId,
    createdByName: result.createdByUser?.name || null,
    createdAt: result.createdAt.toISOString(),
  };
}

// -------------------------------------------------------------
// 4. Folio Adjustments (Discounts & Corrections)
// -------------------------------------------------------------

/**
 * Applies a discount/correction adjustment to a folio.
 * Enforces role discount ceilings and mandatory reason:
 * - FRONT_DESK: max 5% discount
 * - MANAGER: max 20% discount
 * - OWNER_ADMIN: max 100% discount
 * - WAITER / HOUSEKEEPING / KITCHEN: 0% discount
 */
export async function applyFolioAdjustment(input: FolioAdjustmentInput): Promise<FolioChargeItem> {
  const { folioId, amountPesewas, reason, user } = input;

  const trimmedReason = reason?.trim();
  if (!trimmedReason) {
    throw new AppError("A reason is strictly required when applying an adjustment", 400, "ADJUSTMENT_REASON_REQUIRED");
  }

  if (amountPesewas <= 0) {
    throw new AppError("Adjustment amount must be a positive integer in pesewas", 400);
  }

  const folio = await prisma.folio.findUnique({
    where: { id: folioId },
    include: {
      charges: true,
      reservation: { select: { id: true, reference: true } },
    },
  });

  if (!folio) {
    throw new AppError("Folio not found", 404, "FOLIO_NOT_FOUND");
  }

  if (folio.status !== FolioStatus.OPEN) {
    throw new AppError(`Cannot adjust folio with status ${folio.status}`, 400, "FOLIO_NOT_OPEN");
  }

  // Calculate gross charges to assess discount percentage ceiling
  let grossChargesPesewas = 0;
  for (const c of folio.charges) {
    if (
      c.source === FolioChargeSource.ROOM ||
      c.source === FolioChargeSource.RESTAURANT ||
      c.source === FolioChargeSource.EXTRA
    ) {
      grossChargesPesewas += c.amountPesewas;
    }
  }

  if (grossChargesPesewas <= 0) {
    throw new AppError("Cannot apply discount to a folio with zero gross charges", 400);
  }

  const requestedDiscountPercent = (amountPesewas / grossChargesPesewas) * 100;
  const roleLimit = ROLE_DEFAULT_LIMITS[user.role]?.maxDiscountPercent ?? 0;

  if (requestedDiscountPercent > roleLimit + 0.001) {
    throw new AppError(
      `Discount of ${requestedDiscountPercent.toFixed(1)}% exceeds your role's allowed maximum of ${roleLimit}%. Manager or Owner approval required.`,
      403,
      "DISCOUNT_CEILING_EXCEEDED"
    );
  }

  // Store adjustment as negative amountPesewas to reduce total charges
  const adjustmentAmountStored = -amountPesewas;

  const result = await prisma.$transaction(async (tx) => {
    const charge = await tx.folioCharge.create({
      data: {
        folioId,
        description: `Adjustment / Discount: ${trimmedReason}`,
        source: FolioChargeSource.ADJUSTMENT,
        amountPesewas: adjustmentAmountStored,
        createdByUserId: user.userId,
      },
      include: {
        createdByUser: { select: { id: true, name: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.userId,
        action: "FOLIO_ADJUSTMENT",
        entityType: "FolioCharge",
        entityId: charge.id,
        newValues: {
          folioId,
          folioNumber: folio.folioNumber,
          reservationReference: folio.reservation?.reference,
          discountPesewas: amountPesewas,
          discountGhs: formatPesewas(amountPesewas),
          discountPercent: Number(requestedDiscountPercent.toFixed(2)),
          reason: trimmedReason,
          role: user.role,
        },
      },
    });

    return charge;
  });

  return {
    id: result.id,
    folioId: result.folioId,
    description: result.description,
    source: result.source,
    amountPesewas: result.amountPesewas,
    referenceId: result.referenceId,
    createdByUserId: result.createdByUserId,
    createdByName: result.createdByUser?.name || null,
    createdAt: result.createdAt.toISOString(),
  };
}

// -------------------------------------------------------------
// 5. Checkout Settlement & Split Payments (Invoice-Style Receipt)
// -------------------------------------------------------------

/**
 * Settles a folio with split payments (Cash, MoMo, Card, Deposit credit).
 * Uses row-level lock via ReceiptCounter for atomic zero-gap receipt numbers.
 * Dispatches an SMS receipt to the guest.
 */
export async function settleHotelCheckoutWithSplitPayments(
  input: SettleHotelFolioInput
): Promise<HotelReceiptDetail> {
  const { folioId, payments, checkOut, overrideUnpaidBalance, overrideReason, notes, user } = input;

  // 1. RBAC Check
  requirePermission(user, PERMISSION_KEYS.PAYMENTS_RECORD);

  // 2. Fetch Folio with reservation, rooms, and charges
  const folio = await prisma.folio.findUnique({
    where: { id: folioId },
    include: {
      charges: true,
      reservation: {
        include: {
          guest: true,
          rooms: {
            include: {
              room: true,
              roomType: true,
            },
          },
          extras: {
            include: { extra: true },
          },
        },
      },
    },
  });

  if (!folio) {
    throw new AppError("Folio not found", 404, "FOLIO_NOT_FOUND");
  }

  const reservation = folio.reservation;
  const guest = reservation?.guest;
  const resRoom = reservation?.rooms[0];

  // 3. Compute Itemized Totals & Running Balance
  const receiptItems: HotelReceiptItemSnapshot[] = [];

  let roomChargesPesewas = 0;
  let restaurantChargesPesewas = 0;
  let extraChargesPesewas = 0;
  let totalTaxesPesewas = 0;
  let adjustmentPesewas = 0;
  let previousPaymentsPesewas = 0;

  for (const c of folio.charges) {
    switch (c.source) {
      case FolioChargeSource.ROOM:
        roomChargesPesewas += c.amountPesewas;
        receiptItems.push({
          category: "ROOM_NIGHT",
          description: c.description,
          amountPesewas: c.amountPesewas,
        });
        break;
      case FolioChargeSource.RESTAURANT:
        restaurantChargesPesewas += c.amountPesewas;
        receiptItems.push({
          category: "RESTAURANT",
          description: c.description,
          amountPesewas: c.amountPesewas,
          details: { referenceId: c.referenceId },
        });
        break;
      case FolioChargeSource.EXTRA:
        if (
          c.description.toLowerCase().includes("tax") ||
          c.description.toLowerCase().includes("levy")
        ) {
          totalTaxesPesewas += c.amountPesewas;
          receiptItems.push({
            category: "TAX",
            description: c.description,
            amountPesewas: c.amountPesewas,
          });
        } else {
          extraChargesPesewas += c.amountPesewas;
          receiptItems.push({
            category: "EXTRA",
            description: c.description,
            amountPesewas: c.amountPesewas,
          });
        }
        break;
      case FolioChargeSource.ADJUSTMENT:
        adjustmentPesewas += c.amountPesewas;
        receiptItems.push({
          category: "ADJUSTMENT",
          description: c.description,
          amountPesewas: c.amountPesewas,
        });
        break;
      case FolioChargeSource.PAYMENT:
        previousPaymentsPesewas += c.amountPesewas;
        break;
    }
  }

  const grossCharges = roomChargesPesewas + restaurantChargesPesewas + extraChargesPesewas + totalTaxesPesewas;
  const netCharges = grossCharges + adjustmentPesewas;
  const outstandingBeforeCurrentTender = Math.max(0, netCharges - previousPaymentsPesewas);

  // 5. Validate Payments Tendered
  if (!payments || payments.length === 0) {
    throw new AppError("At least one payment tender is required", 400);
  }

  let totalTenderedPesewas = 0;
  let totalChangePesewas = 0;

  for (const p of payments) {
    if (p.amountPesewas < 0) {
      throw new AppError("Payment amount cannot be negative", 400);
    }

    if (p.method === "CASH") {
      const tendered = p.tenderedPesewas ?? p.amountPesewas;
      if (tendered < p.amountPesewas) {
        throw new AppError("Cash tendered cannot be less than the cash amount due", 400);
      }
      totalChangePesewas += tendered - p.amountPesewas;
    }

    totalTenderedPesewas += p.amountPesewas;
  }

  const remainingBalanceAfterTender = Math.max(
    0,
    outstandingBeforeCurrentTender - totalTenderedPesewas
  );

  // 6. Check Unpaid Balance Rule
  if (remainingBalanceAfterTender > 0) {
    const isManagerOrAbove =
      user.role === ROLES.MANAGER || user.role === ROLES.OWNER_ADMIN;

    if (!isManagerOrAbove) {
      throw new AppError(
        `Cannot settle checkout with an outstanding balance of ${formatPesewas(
          remainingBalanceAfterTender
        )}. Full settlement required, or manager override required.`,
        400,
        "UNPAID_BALANCE_REQUIRES_MANAGER_OVERRIDE"
      );
    }

    if (!overrideUnpaidBalance || !overrideReason?.trim()) {
      throw new AppError(
        `Manager override with reason is strictly required when settling checkout with unpaid balance of ${formatPesewas(
          remainingBalanceAfterTender
        )}`,
        400,
        "MANAGER_OVERRIDE_REASON_REQUIRED"
      );
    }
  }

  const customerName = guest?.name || "Hotel Guest";
  const customerPhone = guest?.phone || "+233000000000";

  // 7. Atomic Settlement Transaction with Gapless ReceiptCounter
  const result = await prisma.$transaction(async (tx) => {
    // Generate sequential gapless receipt number atomically
    const receiptNumber = await generateNextReceiptNumber(tx, "R");

    // Create FolioCharge records for current payments
    for (const p of payments) {
      if (p.amountPesewas > 0) {
        await tx.folioCharge.create({
          data: {
            folioId,
            description: `Payment: ${p.method}${p.provider ? ` (${p.provider})` : ""}${
              p.reference ? ` Ref: ${p.reference}` : ""
            }`,
            source: FolioChargeSource.PAYMENT,
            amountPesewas: p.amountPesewas,
            referenceId: p.reference || receiptNumber,
            createdByUserId: user.userId,
          },
        });
      }
    }

    // Determine status
    const isFullyPaid = remainingBalanceAfterTender === 0;

    // Create Receipt record
    const receipt = await tx.receipt.create({
      data: {
        receiptNumber,
        bookingId: null, // Hotel reservation, not salon booking
        customerId: guest?.id || null,
        cashierId: user.userId,
        customerName,
        customerPhone,
        subtotalPesewas: grossCharges,
        discountPesewas: Math.abs(Math.min(0, adjustmentPesewas)),
        discountReason: overrideReason || null,
        totalPesewas: netCharges,
        amountPaidPesewas: totalTenderedPesewas + previousPaymentsPesewas,
        changePesewas: totalChangePesewas,
        balanceDuePesewas: remainingBalanceAfterTender,
        status: isFullyPaid ? "PAID" : "PARTIALLY_PAID",
        items: receiptItems as unknown as Prisma.InputJsonValue,
        payments: payments as unknown as Prisma.InputJsonValue,
        notes: notes?.trim() || null,
      },
      include: {
        cashier: { select: { id: true, name: true } },
      },
    });

    // Update Folio status
    await tx.folio.update({
      where: { id: folioId },
      data: {
        status: isFullyPaid ? FolioStatus.SETTLED : FolioStatus.OPEN,
      },
    });

    // If checkOut requested and reservation exists, update reservation and room
    if (checkOut && reservation) {
      await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          status: ReservationStatus.CHECKED_OUT,
          amountPaidPesewas: totalTenderedPesewas + previousPaymentsPesewas,
        },
      });

      if (resRoom?.roomId) {
        await tx.room.update({
          where: { id: resRoom.roomId },
          data: { status: RoomStatus.DIRTY },
        });

        await tx.housekeepingTask.create({
          data: {
            roomId: resRoom.roomId,
            status: HousekeepingTaskStatus.PENDING,
            notes: `Auto-created on checkout of reservation ${reservation.reference}. Receipt: ${receiptNumber}`,
          },
        });
      }
    }

    // Audit Log
    await tx.auditLog.create({
      data: {
        userId: user.userId,
        action: "HOTEL_FOLIO_SETTLED",
        entityType: "Receipt",
        entityId: receipt.id,
        newValues: {
          receiptNumber,
          folioId,
          folioNumber: folio.folioNumber,
          reservationReference: reservation?.reference,
          totalPesewas: netCharges,
          amountPaidPesewas: totalTenderedPesewas,
          balanceDuePesewas: remainingBalanceAfterTender,
          isFullyPaid,
          paymentMethods: payments.map((p) => p.method),
          checkOut: !!checkOut,
        },
      },
    });

    return receipt;
  });

  // 8. Dispatch SMS Notification to Guest
  try {
    const settings = await getSettings();
    const hotelName = settings.hotelName || "Aura Royal Hotel";
    const checkOutMsg = `${hotelName}: Receipt ${result.receiptNumber}. Stay: ${
      reservation?.reference || folio.folioNumber
    }. Total: ${formatPesewas(netCharges)}. Paid: ${formatPesewas(
      totalTenderedPesewas
    )}. Balance: ${formatPesewas(remainingBalanceAfterTender)}. Thank you for staying with us!`;

    await sendSms({
      recipient: customerPhone,
      message: checkOutMsg,
      senderId: "HotelDesk",
    });
  } catch {
    // Non-blocking SMS failure
  }

  return {
    id: result.id,
    receiptNumber: result.receiptNumber,
    reservationId: reservation?.id || null,
    reservationReference: reservation?.reference || null,
    folioId: folio.id,
    folioNumber: folio.folioNumber,
    customerName,
    customerPhone,
    roomNumber: resRoom?.room?.number || null,
    roomTypeName: resRoom?.roomType?.name || null,
    checkInDate: reservation ? formatDateOnly(reservation.checkInDate) : null,
    checkOutDate: reservation ? formatDateOnly(reservation.checkOutDate) : null,
    subtotalPesewas: grossCharges,
    discountPesewas: Math.abs(Math.min(0, adjustmentPesewas)),
    discountReason: overrideReason || null,
    taxesPesewas: totalTaxesPesewas,
    totalPesewas: netCharges,
    amountPaidPesewas: totalTenderedPesewas + previousPaymentsPesewas,
    changePesewas: totalChangePesewas,
    balanceDuePesewas: remainingBalanceAfterTender,
    status: result.status as "PAID" | "PARTIALLY_PAID",
    cashierName: result.cashier?.name || "Front Desk",
    items: receiptItems,
    payments,
    notes: result.notes,
    createdAt: result.createdAt.toISOString(),
  };
}

// -------------------------------------------------------------
// 6. Void & Refund Operations
// -------------------------------------------------------------

/**
 * Voids an individual FolioCharge (e.g. erroneous room service or item).
 * Requires permission and writes an audit log.
 */
export async function voidFolioCharge(
  chargeId: string,
  reason: string,
  user: PermissionContextUser
): Promise<{ success: boolean; voidedChargeId: string }> {
  const trimmedReason = reason?.trim();
  if (!trimmedReason) {
    throw new AppError("Reason is strictly required to void a folio charge", 400);
  }

  const allowedRoles: string[] = [ROLES.OWNER_ADMIN, ROLES.MANAGER, ROLES.FRONT_DESK];
  if (!allowedRoles.includes(user.role)) {
    requirePermission(user, PERMISSION_KEYS.PAYMENTS_REFUND);
  }

  const charge = await prisma.folioCharge.findUnique({
    where: { id: chargeId },
    include: {
      folio: {
        include: { reservation: { select: { reference: true } } },
      },
    },
  });

  if (!charge) {
    throw new AppError("Folio charge not found", 404);
  }

  if (charge.folio.status !== FolioStatus.OPEN) {
    throw new AppError(
      `Cannot void a charge on a settled or closed folio (${charge.folio.status})`,
      400
    );
  }

  // Check refund limit if voiding a payment or charge
  const roleLimit = ROLE_DEFAULT_LIMITS[user.role]?.maxRefundPesewas ?? 0;
  if (Math.abs(charge.amountPesewas) > roleLimit) {
    throw new AppError(
      `Charge amount ${formatPesewas(Math.abs(charge.amountPesewas))} exceeds your role refund limit of ${formatPesewas(roleLimit)}. Manager or Owner approval required.`,
      403,
      "REFUND_LIMIT_EXCEEDED"
    );
  }

  await prisma.$transaction(async (tx) => {
    // Delete or reverse the charge
    await tx.folioCharge.delete({
      where: { id: chargeId },
    });

    await tx.auditLog.create({
      data: {
        userId: user.userId,
        action: "FOLIO_CHARGE_VOIDED",
        entityType: "FolioCharge",
        entityId: chargeId,
        newValues: {
          folioId: charge.folioId,
          folioNumber: charge.folio.folioNumber,
          reservationReference: charge.folio.reservation?.reference,
          description: charge.description,
          source: charge.source,
          amountPesewas: charge.amountPesewas,
          amountGhs: formatPesewas(charge.amountPesewas),
          reason: trimmedReason,
        },
      },
    });
  });

  return { success: true, voidedChargeId: chargeId };
}

/**
 * Voids a hotel checkout receipt and reverses the settlement.
 */
export async function voidHotelReceipt(
  receiptId: string,
  reason: string,
  user: PermissionContextUser
): Promise<HotelReceiptDetail> {
  requirePermission(user, PERMISSION_KEYS.PAYMENTS_REFUND);

  const trimmedReason = reason?.trim();
  if (!trimmedReason) {
    throw new AppError("Reason is strictly required to void a hotel receipt", 400);
  }

  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: { cashier: { select: { name: true } } },
  });

  if (!receipt) {
    throw new AppError("Receipt not found", 404);
  }

  if (receipt.status === "VOIDED") {
    throw new AppError("This receipt has already been voided", 400);
  }

  // Check role refund ceiling
  const roleLimit = ROLE_DEFAULT_LIMITS[user.role]?.maxRefundPesewas ?? 0;
  if (receipt.amountPaidPesewas > roleLimit) {
    throw new AppError(
      `Receipt total of ${formatPesewas(receipt.amountPaidPesewas)} exceeds your role refund limit of ${formatPesewas(roleLimit)}. Manager or Owner approval required.`,
      403,
      "REFUND_LIMIT_EXCEEDED"
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const voided = await tx.receipt.update({
      where: { id: receiptId },
      data: {
        status: "VOIDED",
        voidedAt: new Date(),
        voidReason: trimmedReason,
        voidedByUserId: user.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.userId,
        action: "HOTEL_RECEIPT_VOIDED",
        entityType: "Receipt",
        entityId: receipt.id,
        newValues: {
          receiptNumber: receipt.receiptNumber,
          amountPaidPesewas: receipt.amountPaidPesewas,
          reason: trimmedReason,
        },
      },
    });

    return voided;
  });

  return {
    id: updated.id,
    receiptNumber: updated.receiptNumber,
    reservationId: null,
    reservationReference: null,
    folioId: "",
    folioNumber: "",
    customerName: updated.customerName,
    customerPhone: updated.customerPhone,
    roomNumber: null,
    roomTypeName: null,
    checkInDate: null,
    checkOutDate: null,
    subtotalPesewas: updated.subtotalPesewas,
    discountPesewas: updated.discountPesewas,
    discountReason: updated.discountReason,
    taxesPesewas: 0,
    totalPesewas: updated.totalPesewas,
    amountPaidPesewas: updated.amountPaidPesewas,
    changePesewas: updated.changePesewas,
    balanceDuePesewas: updated.balanceDuePesewas,
    status: "VOIDED",
    cashierName: receipt.cashier?.name || "Cashier",
    items: updated.items as unknown as HotelReceiptItemSnapshot[],
    payments: updated.payments as unknown as HotelPaymentSplitInput[],
    notes: updated.notes,
    createdAt: updated.createdAt.toISOString(),
  };
}
