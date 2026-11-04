import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/api-response";
import {
  type PermissionContextUser,
  PERMISSION_KEYS,
  requirePermission,
  ROLE_DEFAULT_LIMITS,
} from "@/lib/rbac";
import { generateNextReceiptNumber } from "./receipt-counter";
import { normalizeGhanaPhone } from "@/lib/sms";
import { formatPesewas } from "@/lib/money";
import { formatDate, formatDateTime, nowUtc } from "@/lib/date";
import type {
  PosCheckoutInput,
  PosReceiptDetail,
  ReceiptSnapshotItem,
  ReceiptSnapshotPayment,
  EndOfDaySummary,
} from "./types";
import crypto from "crypto";

/**
 * Validates and calculates items subtotal.
 */
function calculateItemsSubtotal(items: PosCheckoutInput["items"]): {
  subtotalPesewas: number;
  totalDurationMin: number;
  snapshotItems: ReceiptSnapshotItem[];
} {
  if (!items || items.length === 0) {
    throw new AppError("At least one service item is required for checkout", 400);
  }

  let subtotalPesewas = 0;
  let totalDurationMin = 0;
  const snapshotItems: ReceiptSnapshotItem[] = [];

  for (const item of items) {
    if (item.pricePesewas < 0 || item.durationMin < 0) {
      throw new AppError("Invalid service price or duration", 400);
    }

    let itemTotal = item.pricePesewas;
    let itemDuration = item.durationMin;
    const addOns = item.addOns || [];

    for (const addon of addOns) {
      if (addon.pricePesewas < 0 || addon.durationMin < 0) {
        throw new AppError("Invalid add-on price or duration", 400);
      }
      itemTotal += addon.pricePesewas;
      itemDuration += addon.durationMin;
    }

    subtotalPesewas += itemTotal;
    totalDurationMin += itemDuration;

    snapshotItems.push({
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      pricePesewas: item.pricePesewas,
      durationMin: item.durationMin,
      addOns: addOns.map((a) => ({
        id: a.id,
        name: a.name,
        pricePesewas: a.pricePesewas,
        durationMin: a.durationMin,
      })),
      totalItemPesewas: itemTotal,
    });
  }

  return { subtotalPesewas, totalDurationMin, snapshotItems };
}

/**
 * Processes POS Checkout atomically with PostgreSQL row-level locks to ensure
 * sequential gapless receipt numbers (R-000123) and proper financial ledgering.
 */
