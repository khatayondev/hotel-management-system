import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { requirePermission, PERMISSION_KEYS } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse, handleRouteError, AppError } from "@/lib/api-response";
import { generateNextReceiptNumber } from "@/lib/pos/receipt-counter";
import { emitBookingEvent } from "@/lib/booking-events";
import { nowUtc } from "@/lib/date";
import { z } from "zod";

const recordPaymentSchema = z.object({
  amountPesewas: z.number().int().positive("Payment amount must be greater than zero"),
  channel: z.enum(["CASH", "MOBILE_MONEY", "CARD", "BANK_TRANSFER"]).default("CASH"),
  tenderedPesewas: z.number().int().optional(),
  provider: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await props.params;
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    requirePermission(session, PERMISSION_KEYS.PAYMENTS_RECORD);

    const body = await req.json();
    const parsed = recordPaymentSchema.parse(body);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        staff: true,
        items: {
          include: {
            service: true,
          },
        },
      },
    });

    if (!booking) {
      return errorResponse("Booking not found", "NOT_FOUND", 404);
    }

    if (booking.status === "CANCELLED") {
      return errorResponse("Cannot record payment for a cancelled booking", "BAD_REQUEST", 400);
    }

    const currentBalance = Math.max(0, booking.totalPesewas - booking.amountPaidPesewas);
    if (currentBalance <= 0) {
      return errorResponse("This booking is already paid in full", "BAD_REQUEST", 400);
    }

    const amountToApply = Math.min(parsed.amountPesewas, currentBalance);
    const newTotalPaid = booking.amountPaidPesewas + amountToApply;
    const newRemainingBalance = Math.max(0, booking.totalPesewas - newTotalPaid);

    // Calculate cash change if applicable
    let changePesewas = 0;
    if (parsed.channel === "CASH" && parsed.tenderedPesewas && parsed.tenderedPesewas > amountToApply) {
      changePesewas = parsed.tenderedPesewas - amountToApply;
    }

    // Determine new booking status
    const isFuture = booking.startUtc.getTime() > Date.now() + 15 * 60 * 1000;
    let nextStatus = booking.status;
    if (newRemainingBalance === 0) {
      nextStatus = isFuture ? "CONFIRMED" : "COMPLETED";
    } else if (booking.status === "PENDING_PAYMENT" || booking.status === "HELD") {
      nextStatus = "CONFIRMED";
    }

    // Execute atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Generate sequential gapless receipt number
      const receiptNumber = await generateNextReceiptNumber(tx, "R");

      // 2. Format items snapshot for receipt
      const snapshotItems = booking.items.map((item) => ({
        serviceId: item.serviceId,
        serviceName: item.service?.name || "Salon Treatment",
        pricePesewas: item.pricePesewas,
        durationMin: item.durationMin,
        addOns: [],
        totalItemPesewas: item.pricePesewas,
      }));

      const snapshotPayments = [
        {
          method: parsed.channel,
          amountPesewas: amountToApply,
          tenderedPesewas: parsed.tenderedPesewas,
          changePesewas: changePesewas > 0 ? changePesewas : undefined,
          provider: parsed.provider?.trim() || undefined,
          reference: parsed.reference?.trim() || undefined,
          notes: parsed.notes?.trim() || undefined,
        },
      ];

      // 3. Create Receipt
      const receipt = await tx.receipt.create({
        data: {
          receiptNumber,
          bookingId: booking.id,
          customerId: booking.customerId,
          cashierId: session.userId,
          customerName: booking.customer.name,
          customerPhone: booking.customer.phone,
          subtotalPesewas: booking.subtotalPesewas,
          discountPesewas: booking.discountPesewas,
          tipPesewas: 0,
          totalPesewas: booking.totalPesewas,
          amountPaidPesewas: amountToApply,
          changePesewas,
          balanceDuePesewas: newRemainingBalance,
          status: newRemainingBalance === 0 ? "PAID" : "PARTIALLY_PAID",
          items: snapshotItems,
          payments: snapshotPayments,
          notes: parsed.notes?.trim() || `In-person payment recorded via Dashboard`,
        },
      });

      // 4. Create Payment ledger entry
      const pRef = parsed.reference?.trim() || `POS-${receiptNumber}`;
      await tx.payment.create({
        data: {
          bookingId: booking.id,
          receiptId: receipt.id,
          reference: pRef,
          amountPesewas: amountToApply,
          currency: "GHS",
          status: "PAID",
          channel: parsed.channel,
          providerReference: parsed.provider?.trim() || null,
          paidAt: nowUtc(),
        },
      });

      // 5. Update Booking balance & status
      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          amountPaidPesewas: newTotalPaid,
          status: nextStatus,
        },
      });

      // 6. Audit Log
      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "RECORD_IN_PERSON_PAYMENT",
          entityType: "Booking",
          entityId: booking.id,
          newValues: {
            receiptNumber,
            amountPaidPesewas: amountToApply,
            channel: parsed.channel,
            previousBalance: currentBalance,
            newRemainingBalance,
            newStatus: nextStatus,
          },
        },
      });

      return {
        receipt,
        booking: updatedBooking,
        changePesewas,
      };
    });

    // Real-time broadcast
    emitBookingEvent({
      type: "PAYMENT_REQUEST_PAID",
      bookingId: booking.id,
      reference: booking.reference,
      staffId: booking.staffId,
      amountPesewas: amountToApply,
      timestamp: new Date().toISOString(),
    });

    return successResponse(
      result,
      `Payment of GH₵ ${(amountToApply / 100).toFixed(2)} recorded successfully`,
      201
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
