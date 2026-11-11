"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Clock,
  User,
  CreditCard,
  MapPin,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  XCircle,
  Download,
  ExternalLink,
  ShieldAlert,
  ArrowLeft,
  Crown,
  Calendar,
  Bed,
  Sparkles,
} from "lucide-react";
import { formatPesewas } from "@/lib/money";

interface ManageData {
  isHotel?: boolean;
  id: string;
  reference: string;
  status: string;
  // Hotel-specific fields
  checkInDate?: string;
  checkOutDate?: string;
  standardCheckInTime?: string;
  standardCheckOutTime?: string;
  adults?: number;
  children?: number;
  rooms?: Array<{
    id: string;
    roomTypeId: string;
    roomTypeName: string;
    roomNumber: string;
    bedConfiguration?: string;
  }>;
  extras?: Array<{
    name: string;
    quantity: number;
    pricePesewas: number;
  }>;
  cancellationPolicy?: {
    freeCancelHoursBeforeCheckIn: number;
    cancellationPenaltyPercent: number;
    hoursUntilCheckIn: number;
    isBeforeCutoff: boolean;
    penaltyPesewas: number;
    refundPesewas: number;
  };
  // Salon/Studio fields
  startUtc?: string;
  endUtc?: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  staffName?: string;
  services?: Array<{
    id: string;
    name: string;
    durationMin: number;
    pricePesewas: number;
  }>;
  totalDurationMin?: number;
  subtotalPesewas: number;
  taxPesewas?: number;
  totalPesewas: number;
  depositRequiredPesewas: number;
  amountPaidPesewas: number;
  balanceDuePesewas: number;
  cancellationNoticeHours?: number;
  canReschedule: boolean;
  canCancel?: boolean;
  rescheduleNoticeReason?: string;
  hasPendingPayment?: boolean;
  refundPreview?: {
    isBeforeCutoff: boolean;
    hoursRemaining: number;
    policyApplied: string;
    depositPaidPesewas: number;
    depositRefundPesewas: number;
    depositForfeitedPesewas: number;
    prepaymentRefundPesewas: number;
    totalRefundPesewas: number;
    cancellationNoticeHours: number;
    explanation: string;
  };
  calendarUrls: {
    google?: string;
    icsDownload: string;
  };
}