export async function processPosCheckout(
  input: PosCheckoutInput,
  cashier: PermissionContextUser
): Promise<PosReceiptDetail> {
  // 1. RBAC check: Cashier must have payments.record permission
  requirePermission(cashier, PERMISSION_KEYS.PAYMENTS_RECORD);

  // 2. Validate Items & Subtotal
  const { subtotalPesewas, totalDurationMin, snapshotItems } = calculateItemsSubtotal(input.items);

  // 3. Discount & Promo validation
  let discountPesewas = 0;
  let discountPercent = input.discountPercent || 0;
  let discountReason = input.discountReason?.trim();
  let promoCodeApplied: string | null = null;

  // Handle Promo Code if supplied
  if (input.promoCode?.trim()) {
    const promo = await prisma.promoCode.findUnique({
      where: { code: input.promoCode.trim().toUpperCase() },
    });

    if (!promo || !promo.active) {
      throw new AppError(`Promo code "${input.promoCode}" is invalid or inactive`, 400);
    }

    if (promo.validUntil && promo.validUntil < new Date()) {
      throw new AppError(`Promo code "${input.promoCode}" has expired`, 400);
    }

    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      throw new AppError(`Promo code "${input.promoCode}" usage limit reached`, 400);
    }

    if (promo.discountType === "PERCENTAGE") {
      discountPercent = promo.discountValue;
      discountPesewas = Math.round((subtotalPesewas * discountPercent) / 100);
    } else {
      discountPesewas = Math.min(subtotalPesewas, promo.discountValue);
      discountPercent = subtotalPesewas > 0 ? (discountPesewas / subtotalPesewas) * 100 : 0;
    }

    promoCodeApplied = promo.code;
    discountReason = discountReason || `Promo: ${promo.code}`;
  } else if (input.discountPercent !== undefined || input.discountPesewas !== undefined) {
    // Manual discount applied: Enforce discounts.apply permission and role limits
    requirePermission(cashier, PERMISSION_KEYS.DISCOUNTS_APPLY);

    if (input.discountPercent !== undefined) {
      discountPercent = input.discountPercent;
      if (discountPercent < 0 || discountPercent > 100) {
        throw new AppError("Discount percentage must be between 0 and 100", 400);
      }
      discountPesewas = Math.round((subtotalPesewas * discountPercent) / 100);
    } else if (input.discountPesewas !== undefined) {
      discountPesewas = Math.min(subtotalPesewas, Math.max(0, input.discountPesewas));
      discountPercent = subtotalPesewas > 0 ? (discountPesewas / subtotalPesewas) * 100 : 0;
    }

    // If discount is applied, enforce role limit and mandatory reason
    if (discountPesewas > 0) {
      if (!discountReason) {
        throw new AppError("Reason is required when applying a discount", 400, "DISCOUNT_REASON_REQUIRED");
      }

      const roleLimit = ROLE_DEFAULT_LIMITS[cashier.role]?.maxDiscountPercent ?? 0;
      if (discountPercent > roleLimit) {
        throw new AppError(
          `Discount of ${discountPercent.toFixed(1)}% exceeds your role's allowed maximum of ${roleLimit}%. Manager or Owner approval required.`,
          403,
          "DISCOUNT_LIMIT_EXCEEDED",
          { role: cashier.role, maxDiscountPercent: roleLimit, requestedPercent: discountPercent }
        );
      }
    }
  }

  // 4. Calculate Net Total & Tip
  const tipPesewas = Math.max(0, input.tipPesewas || 0);
  const netBeforeTip = Math.max(0, subtotalPesewas - discountPesewas);
  const totalPesewas = netBeforeTip + tipPesewas;

  // 5. Validate Split Payments
  if (!input.payments || input.payments.length === 0) {
    throw new AppError("At least one payment method is required for checkout", 400);
  }

  let amountPaidPesewas = 0;
  let totalChangePesewas = 0;
  const snapshotPayments: ReceiptSnapshotPayment[] = [];

  for (const p of input.payments) {
    if (p.amountPesewas < 0) {
      throw new AppError("Payment amount cannot be negative", 400);
    }

    let change = 0;
    if (p.method === "CASH") {
      const tendered = p.tenderedPesewas ?? p.amountPesewas;
      if (tendered < p.amountPesewas) {
        throw new AppError("Cash tendered cannot be less than the cash amount due", 400);
      }
      change = tendered - p.amountPesewas;
      totalChangePesewas += change;
    }

    amountPaidPesewas += p.amountPesewas;

    snapshotPayments.push({
      method: p.method,
      amountPesewas: p.amountPesewas,
      tenderedPesewas: p.tenderedPesewas,
      changePesewas: change > 0 ? change : undefined,
      reference: p.reference?.trim() || undefined,
      provider: p.provider?.trim() || undefined,
      notes: p.notes?.trim() || undefined,
    });
  }

  // Determine balance due & status
  let balanceDuePesewas = 0;
  let receiptStatus: "PAID" | "PARTIALLY_PAID" = "PAID";

  if (amountPaidPesewas < totalPesewas) {
    balanceDuePesewas = totalPesewas - amountPaidPesewas;
    receiptStatus = "PARTIALLY_PAID";
  }

  // 6. Customer Resolution (Find, Quick-Create, or Default Walk-in)
  let customerId = input.customerId;
  let customerName = "Walk-in Guest";
  let customerPhone = "+233000000000";

  if (input.customerId) {
    const existing = await prisma.customer.findUnique({
      where: { id: input.customerId },
    });
    if (!existing) {
      throw new AppError("Customer not found", 404);
    }
    customerId = existing.id;
    customerName = existing.name;
    customerPhone = existing.phone;
  } else if (input.customer?.phone && input.customer.phone.trim()) {
    try {
      const normPhone = normalizeGhanaPhone(input.customer.phone);
      const existing = await prisma.customer.findUnique({
        where: { phone: normPhone },
      });

      if (existing) {
        customerId = existing.id;
        customerName = input.customer.name?.trim() || existing.name;
        customerPhone = existing.phone;
      } else {
        // Create new customer
        customerName = input.customer.name?.trim() || "Walk-in Customer";
        customerPhone = normPhone;
        const createdCustomer = await prisma.customer.create({
          data: {
            name: customerName,
            phone: customerPhone,
            email: input.customer.email?.trim() || null,
            notes: input.customer.notes?.trim() || null,
          },
        });
        customerId = createdCustomer.id;
      }
    } catch {
      // If phone normalization failed, fallback to default walk-in customer below
    }
  }

  // If still no customer resolved (e.g. quick walk-in sale without registered customer)
  if (!customerId) {
    const defaultPhone = "+233000000000";
    let defaultCustomer = await prisma.customer.findUnique({
      where: { phone: defaultPhone },
    });

    if (!defaultCustomer) {
      defaultCustomer = await prisma.customer.create({
        data: {
          name: "Walk-in Guest",
          phone: defaultPhone,
          notes: "System default customer for POS walk-in sales without registered profile",
        },
      });
    }

    customerId = defaultCustomer.id;
    customerName = input.customer?.name?.trim() || defaultCustomer.name;
    customerPhone = defaultCustomer.phone;
  }

  // 7. Staff Resolution
  let assignedStaffId = input.staffId;
  if (!assignedStaffId) {
    // If not provided, assign first active staff member
    const defaultStaff = await prisma.staff.findFirst({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    });
    if (!defaultStaff) {
      throw new AppError("No active staff member available for assignment", 400);
    }
    assignedStaffId = defaultStaff.id;
  }

  // 8. Execute Database Transaction with Atomic Gapless Receipt Counter
  const result = await prisma.$transaction(async (tx) => {
    // A. Generate sequential gapless receipt number using row-level lock
    const receiptNumber = await generateNextReceiptNumber(tx, "R");

    // B. Create Booking record for walk-in or in-store appointment
    const startUtc = input.scheduledStartUtc ? new Date(input.scheduledStartUtc) : nowUtc();
    const endUtc = new Date(startUtc.getTime() + totalDurationMin * 60 * 1000);
    const bookingRef = `BK-W${Date.now().toString(36).toUpperCase().slice(-5)}`;
    const manageToken = crypto.randomBytes(24).toString("hex");
    const manageTokenHash = crypto.createHash("sha256").update(manageToken).digest("hex");

    const isFutureAppointment = !input.isWalkIn && startUtc.getTime() > Date.now() + 15 * 60 * 1000;
    const initialStatus = isFutureAppointment
      ? (amountPaidPesewas > 0 ? "CONFIRMED" : "PENDING_PAYMENT")
      : (amountPaidPesewas >= totalPesewas ? "COMPLETED" : "CHECKED_IN");

    const booking = await tx.booking.create({
      data: {
        reference: bookingRef,
        source: input.isWalkIn !== false ? "WALK_IN" : "POS",
        status: initialStatus,
        startUtc,
        endUtc,
        staffId: assignedStaffId!,
        customerId: customerId!,
        subtotalPesewas,
        discountPesewas,
        totalPesewas,
        depositRequiredPesewas: isFutureAppointment ? Math.round(totalPesewas * 0.5) : totalPesewas,
        amountPaidPesewas,
        notes: input.notes?.trim() || null,
        manageTokenHash,
        items: {
          create: snapshotItems.map((item) => ({
            serviceId: item.serviceId,
            pricePesewas: item.totalItemPesewas,
            durationMin: item.durationMin,
          })),
        },
      },
    });

    // C. Create Receipt record
    const receipt = await tx.receipt.create({
      data: {
        receiptNumber,
        bookingId: booking.id,
        customerId,
        cashierId: cashier.userId,
        customerName,
        customerPhone,
        subtotalPesewas,
        discountPesewas,
        discountPercent: discountPercent > 0 ? Number(discountPercent.toFixed(2)) : null,
        discountReason: discountReason || null,
        promoCode: promoCodeApplied,
        tipPesewas,
        totalPesewas,
        amountPaidPesewas,
        changePesewas: totalChangePesewas,
        balanceDuePesewas,
        status: receiptStatus,
        items: snapshotItems as unknown as Prisma.InputJsonValue,
        payments: snapshotPayments as unknown as Prisma.InputJsonValue,
        notes: input.notes?.trim() || null,
      },
      include: {
        cashier: { select: { id: true, name: true } },
      },
    });

    // D. Record each payment method in the Payment table
    for (let i = 0; i < snapshotPayments.length; i++) {
      const p = snapshotPayments[i];
      const pRef = p.reference || `POS-${receiptNumber}-${i + 1}`;

      await tx.payment.create({
        data: {
          bookingId: booking.id,
          receiptId: receipt.id,
          reference: pRef,
          amountPesewas: p.amountPesewas,
          currency: "GHS",
          status: "PAID",
          channel: p.method,
          providerReference: p.provider || null,
          paidAt: nowUtc(),
        },
      });
    }

    // E. If promo code applied, increment its usedCount
    if (promoCodeApplied) {
      await tx.promoCode.update({
        where: { code: promoCodeApplied },
        data: { usedCount: { increment: 1 } },
      });
    }

    // F. Audit Log
    await tx.auditLog.create({
      data: {
        userId: cashier.userId,
        action: "POS_CHECKOUT",
        entityType: "Receipt",
        entityId: receipt.id,
        newValues: {
          receiptNumber,
          bookingReference: bookingRef,
          subtotalPesewas,
          discountPesewas,
          totalPesewas,
          amountPaidPesewas,
          balanceDuePesewas,
          paymentMethods: snapshotPayments.map((p) => p.method),
        },
      },
    });

    return { receipt, booking };
  });

  return {
    id: result.receipt.id,
    receiptNumber: result.receipt.receiptNumber,
    bookingId: result.booking.id,
    bookingReference: result.booking.reference,
    customerId,
    customerName,
    customerPhone,
    cashierId: cashier.userId,
    cashierName: result.receipt.cashier.name,
    subtotalPesewas,
    discountPesewas,
    discountPercent: result.receipt.discountPercent,
    discountReason: result.receipt.discountReason,
    promoCode: result.receipt.promoCode,
    tipPesewas,
    totalPesewas,
    amountPaidPesewas,
    changePesewas: totalChangePesewas,
    balanceDuePesewas,
    status: receiptStatus,
    items: snapshotItems,
    payments: snapshotPayments,
    notes: result.receipt.notes,
    createdAt: result.receipt.createdAt.toISOString(),
  };
}

