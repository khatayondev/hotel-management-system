"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
  CreditCard,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatPesewas } from "@/lib/money";
import { BookingVerifyData } from "@/lib/payments/types";
import { PaymentRequestBanner } from "@/components/payment-requests/payment-request-banner";

function BookingConfirmationContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("ref") || searchParams.get("reference");

  const [loading, setLoading] = React.useState(() => Boolean(reference));
  const [data, setData] = React.useState<BookingVerifyData | null>(null);
  const [error, setError] = React.useState<string | null>(() =>
    reference ? null : "No transaction reference provided."
  );

  React.useEffect(() => {
    if (!reference) {
      return;
    }

    let isMounted = true;
    fetch(`/api/payments/verify?ref=${encodeURIComponent(reference)}`)
      .then((res) => res.json())
      .then((json) => {
        if (!isMounted) return;
        if (json.success && json.data) {
          setData(json.data);
        } else {
          setError(json.error?.message || "Could not verify payment transaction");
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : "Failed to verify transaction";
        setError(msg);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [reference]);

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <div className="w-12 h-12 border-3 border-[#1E1E1E] border-t-transparent rounded-full animate-spin mx-auto" />
        <h2 className="text-lg font-bold text-[#1E1E1E]">Verifying Payment with Paystack...</h2>
        <p className="text-xs text-[#71717A]">
          Connecting securely to reconcile your Mobile Money / Card settlement.
        </p>
      </div>
    );
  }

  if (error || !data?.verified) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <Card variant="white" className="p-8 text-center space-y-5 rounded-[32px] border border-rose-200 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-700 mx-auto flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-black text-[#1E1E1E]">Payment Verification Issue</h1>
            <p className="text-xs text-[#71717A]">
              {error || data?.message || "Payment was not settled successfully."}
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <Link href="/book">
              <Button variant="blackPill" size="md" className="w-full text-xs font-bold cursor-pointer">
                Return to Booking Wizard
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outlinePill" size="md" className="w-full text-xs font-semibold cursor-pointer">
                Contact Studio Support
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const b = data.booking;
  const res = data.reservation;
  const isHotel = Boolean(data.isHotel || res);
  const activeRef = res?.reference || b?.reference || (reference as string) || "";
  const balanceDue = res
    ? Math.max(0, res.totalPesewas - res.amountPaidPesewas)
    : b
    ? Math.max(0, b.totalPesewas - b.amountPaidPesewas)
    : 0;

  return (
    <div className="max-w-2xl mx-auto py-8 sm:py-12 px-4 space-y-6">
      {/* Real-time Payment Request Banner */}
      <PaymentRequestBanner
        reference={activeRef}
        onPaymentSettled={() => {
          if (reference) {
            fetch(`/api/payments/verify?ref=${encodeURIComponent(reference)}`)
              .then((res) => res.json())
              .then((json) => {
                if (json.success && json.data) setData(json.data);
              })
              .catch(() => {});
          }
        }}
      />

      <Card variant="white" className="p-6 sm:p-8 text-center space-y-6 rounded-[32px] shadow-lg border border-black/10">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-[11px] font-bold uppercase tracking-wider text-emerald-800 border border-emerald-200">
            Payment &amp; Stay Confirmed
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1E1E1E] tracking-tight">
            You&apos;re All Set!
          </h1>
          {activeRef && (
            <p className="text-xs text-[#71717A]">
              Reservation Reference:{" "}
              <strong className="text-base text-[#1E1E1E] font-black tracking-wider font-mono">
                {activeRef}
              </strong>
            </p>
          )}
        </div>

        {/* Hotel Stay Breakdown */}
        {res && (
          <div className="p-5 rounded-2xl bg-[#F4F4F6] text-left space-y-3 text-xs">
            <div className="flex justify-between border-b border-black/5 pb-2">
              <span className="text-[#71717A]">Guest Name:</span>
              <span className="font-bold text-[#1E1E1E]">{res.guestName}</span>
            </div>
            <div className="flex justify-between border-b border-black/5 pb-2">
              <span className="text-[#71717A]">Phone:</span>
              <span className="font-bold text-[#1E1E1E]">{res.guestPhone}</span>
            </div>
            <div className="flex justify-between border-b border-black/5 pb-2">
              <span className="text-[#71717A]">Reserved Suite:</span>
              <span className="font-extrabold text-[#1E1E1E]">
                {res.rooms[0]?.roomTypeName || "Luxury Hotel Suite"}
              </span>
            </div>
            <div className="flex justify-between border-b border-black/5 pb-2">
              <span className="text-[#71717A]">Stay Dates:</span>
              <span className="font-bold text-[#1E1E1E]">
                {new Date(res.checkInDate).toISOString().slice(0, 10)} (Check-in 14:00) →{" "}
                {new Date(res.checkOutDate).toISOString().slice(0, 10)} (Check-out 11:00)
              </span>
            </div>
            <div className="flex justify-between border-b border-black/5 pb-2">
              <span className="text-[#71717A]">Occupancy:</span>
              <span className="font-bold text-[#1E1E1E]">
                {res.adults} Adult{res.adults > 1 ? "s" : ""}, {res.children} Child{res.children !== 1 ? "ren" : ""}
              </span>
            </div>
            <div className="flex justify-between border-b border-black/5 pb-2">
              <span className="text-[#71717A]">Total Amount:</span>
              <span className="font-bold text-[#1E1E1E]">{formatPesewas(res.totalPesewas)}</span>
            </div>
            <div className="flex justify-between border-b border-black/5 pb-2 text-emerald-800">
              <span className="font-bold">Paid Online (Paystack):</span>
              <span className="font-extrabold">{formatPesewas(res.amountPaidPesewas)}</span>
            </div>
            {balanceDue > 0 ? (
              <div className="flex justify-between pt-1 text-amber-900 font-bold">
                <span>Remaining Balance Due at Check-In:</span>
                <span className="font-black text-sm">{formatPesewas(balanceDue)}</span>
              </div>
            ) : (
              <div className="flex justify-between pt-1 text-emerald-800 font-bold">
                <span>Payment Status:</span>
                <span className="font-black">Fully Paid</span>
              </div>
            )}
          </div>
        )}

        {/* Appointment Breakdown (Fallback for legacy bookings) */}
        {!res && b && (
          <div className="p-5 rounded-2xl bg-[#F4F4F6] text-left space-y-3 text-xs">
            <div className="flex justify-between border-b border-black/5 pb-2">
              <span className="text-[#71717A]">Client:</span>
              <span className="font-bold text-[#1E1E1E]">{b.customerName}</span>
            </div>
            <div className="flex justify-between border-b border-black/5 pb-2">
              <span className="text-[#71717A]">Phone:</span>
              <span className="font-bold text-[#1E1E1E]">{b.customerPhone}</span>
            </div>
            <div className="flex justify-between border-b border-black/5 pb-2">
              <span className="text-[#71717A]">Date &amp; Time:</span>
              <span className="font-extrabold text-[#1E1E1E]">
                {new Date(b.startUtc).toLocaleDateString("en-GB", {
                  timeZone: "Africa/Accra",
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}{" "}
                at{" "}
                {new Date(b.startUtc).toLocaleTimeString("en-GB", {
                  timeZone: "Africa/Accra",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
              </span>
            </div>
            <div className="flex justify-between border-b border-black/5 pb-2">
              <span className="text-[#71717A]">Total Amount:</span>
              <span className="font-bold text-[#1E1E1E]">{formatPesewas(b.totalPesewas)}</span>
            </div>
            <div className="flex justify-between border-b border-black/5 pb-2 text-emerald-800">
              <span className="font-bold">Paid Online (Paystack):</span>
              <span className="font-extrabold">{formatPesewas(b.amountPaidPesewas)}</span>
            </div>
            {balanceDue > 0 ? (
              <div className="flex justify-between pt-1 text-amber-900 font-bold">
                <span>Remaining Balance Due:</span>
                <span className="font-black text-sm">{formatPesewas(balanceDue)}</span>
              </div>
            ) : (
              <div className="flex justify-between pt-1 text-emerald-800 font-bold">
                <span>Payment Status:</span>
                <span className="font-black">Fully Paid</span>
              </div>
            )}
          </div>
        )}

        {/* Hotel Info */}
        <div className="text-left space-y-2 text-xs text-[#71717A] border-t border-black/5 pt-4">
          <p className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Instant SMS reservation confirmation sent to your phone.</span>
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#1E1E1E] shrink-0" />
            <span>Aura Royal Hotel &amp; Restaurant: Airport Residential Area, Accra, Ghana.</span>
          </p>
          <p className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#1E1E1E] shrink-0" />
            <span>Standard check-in is 2:00 PM; check-out is 11:00 AM.</span>
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-3">
          {activeRef && (
            <Link href={`/manage/${encodeURIComponent(activeRef)}`}>
              <Button
                variant="blackPill"
                size="md"
                className="w-full text-xs font-bold cursor-pointer bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black shadow-md gap-2"
              >
                <span>View &amp; Manage Your Stay</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/rooms" className="flex-1">
              <Button variant="outlinePill" size="md" className="w-full text-xs font-bold cursor-pointer">
                View Other Suites
              </Button>
            </Link>
            <Link href="/" className="flex-1">
              <Button variant="outlinePill" size="md" className="w-full text-xs font-semibold cursor-pointer">
                Return to Home
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function BookingConfirmationPage() {
  return (
    <React.Suspense
      fallback={
        <div className="max-w-xl mx-auto py-16 px-4 text-center">
          <div className="w-12 h-12 border-3 border-[#1E1E1E] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      }
    >
      <BookingConfirmationContent />
    </React.Suspense>
  );
}
