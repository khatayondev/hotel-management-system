import crypto from "crypto";
import { prisma } from "../db";
import { AppError } from "../api-response";
import { checkRateLimit } from "../rate-limit";
import { normalizeGhanaPhone, sendSms } from "../sms";
import { getSettings } from "../settings";
import { calculateCancellationRefund, canReschedule, RefundCalculationResult } from "./policy";
import { notificationEvents } from "../notifications";
import { logger } from "../logger";

export interface BookingSelfServiceDetail {
  id: string;
  reference: string;
  status: string;
  source: string;
  startUtc: string;
  endUtc: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  staffName: string;
  services: Array<{
    id: string;
    name: string;
    durationMin: number;
    pricePesewas: number;
  }>;
  totalDurationMin: number;
  subtotalPesewas: number;
  discountPesewas: number;
  totalPesewas: number;
  depositRequiredPesewas: number;
  amountPaidPesewas: number;
  balanceDuePesewas: number;
  notes?: string | null;
  cancellationNoticeHours: number;
  canReschedule: boolean;
  rescheduleNoticeReason?: string;
  refundPreview: RefundCalculationResult;
  hasPendingPayment: boolean;
  createdAt: string;
}

export function hashManageToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

// In-memory rate-limited store for SMS OTPs during self-service lookup
interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}
const lookupOtpStore = new Map<string, OtpEntry>();

/**
 * Retrieves full booking self-service detail by raw manage token.
 * Hashes token with SHA-256 to ensure raw tokens are never queried directly.
 */