/**
 * Voids a POS receipt and refunds all associated payments.
 * Requires payments.refund permission, reason is mandatory, and verifies role refund limits.
 */
export async function voidPosReceipt(
  receiptId: string,
  reason: string,
  user: PermissionContextUser
): Promise<PosReceiptDetail> {
  // 1. RBAC check: user must have payments.refund permission
  requirePermission(user, PERMISSION_KEYS.PAYMENTS_REFUND);

  // 2. Reason is strictly required
  const cleanReason = reason?.trim();
  if (!cleanReason) {
    throw new AppError("A reason is required to void a receipt", 400, "VOID_REASON_REQUIRED");
  }

  // 3. Find receipt
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      cashier: { select: { id: true, name: true } },
      booking: true,
      receiptPayments: true,
    },
  });

  if (!receipt) {
    throw new AppError("Receipt not found", 404);
  }

  if (receipt.status === "VOIDED") {
    throw new AppError("This receipt has already been voided", 400, "ALREADY_VOIDED");
  }

  // 4. Role Refund Limit Check
  const refundPesewas = receipt.amountPaidPesewas;
  const roleLimit = ROLE_DEFAULT_LIMITS[user.role]?.maxRefundPesewas ?? 0;
  if (refundPesewas > roleLimit) {
    throw new AppError(
      `Void/Refund of ${formatPesewas(refundPesewas)} exceeds your role's allowed maximum of ${formatPesewas(roleLimit)}. Higher authorization required.`,
      403,
      "REFUND_LIMIT_EXCEEDED",
      { role: user.role, maxRefundPesewas: roleLimit, requestedPesewas: refundPesewas }
    );
  }

  // 5. Execute Void in Database Transaction
  const updatedReceipt = await prisma.$transaction(async (tx) => {
    // A. Mark receipt voided
    const updated = await tx.receipt.update({
      where: { id: receiptId },
      data: {
        status: "VOIDED",
        voidedAt: nowUtc(),
        voidReason: cleanReason,
        voidedByUserId: user.userId,
      },
      include: {
        cashier: { select: { id: true, name: true } },
        voidedByUser: { select: { id: true, name: true } },
        booking: true,
      },
    });

    // B. Mark payments as REFUNDED and create Refund records
    for (const payment of receipt.receiptPayments) {
      if (payment.status !== "REFUNDED") {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "REFUNDED" },
        });

        await tx.refund.create({
          data: {
            paymentId: payment.id,
            amountPesewas: payment.amountPesewas,
            reason: cleanReason,
            status: "COMPLETED",
            processedByUserId: user.userId,
          },
        });
      }
    }

    // C. Cancel associated booking if exists
    if (receipt.bookingId) {
      await tx.booking.update({
        where: { id: receipt.bookingId },
        data: {
          status: "CANCELLED",
          amountPaidPesewas: 0,
        },
      });
    }

    // D. Audit log
    await tx.auditLog.create({
      data: {
        userId: user.userId,
        action: "POS_RECEIPT_VOIDED",
        entityType: "Receipt",
        entityId: receipt.id,
        oldValues: { status: receipt.status, amountPaidPesewas: receipt.amountPaidPesewas },
        newValues: { status: "VOIDED", voidReason: cleanReason, voidedAt: updated.voidedAt },
      },
    });

    return updated;
  });

  return {
    id: updatedReceipt.id,
    receiptNumber: updatedReceipt.receiptNumber,
    bookingId: updatedReceipt.bookingId,
    bookingReference: updatedReceipt.booking?.reference,
    customerId: updatedReceipt.customerId,
    customerName: updatedReceipt.customerName,
    customerPhone: updatedReceipt.customerPhone,
    cashierId: updatedReceipt.cashierId,
    cashierName: updatedReceipt.cashier.name,
    subtotalPesewas: updatedReceipt.subtotalPesewas,
    discountPesewas: updatedReceipt.discountPesewas,
    discountPercent: updatedReceipt.discountPercent,
    discountReason: updatedReceipt.discountReason,
    promoCode: updatedReceipt.promoCode,
    tipPesewas: updatedReceipt.tipPesewas,
    totalPesewas: updatedReceipt.totalPesewas,
    amountPaidPesewas: updatedReceipt.amountPaidPesewas,
    changePesewas: updatedReceipt.changePesewas,
    balanceDuePesewas: updatedReceipt.balanceDuePesewas,
    status: "VOIDED",
    voidedAt: updatedReceipt.voidedAt?.toISOString() || null,
    voidReason: updatedReceipt.voidReason,
    voidedByName: updatedReceipt.voidedByUser?.name || null,
    items: updatedReceipt.items as unknown as ReceiptSnapshotItem[],
    payments: updatedReceipt.payments as unknown as ReceiptSnapshotPayment[],
    notes: updatedReceipt.notes,
    createdAt: updatedReceipt.createdAt.toISOString(),
  };
}

