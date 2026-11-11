import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendSms } from "@/lib/sms";
import { formatPesewas } from "@/lib/money";
import { AppError } from "@/lib/api-response";
import { emitBookingEvent } from "@/lib/booking-events";
import { VerifyPaymentResult, PaymentStatusType, BookingStatusType } from "./types";
import {
  assertPaymentTransition,
  assertCanConfirmBooking,
  assertBookingTransition,
} from "./state-machine";

export interface ReconcileOptions {
  reference: string;
  providerResult: VerifyPaymentResult;
  source: "WEBHOOK" | "RETURN_URL" | "JOB" | "POS";
  auditUserId?: string;
}

export interface ReconcileResult {
  success: boolean;
  alreadyProcessed: boolean;
  paymentId: string;
  bookingId?: string | null;
  reservationId?: string | null;
  reservationReference?: string | null;
  paymentStatus: PaymentStatusType;
  bookingStatus?: BookingStatusType;
  reservationStatus?: string;
  amountPaidPesewas: number;
  message: string;
}

/**
 * Reconciles a Paystack transaction with row-level locking.
 * Guarantees that concurrent webhooks and return-page verifications do NOT race.
 */
export async function reconcilePaymentTransaction(
  options: ReconcileOptions
): Promise<ReconcileResult> {
  const { reference, providerResult, source, auditUserId } = options;

  return await prisma.$transaction(async (tx) => {
    // 1. Acquire row-level lock on Payment record
    const lockedPayments = await tx.$queryRaw<
      Array<{
        id: string;
        reference: string;
        status: PaymentStatusType;
        bookingId: string | null;
        amountPesewas: number;
        currency: string;
      }>
    >`SELECT id, reference, status, "bookingId", "amountPesewas", currency FROM "Payment" WHERE reference = ${reference} FOR UPDATE`;

    if (!lockedPayments || lockedPayments.length === 0) {
      throw new AppError(
        `Payment record with reference "${reference}" not found`,
        404,
        "PAYMENT_NOT_FOUND"
      );
    }

    const payment = lockedPayments[0];

    // 2. Idempotency Check: if already PAID, return immediately
    if (payment.status === "PAID") {
      logger.info(
        `[Reconcile:${source}] Payment ${reference} is already PAID. Skipping re-processing.`
      );
      return {
        success: true,
        alreadyProcessed: true,
        paymentId: payment.id,
        bookingId: payment.bookingId,
        paymentStatus: payment.status,
        amountPaidPesewas: payment.amountPesewas,
        message: "Payment already settled",
      };
    }

    // 3. Handle Provider Status
    if (providerResult.status === "success") {
      assertPaymentTransition(payment.status, "PAID");

      // Verify currency matches
      if (providerResult.currency.toUpperCase() !== "GHS") {
        throw new AppError(
          `Payment currency mismatch: expected GHS, got ${providerResult.currency}`,
          400,
          "CURRENCY_MISMATCH"
        );
      }

      // Update Payment to PAID
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          channel: providerResult.channel.toUpperCase() || "MOBILE_MONEY",
          paidAt: providerResult.paidAt ? new Date(providerResult.paidAt) : new Date(),
          providerReference: providerResult.reference,
        },
      });

      let updatedBookingStatus: BookingStatusType | undefined;
      let reservationId: string | null = (providerResult.metadata?.reservationId as string) || null;
      let reservationReference: string | undefined = providerResult.metadata?.reservationReference as string | undefined;
      let updatedReservationStatus: string | undefined;
      let customerPhone: string | undefined;
      let customerEmail: string | undefined;
      let customerName: string | undefined;
      let bookingReference: string | undefined;
      let bookingStartUtc: Date | undefined;
      let bookingServiceName: string | undefined;
      let balanceRemainingPesewas = 0;

      // 4. Update associated Booking if attached
      if (payment.bookingId) {
        const lockedBookings = await tx.$queryRaw<
          Array<{
            id: string;
            reference: string;
            status: BookingStatusType;
            totalPesewas: number;
            depositRequiredPesewas: number;
            amountPaidPesewas: number;
            customerId: string;
            startUtc: Date;
          }>
        >`SELECT id, reference, status, "totalPesewas", "depositRequiredPesewas", "amountPaidPesewas", "customerId", "startUtc" FROM "Booking" WHERE id = ${payment.bookingId} FOR UPDATE`;

        if (lockedBookings && lockedBookings.length > 0) {
          const booking = lockedBookings[0];
          bookingReference = booking.reference;
          bookingStartUtc = booking.startUtc;

          // Check deposit requirement
          assertCanConfirmBooking(
            booking,
            payment.amountPesewas,
            providerResult.currency
          );

          const newAmountPaid = booking.amountPaidPesewas + payment.amountPesewas;
          balanceRemainingPesewas = Math.max(0, booking.totalPesewas - newAmountPaid);
          let nextBookingStatus = booking.status;

          // If pending payment and deposit satisfied, promote to CONFIRMED
          if (
            booking.status === "PENDING_PAYMENT" &&
            newAmountPaid >= booking.depositRequiredPesewas
          ) {
            assertBookingTransition(booking.status, "CONFIRMED");
            nextBookingStatus = "CONFIRMED";
          }

          await tx.booking.update({
            where: { id: booking.id },
            data: {
              amountPaidPesewas: newAmountPaid,
              status: nextBookingStatus,
            },
          });

          updatedBookingStatus = nextBookingStatus;

          // Fetch customer for confirmation SMS & Email
          const customer = await tx.customer.findUnique({
            where: { id: booking.customerId },
          });
          if (customer?.phone) {
            customerPhone = customer.phone;
          }
          if (customer?.email) {
            customerEmail = customer.email;
          }
          if (customer?.name) {
            customerName = customer.name;
          }

          // Fetch primary service name
          const firstItem = await tx.bookingItem.findFirst({
            where: { bookingId: booking.id },
            include: { service: true },
          });
          if (firstItem?.service?.name) {
            bookingServiceName = firstItem.service.name;
          }
        }
      }

      // 4b. Update associated Hotel Reservation if attached
      if (!reservationId && payment.reference) {
        const matchingRes = await tx.reservation.findFirst({
          where: {
            OR: [
              { reference: payment.reference },
              ...(reservationReference ? [{ reference: reservationReference }] : []),
            ],
          },
        });
        if (matchingRes) {
          reservationId = matchingRes.id;
          reservationReference = matchingRes.reference;
        }
      }

      if (reservationId) {
        const reservation = await tx.reservation.findUnique({
          where: { id: reservationId },
          include: { guest: true, folios: true },
        });

        if (reservation) {
          reservationReference = reservation.reference;
          const newAmountPaid = reservation.amountPaidPesewas + payment.amountPesewas;
          let nextReservationStatus = reservation.status;

          if (
            reservation.status === "PENDING_PAYMENT" &&
            newAmountPaid >= reservation.depositRequiredPesewas
          ) {
            nextReservationStatus = "CONFIRMED";
          }

          await tx.reservation.update({
            where: { id: reservation.id },
            data: {
              amountPaidPesewas: newAmountPaid,
              status: nextReservationStatus,
            },
          });

          updatedReservationStatus = nextReservationStatus;

          if (nextReservationStatus === "CONFIRMED") {
            await tx.reservationRoom.updateMany({
              where: { reservationId: reservation.id },
              data: { status: "CONFIRMED" },
            });
          }

          if (reservation.folios.length > 0) {
            const folio = reservation.folios[0];
            await tx.folioCharge.create({
              data: {
                folioId: folio.id,
                description: `Online Payment (${providerResult.channel || "PAYSTACK"}) - Ref: ${reference}`,
                source: "PAYMENT",
                amountPesewas: payment.amountPesewas,
                referenceId: reference,
              },
            });
          }

          // Release room hold if hold token matches
          const holdToken = (providerResult.metadata?.holdToken as string) || reference;
          await tx.roomHold.deleteMany({
            where: {
              OR: [
                { token: holdToken },
                { token: reference },
              ],
            },
          });

          // Dispatch SMS for hotel confirmation
          if (reservation.guest?.phone && nextReservationStatus === "CONFIRMED") {
            try {
              const { env } = await import("@/lib/env");
              const checkInStr = reservation.checkInDate.toISOString().slice(0, 10);
              const remainingPesewas = Math.max(0, reservation.totalPesewas - newAmountPaid);
              const manageUrl = `${env.APP_URL}/manage/${reservation.reference}`;
              await sendSms({
                recipient: reservation.guest.phone,
                message: `Aura Royal Hotel: Your stay (${reservation.reference}) is CONFIRMED! Check-in: ${checkInStr}. Balance due: ${formatPesewas(remainingPesewas)}. Manage your stay: ${manageUrl}`,
              });
            } catch (smsErr) {
              logger.warn(`Failed to dispatch hotel confirmation SMS for ${reservation.reference}`, { error: smsErr });
            }
          }
        }
      }

      // 4c. Update associated Restaurant Order if attached
      const matchingRestaurantOrder = await tx.restaurantOrder.findFirst({
        where: {
          OR: [
            { paystackReference: reference },
            { orderNumber: reference },
          ],
        },
      });

      if (matchingRestaurantOrder) {
        // Promote paymentStatus to PAID
        // If it was PLACED, promote to ACCEPTED so it reaches the kitchen
        let nextStatus = matchingRestaurantOrder.status;
        let acceptedAt = matchingRestaurantOrder.acceptedAt;
        if (matchingRestaurantOrder.status === "PLACED") {
          nextStatus = "ACCEPTED";
          acceptedAt = new Date();
        }

        await tx.restaurantOrder.update({
          where: { id: matchingRestaurantOrder.id },
          data: {
            paymentStatus: "PAID",
            status: nextStatus,
            acceptedAt,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: auditUserId || null,
            action: "RESTAURANT_ORDER_PAID",
            entityType: "RestaurantOrder",
            entityId: matchingRestaurantOrder.id,
            newValues: {
              orderNumber: matchingRestaurantOrder.orderNumber,
              paymentStatus: "PAID",
              status: nextStatus,
              providerReference: reference,
              amountPesewas: payment.amountPesewas,
            },
          },
        });
      }

      // 5. Release any active hold for this reference/booking
      await tx.slotHold.deleteMany({
        where: { token: reference },
      });

      // 6. Record Audit Log
      await tx.auditLog.create({
        data: {
          userId: auditUserId || null,
          action: "PAYMENT_SETTLED",
          entityType: "Payment",
          entityId: payment.id,
          newValues: {
            reference,
            amountPesewas: payment.amountPesewas,
            status: "PAID",
            source,
            bookingStatus: updatedBookingStatus,
          },
        },
      });

      // 7. Dispatch SMS & Resend Email Confirmations
      if (bookingReference && updatedBookingStatus === "CONFIRMED") {
        const { env } = await import("@/lib/env");
        const manageUrl = `${env.APP_URL}/manage/${bookingReference}`;

        if (customerPhone) {
          try {
            await sendSms({
              recipient: customerPhone,
              message: `Becca's Crown Beauty Vault: Your booking (${bookingReference}) has been confirmed! Payment received: ${formatPesewas(
                payment.amountPesewas
              )}. View & manage your booking pass: ${manageUrl}`,
            });
          } catch (smsErr) {
            logger.warn(`Failed to dispatch confirmation SMS for ${bookingReference}`, {
              error: smsErr,
            });
          }
        }

        if (customerEmail) {
          try {
            const { sendResendEmail } = await import("@/lib/email/resend");
            const { buildBookingConfirmedEmail } = await import("@/lib/email/templates");
            const { env } = await import("@/lib/env");

            const dateFormatted = bookingStartUtc
              ? bookingStartUtc.toLocaleDateString("en-GB", {
                  timeZone: "Africa/Accra",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "Upcoming";
            const timeFormatted = bookingStartUtc
              ? bookingStartUtc.toLocaleTimeString("en-GB", {
                  timeZone: "Africa/Accra",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })
              : "Reserved Time";

            const { subject, html, text } = buildBookingConfirmedEmail({
              customerName: customerName || "Valued Client",
              serviceName: bookingServiceName || "Crown Beauty Treatment",
              dateFormatted,
              timeFormatted,
              reference: bookingReference,
              amountDue: formatPesewas(balanceRemainingPesewas),
              manageUrl: `${env.APP_URL}/manage/${bookingReference}`,
            });

            await sendResendEmail({
              to: customerEmail,
              subject,
              html,
              text,
            });
          } catch (emailErr) {
            logger.warn(`Failed to dispatch confirmation email for ${bookingReference}`, {
              error: emailErr,
            });
          }
        }
      }

      if (payment.bookingId && bookingReference) {
        emitBookingEvent({
          type: "STATUS_CHANGED",
          bookingId: payment.bookingId,
          reference: bookingReference,
          status: updatedBookingStatus,
          timestamp: new Date().toISOString(),
        });
      }

      return {
        success: true,
        alreadyProcessed: false,
        paymentId: payment.id,
        bookingId: payment.bookingId,
        reservationId,
        reservationReference,
        paymentStatus: "PAID",
        bookingStatus: updatedBookingStatus,
        reservationStatus: updatedReservationStatus,
        amountPaidPesewas: payment.amountPesewas,
        message: "Payment successfully reconciled and booking updated",
      };
    } else {
      // Failed payment
      assertPaymentTransition(payment.status, "FAILED");

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
        },
      });

      await tx.auditLog.create({
        data: {
          userId: auditUserId || null,
          action: "PAYMENT_FAILED",
          entityType: "Payment",
          entityId: payment.id,
          newValues: {
            reference,
            status: "FAILED",
            source,
            gatewayResponse: providerResult.gatewayResponse,
          },
        },
      });

      return {
        success: false,
        alreadyProcessed: false,
        paymentId: payment.id,
        bookingId: payment.bookingId,
        paymentStatus: "FAILED",
        amountPaidPesewas: 0,
        message: providerResult.gatewayResponse || "Payment failed or was abandoned",
      };
    }
  });
}