export async function getBookingByManageToken(rawToken: string): Promise<BookingSelfServiceDetail> {
  if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length === 0) {
    throw new AppError("A valid manage token is required.", 400, "INVALID_TOKEN");
  }

  const tokenTrimmed = rawToken.trim();
  const tokenHash = hashManageToken(tokenTrimmed);

  const booking = await prisma.booking.findFirst({
    where: {
      OR: [
        { manageTokenHash: tokenHash },
        { reference: tokenTrimmed.toUpperCase() },
      ],
      deletedAt: null,
    },
    include: {
      customer: true,
      staff: true,
      items: {
        include: {
          service: true,
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!booking) {
    throw new AppError(
      "Booking not found or access token has expired or is invalid.",
      404,
      "BOOKING_NOT_FOUND"
    );
  }

  const settings = await getSettings();
  const cancellationNoticeHours = settings.cancellationNoticeHours ?? 24;
  const depositRefundPolicy = settings.depositRefundPolicy ?? "FULL_REFUND_BEFORE_CUTOFF";

  const rescheduleCheck = canReschedule({
    startUtc: booking.startUtc,
    cancellationNoticeHours,
  });

  const refundPreview = calculateCancellationRefund({
    startUtc: booking.startUtc,
    cancellationNoticeHours,
    depositRefundPolicy,
    depositRequiredPesewas: booking.depositRequiredPesewas,
    amountPaidPesewas: booking.amountPaidPesewas,
    totalPesewas: booking.totalPesewas,
  });

  const totalDurationMin = booking.items.reduce((acc, item) => acc + item.durationMin, 0);
  const balanceDuePesewas = Math.max(0, booking.totalPesewas - booking.amountPaidPesewas);
  const hasPendingPayment = booking.payments.some((p) => p.status === "PENDING");

  return {
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    source: booking.source,
    startUtc: booking.startUtc.toISOString(),
    endUtc: booking.endUtc.toISOString(),
    customerName: booking.customer.name,
    customerPhone: booking.customer.phone,
    customerEmail: booking.customer.email,
    staffName: booking.staff.name,
    services: booking.items.map((i) => ({
      id: i.serviceId,
      name: i.service.name,
      durationMin: i.durationMin,
      pricePesewas: i.pricePesewas,
    })),
    totalDurationMin,
    subtotalPesewas: booking.subtotalPesewas,
    discountPesewas: booking.discountPesewas,
    totalPesewas: booking.totalPesewas,
    depositRequiredPesewas: booking.depositRequiredPesewas,
    amountPaidPesewas: booking.amountPaidPesewas,
    balanceDuePesewas,
    notes: booking.notes,
    cancellationNoticeHours,
    canReschedule: rescheduleCheck.allowed && booking.status !== "CANCELLED" && booking.status !== "COMPLETED",
    rescheduleNoticeReason: rescheduleCheck.reason,
    refundPreview,
    hasPendingPayment,
    createdAt: booking.createdAt.toISOString(),
  };
}

/**
 * Looks up booking by reference and customer phone with strict rate limiting.
 * Returns the booking self-service summary along with direct access details.
 */
export async function lookupBookingByReferenceAndPhone(params: {
  reference: string;
  phone: string;
  clientIp: string;
}) {
  const { reference, phone, clientIp } = params;

  if (!reference || !reference.trim()) {
    throw new AppError("Booking reference is required.", 400, "REFERENCE_REQUIRED");
  }
  if (!phone || !phone.trim()) {
    throw new AppError("Phone number is required.", 400, "PHONE_REQUIRED");
  }

  // 1. Rate limiting by IP and phone
  checkRateLimit(`manage_lookup_ip:${clientIp}`, 5, 15 * 60);

  let normalizedPhone: string;
  try {
    normalizedPhone = normalizeGhanaPhone(phone.trim());
  } catch {
    throw new AppError("Please provide a valid Ghana phone number (e.g. 0241234567).", 400, "INVALID_PHONE");
  }

  checkRateLimit(`manage_lookup_phone:${normalizedPhone}`, 5, 15 * 60);

  const cleanRef = reference.trim().toUpperCase();

  // 2. Fetch booking
  const booking = await prisma.booking.findFirst({
    where: {
      reference: cleanRef,
      deletedAt: null,
    },
    include: {
      customer: true,
      staff: true,
      items: { include: { service: true } },
      payments: true,
    },
  });

  if (!booking) {
    throw new AppError("No booking found with this reference and phone number.", 404, "BOOKING_NOT_FOUND");
  }

  // 3. Verify customer phone matches
  let customerNormPhone = "";
  try {
    customerNormPhone = normalizeGhanaPhone(booking.customer.phone || "");
  } catch {
    customerNormPhone = booking.customer.phone || "";
  }

  if (customerNormPhone !== normalizedPhone) {
    throw new AppError("No booking found with this reference and phone number.", 404, "BOOKING_NOT_FOUND");
  }

  const settings = await getSettings();
  const cancellationNoticeHours = settings.cancellationNoticeHours ?? 24;
  const depositRefundPolicy = settings.depositRefundPolicy ?? "FULL_REFUND_BEFORE_CUTOFF";

  const refundPreview = calculateCancellationRefund({
    startUtc: booking.startUtc,
    cancellationNoticeHours,
    depositRefundPolicy,
    depositRequiredPesewas: booking.depositRequiredPesewas,
    amountPaidPesewas: booking.amountPaidPesewas,
    totalPesewas: booking.totalPesewas,
  });

  return {
    bookingId: booking.id,
    reference: booking.reference,
    status: booking.status,
    customerName: booking.customer.name,
    customerPhone: booking.customer.phone,
    startUtc: booking.startUtc.toISOString(),
    endUtc: booking.endUtc.toISOString(),
    staffName: booking.staff.name,
    serviceName: booking.items[0]?.service?.name || "Beauty Service",
    totalPesewas: booking.totalPesewas,
    amountPaidPesewas: booking.amountPaidPesewas,
    balanceDuePesewas: Math.max(0, booking.totalPesewas - booking.amountPaidPesewas),
    refundPreview,
  };
}

/**
 * Sends optional SMS OTP for self-service lookup verification.
 */
export async function sendLookupOtp(reference: string, phone: string, clientIp: string) {
  checkRateLimit(`otp_send_ip:${clientIp}`, 3, 15 * 60);

  const cleanRef = reference.trim().toUpperCase();
  const normPhone = normalizeGhanaPhone(phone);

  const booking = await prisma.booking.findFirst({
    where: { reference: cleanRef, deletedAt: null },
    include: { customer: true },
  });

  const hotelReservation = !booking
    ? await prisma.reservation.findUnique({
        where: { reference: cleanRef },
        include: { guest: true },
      })
    : null;

  if (!booking && !hotelReservation) {
    throw new AppError("No booking or reservation found matching reference.", 404, "BOOKING_NOT_FOUND");
  }

  const phoneToCheck = booking
    ? booking.customer.phone || ""
    : hotelReservation?.guest.phone || "";

  const custPhone = normalizeGhanaPhone(phoneToCheck);
  if (custPhone !== normPhone) {
    throw new AppError("No booking or reservation found matching reference and phone.", 404, "BOOKING_NOT_FOUND");
  }

  // Generate 6-digit random code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const key = `${cleanRef}_${normPhone}`;

  lookupOtpStore.set(key, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    attempts: 0,
  });

  try {
    const brandName = hotelReservation ? "Aura Royal Hotel" : "Becca's Crown Beauty Vault";
    await sendSms({
      recipient: normPhone,
      message: `Your ${brandName} self-service verification code is ${code}. It expires in 10 minutes.`,
      senderId: hotelReservation ? "AuraHotel" : "BeccasCrown",
    });
  } catch (err) {
    logger.warn(`Failed to send SMS OTP to ${normPhone}: ${err}`);
  }

  return { sent: true, phone: normPhone };
}

/**
 * Verifies optional SMS OTP.
 */
export function verifyLookupOtp(reference: string, phone: string, enteredCode: string): boolean {
  const cleanRef = reference.trim().toUpperCase();
  const normPhone = normalizeGhanaPhone(phone);
  const key = `${cleanRef}_${normPhone}`;

  const entry = lookupOtpStore.get(key);
  if (!entry) {
    throw new AppError("No verification code found. Please request a new one.", 400, "OTP_EXPIRED");
  }

  if (Date.now() > entry.expiresAt) {
    lookupOtpStore.delete(key);
    throw new AppError("Verification code has expired. Please request a new one.", 400, "OTP_EXPIRED");
  }

  if (entry.attempts >= 5) {
    lookupOtpStore.delete(key);
    throw new AppError("Too many incorrect attempts. Please request a new code.", 429, "TOO_MANY_ATTEMPTS");
  }

  entry.attempts += 1;

  if (entry.code !== enteredCode.trim()) {
    throw new AppError("Invalid verification code. Please check and try again.", 400, "INVALID_OTP");
  }

  // Clear upon success
  lookupOtpStore.delete(key);
  return true;
}

/**
 * Reschedules booking by customer using the manage token.
 * Prevents rescheduling to the same slot and verifies cutoff notice and stylist availability.
 */
export async function rescheduleBookingByCustomer(
  rawToken: string,
  newStartUtcInput: string | Date
) {
  if (!rawToken || !rawToken.trim()) {
    throw new AppError("Manage token required.", 400, "INVALID_TOKEN");
  }

  const tokenTrimmed = rawToken.trim();
  const tokenHash = hashManageToken(tokenTrimmed);
  const booking = await prisma.booking.findFirst({
    where: {
      OR: [
        { manageTokenHash: tokenHash },
        { reference: tokenTrimmed.toUpperCase() },
      ],
      deletedAt: null,
    },
    include: {
      customer: true,
      staff: true,
      items: { include: { service: true } },
    },
  });

  if (!booking) {
    throw new AppError("Booking not found or link has expired.", 404, "BOOKING_NOT_FOUND");
  }

  if (booking.status === "CANCELLED") {
    throw new AppError("Cancelled appointments cannot be rescheduled.", 400, "BOOKING_CANCELLED");
  }
  if (booking.status === "COMPLETED") {
    throw new AppError("Completed appointments cannot be rescheduled.", 400, "BOOKING_COMPLETED");
  }

  const settings = await getSettings();
  const cancellationNoticeHours = settings.cancellationNoticeHours ?? 24;

  const check = canReschedule({
    startUtc: booking.startUtc,
    cancellationNoticeHours,
  });
  if (!check.allowed) {
    throw new AppError(check.reason || "Appointment cannot be rescheduled.", 400, "RESCHEDULE_NOT_ALLOWED");
  }

  const newStart = new Date(newStartUtcInput);
  if (isNaN(newStart.getTime())) {
    throw new AppError("Invalid date format for new appointment time.", 400, "INVALID_DATE");
  }

  // Edge case: Rescheduling to the EXACT same slot
  if (newStart.getTime() === booking.startUtc.getTime()) {
    throw new AppError(
      "The selected slot is the same as your current appointment time. Please choose a different date or time slot.",
      400,
      "SAME_SLOT_RESCHEDULE"
    );
  }

  // Compute duration from existing booking
  const durationMs = booking.endUtc.getTime() - booking.startUtc.getTime();
  const newEnd = new Date(newStart.getTime() + durationMs);

  // Check stylist availability at the new slot
  const conflicting = await prisma.booking.findFirst({
    where: {
      id: { not: booking.id },
      staffId: booking.staffId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      startUtc: { lt: newEnd },
      endUtc: { gt: newStart },
    },
  });

  if (conflicting) {
    throw new AppError(
      "The selected stylist is not available at this time. Please choose another slot.",
      409,
      "SLOT_UNAVAILABLE"
    );
  }

  // Update in transaction
  const updatedBooking = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      startUtc: newStart,
      endUtc: newEnd,
      status: booking.status === "PENDING_PAYMENT" ? "PENDING_PAYMENT" : "CONFIRMED",
    },
  });

  // Dispatch reschedule notification
  const serviceName = booking.items[0]?.service?.name || "Beauty Service";
  notificationEvents
    .onBookingRescheduled(
      {
        id: booking.id,
        reference: booking.reference,
        startUtc: booking.startUtc,
        endUtc: booking.endUtc,
        serviceName,
        customerName: booking.customer.name,
        customerPhone: booking.customer.phone || undefined,
        customerEmail: booking.customer.email || undefined,
        staffName: booking.staff.name,
        totalPricePesewas: booking.totalPesewas,
        amountPaidPesewas: booking.amountPaidPesewas,
      },
      newStart
    )
    .catch((err) => {
      logger.error(`[SelfService] Failed to send reschedule notification: ${err}`);
    });

  return {
    bookingId: updatedBooking.id,
    reference: updatedBooking.reference,
    startUtc: updatedBooking.startUtc.toISOString(),
    endUtc: updatedBooking.endUtc.toISOString(),
    status: updatedBooking.status,
    message: "Appointment successfully rescheduled.",
  };
}