/**
 * Computes End of Day financial reconciliation summary.
 * Accessible to Manager and Owner (reports.view).
 */
export async function getEndOfDaySummary(
  dateStr?: string,
  user?: PermissionContextUser
): Promise<EndOfDaySummary> {
  if (user) {
    requirePermission(user, PERMISSION_KEYS.REPORTS_VIEW);
  }

  // Target date range: default today (Africa/Accra)
  const targetDate = dateStr ? new Date(dateStr) : nowUtc();
  const startOfDay = new Date(targetDate);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  // Fetch all receipts created on that day
  const receipts = await prisma.receipt.findMany({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    include: {
      cashier: { select: { id: true, name: true } },
      voidedByUser: { select: { id: true, name: true } },
      booking: {
        include: {
          staff: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  let totalSalesCount = 0;
  let totalRevenuePesewas = 0;
  let grossSubtotalPesewas = 0;
  let totalDiscountsPesewas = 0;
  let totalTipsPesewas = 0;
  let totalBalanceDuePesewas = 0;

  const cashSummary = {
    totalCollectedPesewas: 0,
    totalChangeGivenPesewas: 0,
    netCashInDrawerPesewas: 0,
    transactionCount: 0,
  };

  const momoSummary = {
    totalCollectedPesewas: 0,
    transactionCount: 0,
    byProvider: {} as Record<string, number>,
  };

  const cardSummary = {
    totalCollectedPesewas: 0,
    transactionCount: 0,
    byProvider: {} as Record<string, number>,
  };

  const voidsSummary = {
    count: 0,
    totalVoidedPesewas: 0,
    items: [] as EndOfDaySummary["voids"]["items"],
  };

  const staffTipsMap: Record<string, { staffName: string; tipPesewas: number }> = {};

  for (const r of receipts) {
    if (r.status === "VOIDED") {
      voidsSummary.count += 1;
      voidsSummary.totalVoidedPesewas += r.amountPaidPesewas;
      voidsSummary.items.push({
        receiptNumber: r.receiptNumber,
        totalPesewas: r.amountPaidPesewas,
        voidReason: r.voidReason || "Voided",
        voidedByName: r.voidedByUser?.name || "Unknown",
        voidedAt: r.voidedAt ? r.voidedAt.toISOString() : r.updatedAt.toISOString(),
      });
      continue; // Skip revenue aggregation for voided sales
    }

    totalSalesCount += 1;
    totalRevenuePesewas += r.amountPaidPesewas;
    grossSubtotalPesewas += r.subtotalPesewas;
    totalDiscountsPesewas += r.discountPesewas;
    totalTipsPesewas += r.tipPesewas;
    totalBalanceDuePesewas += r.balanceDuePesewas;

    // Staff tip attribution
    if (r.tipPesewas > 0 && r.booking?.staff) {
      const sId = r.booking.staff.id;
      if (!staffTipsMap[sId]) {
        staffTipsMap[sId] = { staffName: r.booking.staff.name, tipPesewas: 0 };
      }
      staffTipsMap[sId].tipPesewas += r.tipPesewas;
    }

    // Process split payments
    const payments = (r.payments as unknown as ReceiptSnapshotPayment[]) || [];
    for (const p of payments) {
      if (p.method === "CASH") {
        cashSummary.totalCollectedPesewas += p.amountPesewas + (p.changePesewas || 0);
        cashSummary.totalChangeGivenPesewas += p.changePesewas || 0;
        cashSummary.netCashInDrawerPesewas += p.amountPesewas;
        cashSummary.transactionCount += 1;
      } else if (p.method === "MOBILE_MONEY") {
        momoSummary.totalCollectedPesewas += p.amountPesewas;
        momoSummary.transactionCount += 1;
        const prov = p.provider?.toUpperCase() || "GENERAL_MOMO";
        momoSummary.byProvider[prov] = (momoSummary.byProvider[prov] || 0) + p.amountPesewas;
      } else if (p.method === "CARD") {
        cardSummary.totalCollectedPesewas += p.amountPesewas;
        cardSummary.transactionCount += 1;
        const prov = p.provider?.toUpperCase() || "GENERAL_CARD";
        cardSummary.byProvider[prov] = (cardSummary.byProvider[prov] || 0) + p.amountPesewas;
      }
    }
  }

  const staffTips = Object.entries(staffTipsMap).map(([staffId, val]) => ({
    staffId,
    staffName: val.staffName,
    tipPesewas: val.tipPesewas,
  }));

  return {
    date: formatDate(targetDate),
    totalSalesCount,
    totalRevenuePesewas,
    grossSubtotalPesewas,
    totalDiscountsPesewas,
    totalTipsPesewas,
    totalBalanceDuePesewas,
    methods: {
      cash: cashSummary,
      mobileMoney: momoSummary,
      card: cardSummary,
    },
    voids: voidsSummary,
    staffTips,
  };
}

/**
 * Formats a receipt into a structured text message for WhatsApp or SMS sharing.
 */
export function formatReceiptShareText(receipt: PosReceiptDetail): string {
  const lines: string[] = [];
  lines.push("✨ BECCA'S CROWN BEAUTY VAULT ✨");
  lines.push("East Legon, Accra | Tel: +233 24 111 9988");
  lines.push("--------------------------------");
  lines.push(`Receipt: ${receipt.receiptNumber}`);
  lines.push(`Date: ${formatDateTime(receipt.createdAt)}`);
  lines.push(`Customer: ${receipt.customerName} (${receipt.customerPhone})`);
  lines.push(`Cashier: ${receipt.cashierName}`);
  if (receipt.status === "VOIDED") {
    lines.push("⚠️ STATUS: VOIDED");
    if (receipt.voidReason) lines.push(`Reason: ${receipt.voidReason}`);
  }
  lines.push("--------------------------------");
  lines.push("ITEMS:");
  for (const item of receipt.items) {
    lines.push(`• ${item.serviceName} - ${formatPesewas(item.pricePesewas)}`);
    for (const addon of item.addOns || []) {
      lines.push(`  + ${addon.name} (${formatPesewas(addon.pricePesewas)})`);
    }
  }
  lines.push("--------------------------------");
  lines.push(`Subtotal: ${formatPesewas(receipt.subtotalPesewas)}`);
  if (receipt.discountPesewas > 0) {
    const reasonStr = receipt.discountReason ? ` (${receipt.discountReason})` : "";
    lines.push(`Discount${reasonStr}: -${formatPesewas(receipt.discountPesewas)}`);
  }
  if (receipt.tipPesewas > 0) {
    lines.push(`Tip: ${formatPesewas(receipt.tipPesewas)}`);
  }
  lines.push(`TOTAL: ${formatPesewas(receipt.totalPesewas)}`);
  lines.push("--------------------------------");
  lines.push("PAYMENTS:");
  for (const p of receipt.payments) {
    const prov = p.provider ? ` (${p.provider})` : "";
    const ref = p.reference ? ` [Ref: ${p.reference}]` : "";
    lines.push(`• ${p.method}${prov}: ${formatPesewas(p.amountPesewas)}${ref}`);
    if (p.method === "CASH" && p.changePesewas && p.changePesewas > 0) {
      lines.push(`  (Tendered: ${formatPesewas(p.tenderedPesewas || p.amountPesewas)}, Change: ${formatPesewas(p.changePesewas)})`);
    }
  }
  if (receipt.balanceDuePesewas > 0) {
    lines.push(`⚠️ REMAINING BALANCE: ${formatPesewas(receipt.balanceDuePesewas)}`);
  } else {
    lines.push("Status: Paid in Full ✓");
  }
  lines.push("--------------------------------");
  lines.push("Thank you for visiting Becca's Crown Beauty Vault!");
  lines.push("Follow us @beccascrown");

  return lines.join("\n");
}

/**
 * Returns WhatsApp and SMS direct sharing links.
 */
export function getReceiptSharingLinks(receipt: PosReceiptDetail): {
  whatsappUrl: string;
  smsUrl: string;
} {
  const text = formatReceiptShareText(receipt);
  const cleanPhone = receipt.customerPhone.replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  const smsUrl = `sms:${receipt.customerPhone}?body=${encodeURIComponent(text)}`;
  return { whatsappUrl, smsUrl };
}
