"use client";

import * as React from "react";
import {
  X,
  Phone,
  Mail,
  Calendar,
  Clock,
  User,
  Scissors,
  CreditCard,
  MessageSquare,
  History,
  AlertTriangle,
  RefreshCw,
  UserCheck,
  CheckCircle2,
  Ban,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatPesewas } from "@/lib/money";
import { BookingRecord, BookingStaff } from "./types";
import { BookingStatusBadge } from "./status-badge";
import { RequestPaymentModal } from "@/components/payment-requests/request-payment-modal";
import { PaymentRequestsList } from "@/components/payment-requests/payment-requests-list";
import { RefundModal } from "./refund-modal";
import { RecordCashModal } from "./record-cash-modal";
import { Banknote } from "lucide-react";

interface BookingDrawerProps {
  bookingId: string | null;
  onClose: () => void;
  onRefresh: () => void;
  staffList?: BookingStaff[];
  canEdit?: boolean;
  canCancel?: boolean;
}

export function BookingDrawer({
  bookingId,
  onClose,
  onRefresh,
  staffList = [],
  canEdit = true,
  canCancel = true,
}: BookingDrawerProps) {
  const [loading, setLoading] = React.useState(true);
  const [booking, setBooking] = React.useState<BookingRecord | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Action states & modals
  const [actionLoading, setActionLoading] = React.useState(false);
  const [cancelModalOpen, setCancelModalOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");
  const [rescheduleModalOpen, setRescheduleModalOpen] = React.useState(false);
  const [rescheduleDate, setRescheduleDate] = React.useState("");
  const [rescheduleTime, setRescheduleTime] = React.useState("10:00");
  const [reassignModalOpen, setReassignModalOpen] = React.useState(false);
  const [selectedNewStaffId, setSelectedNewStaffId] = React.useState("");
  const [newNote, setNewNote] = React.useState("");
  const [addingNote, setAddingNote] = React.useState(false);
  const [requestPaymentModalOpen, setRequestPaymentModalOpen] = React.useState(false);
  const [recordCashModalOpen, setRecordCashModalOpen] = React.useState(false);
  const [refundModalOpen, setRefundModalOpen] = React.useState(false);

  // Refetch helper
  const refetch = React.useCallback(async () => {
    if (!bookingId) return;
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`);
      const json = await res.json();
      if (json.success && json.data?.booking) {
        setBooking(json.data.booking);
      }
    } catch {
      // quiet error
    }
  }, [bookingId]);

  React.useEffect(() => {
    if (!bookingId) {
      return;
    }

    let isMounted = true;
    fetch(`/api/admin/bookings/${bookingId}`)
      .then((res) => res.json())
      .then((json) => {
        if (!isMounted) return;
        if (json.success && json.data?.booking) {
          setBooking(json.data.booking);
        } else {
          setError(json.error?.message || "Failed to load booking details");
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Error loading booking");
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [bookingId]);

  if (!bookingId) return null;

  // Handle status transitions
  const handleStatusTransition = async (status: string, reason?: string) => {
    if (!booking) return;
    try {
      setActionLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/bookings/${booking.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason }),
      });
      const json = await res.json();
      if (json.success) {
        setCancelModalOpen(false);
        setCancelReason("");
        await refetch();
        onRefresh();
      } else {
        setError(json.error?.message || "Status update failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle adding internal note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking || !newNote.trim()) return;

    try {
      setAddingNote(true);
      const res = await fetch(`/api/admin/bookings/${booking.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: newNote }),
      });
      const json = await res.json();
      if (json.success) {
        setNewNote("");
        await refetch();
        onRefresh();
      } else {
        setError(json.error?.message || "Failed to add note");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving note");
    } finally {
      setAddingNote(false);
    }
  };

  // Handle Reschedule
  const handleReschedule = async () => {
    if (!booking || !rescheduleDate || !rescheduleTime) return;

    try {
      setActionLoading(true);
      setError(null);
      const [hours, mins] = rescheduleTime.split(":").map(Number);
      const start = new Date(rescheduleDate);
      start.setUTCHours(hours, mins, 0, 0);

      // Compute end duration
      const totalDurationMin = booking.items.reduce(
        (sum, i) => sum + i.durationMin + i.bufferMin,
        0
      );
      const end = new Date(start.getTime() + (totalDurationMin || 60) * 60 * 1000);

      const res = await fetch(`/api/admin/bookings/${booking.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newStartUtc: start.toISOString(),
          newEndUtc: end.toISOString(),
        }),
      });

      const json = await res.json();
      if (json.success) {
        setRescheduleModalOpen(false);
        await refetch();
        onRefresh();
      } else {
        setError(json.error?.message || "Rescheduling failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reschedule error");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reassign
  const handleReassign = async () => {
    if (!booking || !selectedNewStaffId) return;

    try {
      setActionLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/bookings/${booking.id}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStaffId: selectedNewStaffId }),
      });

      const json = await res.json();
      if (json.success) {
        setReassignModalOpen(false);
        await refetch();
        onRefresh();
      } else {
        setError(json.error?.message || "Reassignment failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reassign error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-black/10 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-black/10 flex items-center justify-between bg-zinc-50">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-[#1E1E1E] tracking-tight">
                {booking?.reference || "Loading..."}
              </h2>
              {booking && <BookingStatusBadge status={booking.status} size="sm" />}
            </div>
            <p className="text-[11px] text-[#71717A]">
              Created on{" "}
              {booking
                ? new Date(booking.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "..."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-zinc-500 hover:text-[#1E1E1E] hover:bg-zinc-200/60 cursor-pointer"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 text-rose-800 text-xs border border-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-zinc-500">Loading appointment details...</p>
            </div>
          ) : booking ? (
            <>
              {/* ACTION BAR */}
              <div className="p-4 rounded-2xl bg-zinc-100 border border-zinc-200 space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">
                  Quick Actions
                </span>

                <div className="flex flex-wrap gap-2">
                  {/* Request Payment Action */}
                  {booking.balanceDuePesewas > 0 && booking.status !== "CANCELLED" && (
                    <Button
                      size="sm"
                      variant="blackPill"
                      disabled={actionLoading}
                      onClick={() => setRequestPaymentModalOpen(true)}
                      className="text-xs font-bold gap-1 cursor-pointer bg-emerald-800 text-white hover:bg-emerald-900"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Request Payment</span>
                    </Button>
                  )}

                  {/* Confirm Action */}
                  {(booking.status === "PENDING_PAYMENT" || booking.status === "HELD") && canEdit && (
                    <Button
                      size="sm"
                      variant="blackPill"
                      disabled={actionLoading}
                      onClick={() => handleStatusTransition("CONFIRMED")}
                      className="text-xs font-bold gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm Booking</span>
                    </Button>
                  )}

                  {/* Check In Action */}
                  {booking.status === "CONFIRMED" && canEdit && (
                    <Button
                      size="sm"
                      variant="blackPill"
                      disabled={actionLoading}
                      onClick={() => handleStatusTransition("CHECKED_IN")}
                      className="text-xs font-bold gap-1 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Check In Client</span>
                    </Button>
                  )}

                  {/* Complete Action */}
                  {booking.status === "CHECKED_IN" && canEdit && (
                    <Button
                      size="sm"
                      variant="blackPill"
                      disabled={actionLoading}
                      onClick={() => handleStatusTransition("COMPLETED")}
                      className="text-xs font-bold gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Complete Appointment</span>
                    </Button>
                  )}

                  {/* Reschedule Button */}
                  {booking.status !== "COMPLETED" && booking.status !== "CANCELLED" && canEdit && (
                    <Button
                      size="sm"
                      variant="outlinePill"
                      disabled={actionLoading}
                      onClick={() => setRescheduleModalOpen(true)}
                      className="text-xs font-semibold gap-1 cursor-pointer bg-white"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Reschedule</span>
                    </Button>
                  )}

                  {/* Solo direct shop mode: Reassign Stylist omitted
                  {booking.status !== "COMPLETED" && booking.status !== "CANCELLED" && canEdit && (
                    <Button
                      size="sm"
                      variant="outlinePill"
                      disabled={actionLoading}
                      onClick={() => setReassignModalOpen(true)}
                      className="text-xs font-semibold gap-1 cursor-pointer bg-white"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reassign Stylist</span>
                    </Button>
                  )}
                  */}

                  {/* No Show Button */}
                  {(booking.status === "CONFIRMED" || booking.status === "CHECKED_IN") && canEdit && (
                    <Button
                      size="sm"
                      variant="outlinePill"
                      disabled={actionLoading}
                      onClick={() => handleStatusTransition("NO_SHOW")}
                      className="text-xs font-semibold text-zinc-700 cursor-pointer bg-white"
                    >
                      <span>Mark No-Show</span>
                    </Button>
                  )}

                  {/* Cancel Button */}
                  {booking.status !== "COMPLETED" && booking.status !== "CANCELLED" && canCancel && (
                    <Button
                      size="sm"
                      variant="outlinePill"
                      disabled={actionLoading}
                      onClick={() => setCancelModalOpen(true)}
                      className="text-xs font-semibold text-rose-700 hover:bg-rose-50 border-rose-200 cursor-pointer bg-white"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Cancel Appointment</span>
                    </Button>
                  )}

                  {/* Refund Button */}
                  {booking.amountPaidPesewas > 0 && (
                    <Button
                      size="sm"
                      variant="outlinePill"
                      disabled={actionLoading}
                      onClick={() => setRefundModalOpen(true)}
                      className="text-xs font-semibold text-rose-800 hover:bg-rose-50 border-rose-300 cursor-pointer bg-white"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Issue Refund</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* 1. CRITICAL ALLERGY / SENSITIVITY ALERT */}
              {booking.customer.allergies && (
                <div
                  data-testid="customer-allergy-alert"
                  className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/60 text-amber-950 dark:text-amber-100 flex items-start gap-3 shadow-md animate-in fade-in slide-in-from-top-2"
                >
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-amber-850 dark:text-amber-300">
                        Client Allergy & Sensitivity Notice
                      </h4>
                      <span className="bg-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Staff Pre-Check
                      </span>
                    </div>
                    <p className="text-xs font-bold text-amber-900 dark:text-amber-100 leading-relaxed">
                      {booking.customer.allergies}
                    </p>
                  </div>
                </div>
              )}

              {/* 2. CUSTOMER & SCHEDULE INFO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card variant="white" className="p-4 space-y-2 border border-zinc-200 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                      <User className="w-3.5 h-3.5" />
                      <span>Customer</span>
                    </div>
                    {booking.customer.tags && booking.customer.tags.length > 0 && (
                      <div className="flex items-center gap-1">
                        {booking.customer.tags.map((t) => (
                          <span
                            key={t}
                            className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                              t === "VIP"
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : t === "BRIDAL"
                                ? "bg-rose-100 text-rose-800 border border-rose-300"
                                : "bg-zinc-100 text-zinc-700"
                            }`}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#1E1E1E]">{booking.customer.name}</h4>
                    <a
                      href={`tel:${booking.customer.phone}`}
                      className="text-xs font-semibold text-zinc-700 hover:text-black flex items-center gap-1 mt-1"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{booking.customer.phone}</span>
                    </a>
                    {booking.customer.email && (
                      <a
                        href={`mailto:${booking.customer.email}`}
                        className="text-[11px] text-zinc-500 hover:text-black flex items-center gap-1 mt-0.5"
                      >
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{booking.customer.email}</span>
                      </a>
                    )}
                  </div>

                  {booking.customer.preferences && (
                    <div className="pt-1 text-[11px] text-zinc-600 bg-zinc-50 p-2 rounded-xl border border-zinc-100">
                      <span className="font-bold text-zinc-800">Preferences: </span>
                      <span>{booking.customer.preferences}</span>
                    </div>
                  )}

                  {booking.customer.completedVisits !== undefined && (
                    <div className="pt-1">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-700">
                        {booking.customer.completedVisits} Previous Visits
                      </span>
                    </div>
                  )}
                </Card>

                <Card variant="white" className="p-4 space-y-2 border border-zinc-200 rounded-2xl">
                  <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Schedule & Timing</span>
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-[#1E1E1E]">
                      {new Date(booking.startUtc).toLocaleDateString("en-GB", {
                        timeZone: "Africa/Accra",
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    <div className="text-xs text-zinc-600 flex items-center gap-1 mt-0.5 font-medium">
                      <Clock className="w-3 h-3" />
                      <span>
                        {new Date(booking.startUtc).toLocaleTimeString("en-GB", {
                          timeZone: "Africa/Accra",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}{" "}
                        –{" "}
                        {new Date(booking.endUtc).toLocaleTimeString("en-GB", {
                          timeZone: "Africa/Accra",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </span>
                    </div>
                    {/* Solo direct shop mode: Assigned Artist omitted
                    <div className="mt-2 pt-2 border-t border-zinc-100 text-xs">
                      <span className="text-zinc-500 text-[10px] uppercase font-bold block">
                        Assigned Artist:
                      </span>
                      <span className="font-bold text-[#1E1E1E]">{booking.staff.name}</span>
                    </div>
                    */}
                  </div>
                </Card>
              </div>

              {/* 2. SERVICES & ADD-ONS */}
              <Card variant="white" className="p-4 space-y-3 border border-zinc-200 rounded-2xl">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Booked Services ({booking.items.length})</span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {booking.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-[#1E1E1E]">{item.name}</div>
                        <div className="text-[11px] text-zinc-500">
                          {item.durationMin} mins duration
                          {item.bufferMin > 0 ? ` + ${item.bufferMin}m buffer` : ""}
                        </div>
                      </div>
                      <div className="font-black text-[#1E1E1E]">
                        {formatPesewas(item.pricePesewas)}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* 3. PAYMENTS & FINANCIALS */}
              <Card variant="white" className="p-4 space-y-3 border border-zinc-200 rounded-2xl">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 uppercase tracking-wider border-b border-zinc-100 pb-2">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Payment Summary</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-zinc-600">
                    <span>Subtotal:</span>
                    <span className="font-semibold">{formatPesewas(booking.subtotalPesewas)}</span>
                  </div>
                  {booking.discountPesewas > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount:</span>
                      <span>-{formatPesewas(booking.discountPesewas)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-[#1E1E1E] pt-1 border-t border-zinc-100">
                    <span>Total Service Price:</span>
                    <span className="font-black">{formatPesewas(booking.totalPesewas)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>Deposit Required:</span>
                    <span>{formatPesewas(booking.depositRequiredPesewas)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-800 font-bold">
                    <span>Paid Online / POS:</span>
                    <span className="font-black">{formatPesewas(booking.amountPaidPesewas)}</span>
                  </div>
                  <div className="flex justify-between text-amber-900 font-extrabold pt-1 border-t border-zinc-100">
                    <span>Remaining Balance:</span>
                    <span className="text-sm">{formatPesewas(booking.balanceDuePesewas)}</span>
                  </div>
                  {booking.balanceDuePesewas > 0 && booking.status !== "CANCELLED" && (
                    <div className="pt-2 grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="blackPill"
                        onClick={() => setRecordCashModalOpen(true)}
                        className="text-xs font-bold gap-1.5 cursor-pointer bg-emerald-700 hover:bg-emerald-800 text-white"
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        <span>Receive Cash</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outlinePill"
                        onClick={() => setRequestPaymentModalOpen(true)}
                        className="text-xs font-bold gap-1.5 cursor-pointer"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Request MoMo</span>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Transaction list */}
                {booking.payments && booking.payments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-zinc-100 space-y-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Recorded Transactions
                    </span>
                    {booking.payments.map((p) => (
                      <div
                        key={p.id}
                        className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs flex justify-between items-center"
                      >
                        <div>
                          <span className="font-mono text-[10px] text-zinc-600 block">{p.reference}</span>
                          <span className="text-[11px] text-zinc-700 capitalize font-medium">
                            {p.channel ? p.channel.replace("_", " ") : "Paystack"} • {p.status}
                          </span>
                        </div>
                        <div className="font-black text-right">
                          {formatPesewas(p.amountPesewas)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Live Payment Requests */}
                <PaymentRequestsList
                  bookingId={booking.id}
                  onBalanceChange={() => {
                    refetch();
                    onRefresh();
                  }}
                />
              </Card>

              {/* 4. INTERNAL NOTES */}
              <Card variant="white" className="p-4 space-y-3 border border-zinc-200 rounded-2xl">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Internal Staff Notes</span>
                </div>

                {booking.notes ? (
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs whitespace-pre-wrap font-mono text-zinc-800 leading-relaxed">
                    {booking.notes}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">No notes recorded yet.</p>
                )}

                <form onSubmit={handleAddNote} className="space-y-2 pt-1">
                  <textarea
                    rows={2}
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add an internal note (e.g. skin allergy, bridal veil styling request)..."
                    className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:border-black resize-none"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      variant="blackPill"
                      disabled={addingNote || !newNote.trim()}
                      className="text-xs font-bold cursor-pointer"
                    >
                      {addingNote ? "Saving..." : "Add Note"}
                    </Button>
                  </div>
                </form>
              </Card>

              {/* 5. AUDIT TRAIL */}
              {booking.auditTrail && booking.auditTrail.length > 0 && (
                <Card variant="white" className="p-4 space-y-3 border border-zinc-200 rounded-2xl">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    <History className="w-3.5 h-3.5" />
                    <span>Audit Trail & Activity Log</span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    {booking.auditTrail.map((log) => (
                      <div key={log.id} className="border-l-2 border-zinc-300 pl-3 py-0.5 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#1E1E1E] text-[11px]">
                            {log.action.replace("BOOKING_", "")}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            {new Date(log.createdAt).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-600">
                          By <strong className="text-zinc-800">{log.performedBy}</strong>
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* CANCELLATION MODAL */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card variant="white" className="p-6 max-w-md w-full space-y-4 rounded-3xl shadow-2xl border border-zinc-200">
            <div className="flex items-center gap-2 text-rose-700">
              <Ban className="w-5 h-5" />
              <h3 className="text-base font-black">Cancel Appointment</h3>
            </div>
            <p className="text-xs text-zinc-600">
              Please provide a reason for cancelling booking{" "}
              <strong>{booking?.reference}</strong>. This will be audit-logged and texted to the client.
            </p>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Client requested cancellation via phone call..."
              className="w-full text-xs p-3 rounded-xl border border-zinc-300 focus:outline-none focus:border-black resize-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outlinePill"
                size="sm"
                onClick={() => setCancelModalOpen(false)}
                className="text-xs cursor-pointer"
              >
                Keep Appointment
              </Button>
              <Button
                size="sm"
                disabled={actionLoading || !cancelReason.trim()}
                onClick={() => handleStatusTransition("CANCELLED", cancelReason)}
                className="bg-rose-700 hover:bg-rose-800 text-white rounded-full text-xs font-bold px-4 cursor-pointer"
              >
                {actionLoading ? "Cancelling..." : "Confirm Cancellation"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* RESCHEDULE MODAL */}
      {rescheduleModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card variant="white" className="p-6 max-w-md w-full space-y-4 rounded-3xl shadow-2xl border border-zinc-200">
            <div className="flex items-center gap-2 text-[#1E1E1E]">
              <Calendar className="w-5 h-5" />
              <h3 className="text-base font-black">Reschedule Appointment</h3>
            </div>
            <p className="text-xs text-zinc-600">
              Select the new date and start time for <strong>{booking?.reference}</strong>. Availability and schedule conflicts will be validated automatically.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-zinc-700 block mb-1">
                  New Appointment Date
                </label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-700 block mb-1">
                  New Start Time (Accra Time)
                </label>
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:border-black"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outlinePill"
                size="sm"
                onClick={() => setRescheduleModalOpen(false)}
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                variant="blackPill"
                size="sm"
                disabled={actionLoading || !rescheduleDate}
                onClick={handleReschedule}
                className="text-xs font-bold cursor-pointer"
              >
                {actionLoading ? "Saving..." : "Apply Reschedule"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Solo direct shop mode: Reassign modal omitted
      {reassignModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card variant="white" className="p-6 max-w-md w-full space-y-4 rounded-3xl shadow-2xl border border-zinc-200">
            <div className="flex items-center gap-2 text-[#1E1E1E]">
              <UserCheck className="w-5 h-5" />
              <h3 className="text-base font-black">Reassign Stylist</h3>
            </div>
            <p className="text-xs text-zinc-600">
              Select an available colleague to perform this appointment. Conflicts will be verified.
            </p>

            <div>
              <label className="text-[11px] font-bold text-zinc-700 block mb-1">
                Choose Stylist
              </label>
              <select
                value={selectedNewStaffId}
                onChange={(e) => setSelectedNewStaffId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:border-black"
              >
                <option value="">Select stylist...</option>
                {staffList
                  .filter((s) => s.id !== booking?.staff.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.specialties.join(", ") || "General Stylist"})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outlinePill"
                size="sm"
                onClick={() => setReassignModalOpen(false)}
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                variant="blackPill"
                size="sm"
                disabled={actionLoading || !selectedNewStaffId}
                onClick={handleReassign}
                className="text-xs font-bold cursor-pointer"
              >
                {actionLoading ? "Reassigning..." : "Confirm Reassign"}
              </Button>
            </div>
          </Card>
        </div>
      )}
      */}

      {/* REQUEST PAYMENT MODAL */}
      {booking && (
        <RequestPaymentModal
          isOpen={requestPaymentModalOpen}
          onClose={() => setRequestPaymentModalOpen(false)}
          bookingId={booking.id}
          bookingReference={booking.reference}
          customerName={booking.customer.name}
          customerPhone={booking.customer.phone}
          balanceDuePesewas={booking.balanceDuePesewas}
          onSuccess={async () => {
            await refetch();
            onRefresh();
          }}
        />
      )}

      {/* ISSUE REFUND MODAL */}
      {booking && (
        <RefundModal
          isOpen={refundModalOpen}
          onClose={() => setRefundModalOpen(false)}
          bookingId={booking.id}
          reference={booking.reference}
          customerName={booking.customer.name}
          amountPaidPesewas={booking.amountPaidPesewas}
          onSuccess={async () => {
            await refetch();
            onRefresh();
          }}
        />
      )}

      {/* RECORD CASH / IN-PERSON PAYMENT MODAL */}
      {booking && (
        <RecordCashModal
          isOpen={recordCashModalOpen}
          onClose={() => setRecordCashModalOpen(false)}
          bookingId={booking.id}
          bookingReference={booking.reference}
          customerName={booking.customer.name}
          balanceDuePesewas={booking.balanceDuePesewas}
          onSuccess={async () => {
            await refetch();
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