function ManageBookingPageContent() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params.token === "string" ? params.token : "";

  const [booking, setBooking] = React.useState<ManageData | null>(null);
  const [loading, setLoading] = React.useState<boolean>(() => Boolean(token));
  const [error, setError] = React.useState<string | null>(() =>
    token ? null : "No manage token provided."
  );
  const [successNotice, setSuccessNotice] = React.useState<string | null>(null);

  // Reschedule state
  const [rescheduleModalOpen, setRescheduleModalOpen] = React.useState(false);
  const [rescheduleDate, setRescheduleDate] = React.useState("");
  const [rescheduleCheckOut, setRescheduleCheckOut] = React.useState("");
  const [rescheduleTime, setRescheduleTime] = React.useState("10:00");
  const [rescheduling, setRescheduling] = React.useState(false);
  const [rescheduleError, setRescheduleError] = React.useState<string | null>(null);

  // Cancel state
  const [cancelModalOpen, setCancelModalOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelling, setCancelling] = React.useState(false);
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  // Pay balance state
  const [payingBalance, setPayingBalance] = React.useState(false);

  const refetchBooking = React.useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/manage/${encodeURIComponent(token)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setBooking(json.data);
      }
    } catch {
      // quiet
    }
  }, [token]);

  React.useEffect(() => {
    if (!token) return;
    let isCurrent = true;
    fetch(`/api/manage/${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((json) => {
        if (!isCurrent) return;
        if (json.success && json.data) {
          setBooking(json.data);
        } else {
          setError(json.error?.message || "Stay not found or access link has expired.");
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!isCurrent) return;
        setError(err instanceof Error ? err.message : "Failed to load stay details.");
        setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [token]);

  const handlePayBalance = async () => {
    if (!token || !booking) return;
    setPayingBalance(true);
    setError(null);

    try {
      const res = await fetch(`/api/manage/${encodeURIComponent(token)}/pay-balance`, {
        method: "POST",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to initialize balance payment.");
      }

      if (json.data?.authorizationUrl) {
        window.location.href = json.data.authorizationUrl;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not initialize payment.");
    } finally {
      setPayingBalance(false);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRescheduling(true);
    setRescheduleError(null);

    try {
      let body: Record<string, string>;
      if (booking?.isHotel) {
        if (!rescheduleDate || !rescheduleCheckOut) {
          throw new Error("Both new check-in and check-out dates are required.");
        }
        body = {
          newCheckIn: rescheduleDate,
          newCheckOut: rescheduleCheckOut,
        };
      } else {
        if (!rescheduleDate) {
          throw new Error("Please select a new appointment date.");
        }
        const [hours, mins] = rescheduleTime.split(":").map(Number);
        const [y, m, d] = rescheduleDate.split("-").map(Number);
        const combined = new Date(Date.UTC(y, m - 1, d, hours, mins, 0));
        body = { newStartUtc: combined.toISOString() };
      }

      const res = await fetch(`/api/manage/${encodeURIComponent(token)}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to update stay dates.");
      }

      setRescheduleModalOpen(false);
      setSuccessNotice("Stay dates successfully rescheduled!");
      await refetchBooking();
    } catch (err: unknown) {
      setRescheduleError(err instanceof Error ? err.message : "Failed to reschedule.");
    } finally {
      setRescheduling(false);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch(`/api/manage/${encodeURIComponent(token)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() || undefined }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Could not cancel stay.");
      }

      setCancelModalOpen(false);
      const refundPesewas = json.data?.refundPesewas ?? json.data?.refundAmountPesewas ?? 0;
      setSuccessNotice(
        `Stay cancelled successfully. Refund calculated: ${formatPesewas(refundPesewas)}`
      );
      await refetchBooking();
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : "Failed to cancel.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-sm text-neutral-400">Loading your stay details...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 py-16 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold font-serif text-white">Access Link Invalid or Expired</h2>
          <p className="text-sm text-neutral-400">
            {error || "We could not find a stay matching this reference. Please check your reference code."}
          </p>
          <button
            onClick={() => router.push("/manage")}
            className="w-full py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sm font-semibold transition"
          >
            Look Up Stay with Reference & Phone
          </button>
        </div>
      </div>
    );
  }

  const isCancelled = booking.status === "CANCELLED";
  const isConfirmed = booking.status === "CONFIRMED";

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/manage")}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" /> Look Up Another Stay
          </button>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                isCancelled
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  : isConfirmed
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              }`}
            >
              {booking.status.replace("_", " ")}
            </span>
          </div>
        </div>

        {/* Success Alert */}
        {successNotice && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Hero Card */}
        <div className="bg-gradient-to-br from-neutral-900 to-neutral-900/90 border border-neutral-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
            <div>
              <span className="text-xs uppercase tracking-widest text-amber-400 font-semibold">
                Reservation Reference
              </span>
              <h1 className="text-3xl font-mono font-extrabold tracking-wider text-white">
                {booking.reference}
              </h1>
            </div>
            <div className="sm:text-right">
              <span className="text-xs uppercase tracking-widest text-neutral-400 block">
                {booking.isHotel ? "Stay Dates" : "Appointment Time"}
              </span>
              <p className="text-lg font-semibold text-neutral-200">
                {booking.isHotel
                  ? `${booking.checkInDate} → ${booking.checkOutDate}`
                  : booking.startUtc
                  ? new Date(booking.startUtc).toLocaleDateString()
                  : "Upcoming"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-amber-400">
                <User className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-neutral-400 block">Guest Name</span>
                <span className="text-sm font-semibold text-white">{booking.customerName}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-amber-400">
                {booking.isHotel ? <Bed className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
              </div>
              <div>
                <span className="text-xs text-neutral-400 block">
                  {booking.isHotel ? "Suite Type" : "Duration"}
                </span>
                <span className="text-sm font-semibold text-white">
                  {booking.isHotel
                    ? booking.rooms?.[0]?.roomTypeName || "Luxury Suite"
                    : `${booking.totalDurationMin || 60} mins`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-amber-400">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-neutral-400 block">Property Location</span>
                <span className="text-sm font-semibold text-white truncate max-w-[160px] block">
                  Aura Royal Hotel, Accra
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Suite Details & Financials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Details breakdown */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-4">
            <h2 className="text-base font-serif font-bold text-white flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              {booking.isHotel ? "Stay Specifications" : "Booked Services"}
            </h2>
            <div className="divide-y divide-neutral-800/80 text-sm">
              {booking.isHotel ? (
                <>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-neutral-400">Assigned Room</span>
                    <span className="text-white font-semibold">
                      {booking.rooms?.[0]?.roomNumber || "Assigned upon check-in"}
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-neutral-400">Check-In Time</span>
                    <span className="text-white font-semibold">{booking.standardCheckInTime || "14:00"}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-neutral-400">Check-Out Time</span>
                    <span className="text-white font-semibold">{booking.standardCheckOutTime || "11:00"}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-neutral-400">Registered Occupancy</span>
                    <span className="text-white font-semibold">
                      {booking.adults || 1} Adult{(booking.adults || 1) > 1 ? "s" : ""}, {booking.children || 0} Child
                    </span>
                  </div>
                </>
              ) : (
                booking.services?.map((svc) => (
                  <div key={svc.id} className="py-3 flex justify-between items-center">
                    <div>
                      <span className="font-medium text-white block">{svc.name}</span>
                      <span className="text-xs text-neutral-500">{svc.durationMin} minutes</span>
                    </div>
                    <span className="font-semibold text-amber-400">{formatPesewas(svc.pricePesewas)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-4 flex flex-col justify-between">
            <div>
              <h2 className="text-base font-serif font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-400" /> Payment &amp; Balances
              </h2>
              <div className="space-y-2 mt-4 text-sm">
                <div className="flex justify-between text-neutral-400">
                  <span>Total Stay Price</span>
                  <span className="font-medium text-white">{formatPesewas(booking.totalPesewas)}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Deposit Required</span>
                  <span className="font-medium text-white">
                    {formatPesewas(booking.depositRequiredPesewas)}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Amount Paid (Paystack)</span>
                  <span className="font-medium text-emerald-400">
                    {formatPesewas(booking.amountPaidPesewas)}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-200 pt-2 border-t border-neutral-800 font-bold">
                  <span>Outstanding Balance</span>
                  <span
                    className={booking.balanceDuePesewas > 0 ? "text-amber-400" : "text-emerald-400"}
                  >
                    {formatPesewas(booking.balanceDuePesewas)}
                  </span>
                </div>
              </div>
            </div>

            {booking.balanceDuePesewas > 0 && !isCancelled && (
              <button
                type="button"
                disabled={payingBalance}
                onClick={handlePayBalance}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition disabled:opacity-50"
              >
                {payingBalance ? "Connecting to Paystack..." : `Pay Outstanding Balance (${formatPesewas(booking.balanceDuePesewas)})`}
              </button>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-3xl p-6 space-y-4">
          <h2 className="text-base font-serif font-bold text-white">Reservation Actions</h2>

          <div className="flex flex-wrap gap-3">
            {/* Add to Calendar Button */}
            {booking.calendarUrls?.icsDownload && (
              <a
                href={booking.calendarUrls.icsDownload}
                download
                className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 hover:text-white inline-flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" /> Download (.ics Calendar)
              </a>
            )}

            {/* Change Dates Button */}
            {!isCancelled && (
              <button
                onClick={() => {
                  setRescheduleDate(booking.checkInDate || "");
                  setRescheduleCheckOut(booking.checkOutDate || "");
                  setRescheduleModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 hover:text-white inline-flex items-center gap-1.5 transition"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-400" /> Change Stay Dates
              </button>
            )}

            {/* Cancel Stay Button */}
            {!isCancelled && (
              <button
                onClick={() => setCancelModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-900/50 text-xs font-semibold inline-flex items-center gap-1.5 transition"
              >
                <XCircle className="w-3.5 h-3.5" /> Cancel Reservation
              </button>
            )}
          </div>
        </div>
      </div>

      {/* RESCHEDULE MODAL */}
      {rescheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white">Change Stay Dates</h3>
                <p className="text-xs text-neutral-400">
                  Select your new arrival and departure dates.
                </p>
              </div>
              <button
                onClick={() => setRescheduleModalOpen(false)}
                className="text-neutral-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            {rescheduleError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {rescheduleError}
              </div>
            )}

            <form onSubmit={handleRescheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">New Check-In Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">New Check-Out Date</label>
                <input
                  type="date"
                  value={rescheduleCheckOut}
                  min={rescheduleDate || new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setRescheduleCheckOut(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRescheduleModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={rescheduling}
                  className="w-1/2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 text-xs font-bold disabled:opacity-50"
                >
                  {rescheduling ? "Updating Dates..." : "Confirm New Dates"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCELLATION MODAL */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white">Cancel Reservation</h3>
                <p className="text-xs text-neutral-400">
                  Review the refund calculation according to hotel policy.
                </p>
              </div>
              <button
                onClick={() => setCancelModalOpen(false)}
                className="text-neutral-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            {cancelError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {cancelError}
              </div>
            )}

            {/* Policy Refund Preview Box */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2 text-xs">
              <div className="flex justify-between text-neutral-400">
                <span>Free Cancellation Cutoff:</span>
                <span className="font-semibold text-white">
                  {booking.cancellationPolicy?.freeCancelHoursBeforeCheckIn || 48} Hours prior
                </span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Cancellation Penalty:</span>
                <span className="font-semibold text-rose-400">
                  {formatPesewas(booking.cancellationPolicy?.penaltyPesewas || 0)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-neutral-800 font-bold text-sm">
                <span className="text-white">Eligible Refund Amount:</span>
                <span className="text-emerald-400">
                  {formatPesewas(booking.cancellationPolicy?.refundPesewas || 0)}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 pt-1 border-t border-neutral-900">
                {booking.cancellationPolicy?.isBeforeCutoff
                  ? "✓ You are cancelling prior to the policy cutoff window. 100% of your payment is refunded."
                  : "Late cancellation policy applies. Standard penalty percentage is deducted from refund."}
              </p>
            </div>

            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Reason for Cancellation (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Flight schedule change..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300"
                >
                  Keep Reservation
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {cancelling ? "Processing..." : "Confirm Cancellation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ManageBookingPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
            <p className="text-sm text-neutral-400">Loading your stay details...</p>
          </div>
        </div>
      }
    >
      <ManageBookingPageContent />
    </React.Suspense>
  );
}