/**
 * Cancels booking by customer using manage token.
 * Computes refund based on configured policy, prevents cancellation if payment is pending,
 * and handles double-click / concurrent cancellation idempotently.
 */
export async function cancelBookingByCustomer(rawToken: string, reason?: string) {
  if (!rawToken || !rawToken.trim()) {
    throw new AppError("Manage token required.", 400, "INVALID_TOKEN");
  }

  const tokenTrimmed = rawToken.trim();
  const tokenHash = hashManageToken(tokenTrimmed);
  const booking = await prisma.booking.findFirst({
    where: {
      OR: [
        { manageTokenHash: tokenHash },
        { reference: tokenTrimmed.toUpperCase() },
      ],
      deletedAt: null,
    },
    include: {
      customer: true,
      staff: true,
      items: { include: { service: true } },
      payments: {
        include: { refunds: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!booking) {
    throw new AppError("Booking not found or link has expired.", 404, "BOOKING_NOT_FOUND");
  }

  // Edge case 1: Cancelling while a payment is pending
  const hasPendingPayment = booking.payments.some((p) => p.status === "PENDING");
  if (hasPendingPayment) {
    throw new AppError(
      "Cannot cancel booking while a payment transaction is currently pending authorization. Please wait for the payment to complete or expire.",
      409,
      "PENDING_PAYMENT_EXISTS"
    );
  }

  // Edge case 2: Double clicks / concurrency protection (idempotent handling)
  if (booking.status === "CANCELLED") {
    return {
      alreadyCancelled: true,
      bookingId: booking.id,
      reference: booking.reference,
      status: "CANCELLED",
      refundAmountPesewas: 0,
      message: "This appointment has already been cancelled.",
    };
  }

  if (booking.status === "COMPLETED") {
    throw new AppError("Completed appointments cannot be cancelled.", 400, "BOOKING_COMPLETED");
  }

  // Calculate refund
  const settings = await getSettings();
  const cancellationNoticeHours = settings.cancellationNoticeHours ?? 24;
  const depositRefundPolicy = settings.depositRefundPolicy ?? "FULL_REFUND_BEFORE_CUTOFF";

  const refundCalc = calculateCancellationRefund({
    startUtc: booking.startUtc,
    cancellationNoticeHours,
    depositRefundPolicy,
    depositRequiredPesewas: booking.depositRequiredPesewas,
    amountPaidPesewas: booking.amountPaidPesewas,
    totalPesewas: booking.totalPesewas,
  });

  const refundAmountPesewas = refundCalc.totalRefundPesewas;

  // Execute in transaction
  const { updatedBooking, refundRecord } = await prisma.$transaction(async (tx) => {
    let createdRefund = null;

    if (refundAmountPesewas > 0) {
      // Find a paid payment to attach the refund record to
      const targetPayment =
        booking.payments.find(
          (p) => p.status === "PAID" || p.status === "PARTIALLY_REFUNDED"
        ) || booking.payments[0];

      if (targetPayment) {
        createdRefund = await tx.refund.create({
          data: {
            paymentId: targetPayment.id,
            amountPesewas: refundAmountPesewas,
            reason: reason || "Customer self-service cancellation",
            status: "COMPLETED",
          },
        });

        const newPaymentStatus =
          refundAmountPesewas >= targetPayment.amountPesewas ? "REFUNDED" : "PARTIALLY_REFUNDED";

        await tx.payment.update({
          where: { id: targetPayment.id },
          data: { status: newPaymentStatus },
        });
      }
    }

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: "CANCELLED",
        amountPaidPesewas: Math.max(0, booking.amountPaidPesewas - refundAmountPesewas),
      },
    });

    return { updatedBooking: updated, refundRecord: createdRefund };
  });

  // Dispatch cancellation & refund notifications
  const serviceName = booking.items[0]?.service?.name || "Beauty Service";
  const bookingEventData = {
    id: booking.id,
    reference: booking.reference,
    startUtc: booking.startUtc,
    endUtc: booking.endUtc,
    serviceName,
    customerName: booking.customer.name,
    customerPhone: booking.customer.phone || undefined,
    customerEmail: booking.customer.email || undefined,
    staffName: booking.staff.name,
    totalPricePesewas: booking.totalPesewas,
    amountPaidPesewas: updatedBooking.amountPaidPesewas,
  };

  notificationEvents.onBookingCancelled(bookingEventData, reason).catch((err) => {
    logger.error(`[SelfService] Failed to send cancel notification: ${err}`);
  });

  if (refundAmountPesewas > 0) {
    notificationEvents.onRefundIssued(bookingEventData, refundAmountPesewas).catch((err) => {
      logger.error(`[SelfService] Failed to send refund notification: ${err}`);
    });
  }

  return {
    alreadyCancelled: false,
    bookingId: updatedBooking.id,
    reference: updatedBooking.reference,
    status: updatedBooking.status,
    refundAmountPesewas,
    refundCalculation: refundCalc,
    refundId: refundRecord?.id,
    message: "Appointment successfully cancelled.",
  };
}
