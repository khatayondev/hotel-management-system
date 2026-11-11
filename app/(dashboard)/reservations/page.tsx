"use client";

import * as React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog-and-drawer";
import { formatPesewas } from "@/lib/money";
import {
  CalendarCheck,
  Search,
  Filter,
  Plus,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  CreditCard,
  LogOut,
  LogIn,
  Key,
  ShieldAlert,
  Receipt,
} from "lucide-react";
import { FolioViewerModal } from "@/components/hotel/folio-viewer-modal";
import { HotelReceiptModal } from "@/components/hotel/hotel-receipt-modal";
import type { HotelReceiptDetail } from "@/lib/hotel/billing";

export default function ReservationsAdminPage() {
  const [loading, setLoading] = React.useState(true);
  const [reservations, setReservations] = React.useState<any[]>([]);
  const [roomTypes, setRoomTypes] = React.useState<any[]>([]);
  const [rooms, setRooms] = React.useState<any[]>([]);

  // Filter states
  const [statusFilter, setStatusFilter] = React.useState("");
  const [sourceFilter, setSourceFilter] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [guestQuery, setGuestQuery] = React.useState("");

  // Modals
  const [walkInModalOpen, setWalkInModalOpen] = React.useState(false);
  const [detailModalOpen, setDetailModalOpen] = React.useState(false);
  const [checkInModalOpen, setCheckInModalOpen] = React.useState(false);
  const [checkOutModalOpen, setCheckOutModalOpen] = React.useState(false);

  // Selected reservation
  const [selectedRes, setSelectedRes] = React.useState<any | null>(null);

  // Walk-in form states
  const [wiRoomTypeId, setWiRoomTypeId] = React.useState("");
  const [wiRoomId, setWiRoomId] = React.useState("");
  const [wiCheckIn, setWiCheckIn] = React.useState("");
  const [wiCheckOut, setWiCheckOut] = React.useState("");
  const [wiAdults, setWiAdults] = React.useState(1);
  const [wiChildren, setWiChildren] = React.useState(0);
  const [wiName, setWiName] = React.useState("");
  const [wiPhone, setWiPhone] = React.useState("");
  const [wiEmail, setWiEmail] = React.useState("");
  const [wiDepositGhs, setWiDepositGhs] = React.useState("0");
  const [wiNotes, setWiNotes] = React.useState("");

  // Check-in form states
  const [ciRoomId, setCiRoomId] = React.useState("");
  const [ciIdType, setCiIdType] = React.useState("Ghana Card");
  const [ciIdNumber, setCiIdNumber] = React.useState("");
  const [ciNationality, setCiNationality] = React.useState("Ghanaian");
  const [ciVehiclePlate, setCiVehiclePlate] = React.useState("");
  const [ciEarlyApproved, setCiEarlyApproved] = React.useState(false);

  // Check-out form states
  const [coOverrideBalance, setCoOverrideBalance] = React.useState(false);
  const [coOverrideReason, setCoOverrideReason] = React.useState("");

  // Folio & Receipt modal states
  const [folioModalOpen, setFolioModalOpen] = React.useState(false);
  const [activeFolioId, setActiveFolioId] = React.useState<string | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = React.useState(false);
  const [activeReceipt, setActiveReceipt] = React.useState<HotelReceiptDetail | null>(null);

  const [errorMsg, setErrorMsg] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (sourceFilter) params.set("source", sourceFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (guestQuery) params.set("guest", guestQuery);

      const [resRes, roomsRes] = await Promise.all([
        fetch(`/api/admin/hotel/reservations?${params.toString()}`),
        fetch("/api/admin/hotel/rooms"),
      ]);

      if (resRes.ok) {
        const json = await resRes.json();
        setReservations(json.data.reservations || []);
      }
      if (roomsRes.ok) {
        const json = await roomsRes.json();
        setRoomTypes(json.data.roomTypes || []);
        setRooms(json.data.rooms || []);
      }
    } catch {
      setErrorMsg("Failed to load reservations data");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchReservations();
  }, [statusFilter, sourceFilter, dateFrom, dateTo]);

  const handleCreateWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      const payload = {
        roomTypeId: wiRoomTypeId || roomTypes[0]?.id,
        roomId: wiRoomId || undefined,
        checkIn: wiCheckIn,
        checkOut: wiCheckOut,
        adults: Number(wiAdults),
        children: Number(wiChildren),
        guest: {
          name: wiName.trim(),
          phone: wiPhone.trim(),
          email: wiEmail.trim() || undefined,
        },
        depositPesewas: Math.round(Number(wiDepositGhs || 0) * 100),
        notes: wiNotes || undefined,
      };

      const res = await fetch("/api/admin/hotel/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to create reservation");

      setSuccessMsg(`Reservation ${json.data.reference} created successfully!`);
      setWalkInModalOpen(false);
      fetchReservations();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleExecuteCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!selectedRes) return;

    try {
      const payload = {
        roomId: ciRoomId || undefined,
        guestDetails: {
          idType: ciIdType,
          idNumber: ciIdNumber.trim(),
          nationality: ciNationality.trim(),
          vehiclePlate: ciVehiclePlate.trim() || undefined,
        },
        earlyCheckInApproved: ciEarlyApproved,
      };

      const res = await fetch(`/api/admin/hotel/reservations/${selectedRes.id}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Check-in failed");

      setSuccessMsg(`Guest checked in to Room ${json.data.roomNumber}!`);
      setCheckInModalOpen(false);
      setDetailModalOpen(false);
      fetchReservations();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleExecuteCheckOut = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!selectedRes) return;

    try {
      const payload = {
        overrideUnpaidBalance: coOverrideBalance,
        overrideReason: coOverrideReason || undefined,
      };

      const res = await fetch(`/api/admin/hotel/reservations/${selectedRes.id}/check-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Check-out failed");

      setSuccessMsg(`Reservation ${selectedRes.reference} checked out. Room flagged DIRTY for housekeeping.`);
      setCheckOutModalOpen(false);
      setDetailModalOpen(false);
      fetchReservations();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <AppShell activePath="/dashboard/reservations" userName="Hotel Front Desk">
      <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-neutral-900 flex items-center gap-2">
              <CalendarCheck className="w-6 h-6 text-amber-500" />
              <span>Reservations & Front Desk</span>
            </h1>
            <p className="text-xs text-neutral-500 mt-1">
              Search, filter, check in guests, manage room assignments, and process check-outs.
            </p>
          </div>

          <Button
            variant="blackPill"
            size="sm"
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10);
              const tmr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
              setWiCheckIn(today);
              setWiCheckOut(tmr);
              setWiRoomTypeId(roomTypes[0]?.id || "");
              setWiName("");
              setWiPhone("");
              setWiEmail("");
              setWalkInModalOpen(true);
            }}
            className="gap-1.5 text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>New Walk-in / Phone Reservation</span>
          </Button>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg("")} className="font-bold underline text-[11px]">Dismiss</button>
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg("")} className="font-bold underline text-[11px]">Dismiss</button>
          </div>
        )}

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-3xl border border-neutral-200 shadow-xs flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search reference, guest name, phone..."
              value={guestQuery}
              onChange={(e) => setGuestQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchReservations()}
              className="w-full bg-transparent border-0 focus:outline-none text-xs font-medium text-neutral-900"
            />
          </div>

          <div className="h-4 w-px bg-neutral-200 hidden sm:block" />

          {/* Status select */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700"
          >
            <option value="">All Statuses</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="CHECKED_IN">CHECKED_IN</option>
            <option value="CHECKED_OUT">CHECKED_OUT</option>
            <option value="PENDING_PAYMENT">PENDING PAYMENT</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>

          {/* Source select */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="h-9 px-3 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700"
          >
            <option value="">All Sources</option>
            <option value="WEBSITE">Website Online</option>
            <option value="FRONT_DESK">Front Desk Walk-in</option>
          </select>

          {/* Date Range */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-neutral-500 font-medium">From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 px-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-neutral-500 font-medium">To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 px-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700"
            />
          </div>

          <Button variant="blackPill" size="sm" onClick={fetchReservations} className="h-9 px-4 text-xs font-bold">
            Filter
          </Button>
        </div>

        {/* Reservations Table */}
        <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase text-[10px] font-bold">
              <tr>
                <th className="p-4">Reference</th>
                <th className="p-4">Guest</th>
                <th className="p-4">Stay Dates</th>
                <th className="p-4">Suite / Room</th>
                <th className="p-4">Status</th>
                <th className="p-4">Folio Total</th>
                <th className="p-4">Balance</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-800">
              {reservations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-neutral-400">
                    No reservations found matching the filters.
                  </td>
                </tr>
              ) : (
                reservations.map((res) => {
                  const checkInStr = new Date(res.checkInDate).toISOString().slice(0, 10);
                  const checkOutStr = new Date(res.checkOutDate).toISOString().slice(0, 10);
                  const roomAssignment = res.rooms?.[0]?.room?.number || "Unassigned";
                  const roomTypeName = res.rooms?.[0]?.roomType?.name || "Suite";
                  const balancePesewas = Math.max(0, res.totalPesewas - res.amountPaidPesewas);

                  return (
                    <tr key={res.id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="p-4 font-mono font-bold text-neutral-900">{res.reference}</td>
                      <td className="p-4">
                        <div className="font-bold text-neutral-900">{res.guest?.name}</div>
                        <div className="text-[11px] text-neutral-500">{res.guest?.phone}</div>
                      </td>
                      <td className="p-4 font-medium text-neutral-600">
                        {checkInStr} → {checkOutStr}
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-neutral-900">{roomTypeName}</div>
                        <div className="text-[11px] text-amber-600 font-bold">Room {roomAssignment}</div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          res.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-800" :
                          res.status === "CHECKED_IN" ? "bg-blue-100 text-blue-800" :
                          res.status === "CHECKED_OUT" ? "bg-neutral-200 text-neutral-700" :
                          res.status === "PENDING_PAYMENT" ? "bg-amber-100 text-amber-800" :
                          "bg-rose-100 text-rose-800"
                        }`}>
                          {res.status}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-neutral-900">
                        GH₵ {(res.totalPesewas / 100).toFixed(2)}
                      </td>
                      <td className="p-4">
                        {balancePesewas === 0 ? (
                          <span className="text-emerald-600 font-bold">Settled</span>
                        ) : (
                          <span className="text-rose-600 font-bold">
                            GH₵ {(balancePesewas / 100).toFixed(2)} due
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRes(res);
                            setDetailModalOpen(true);
                          }}
                          className="text-xs h-8 px-3 font-bold"
                        >
                          View / Manage
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modal: Reservation Detail View & Actions */}
        {detailModalOpen && selectedRes && (
          <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen} title={`Reservation ${selectedRes.reference}`}>
            <div className="space-y-5 text-xs">
              {/* Top Banner */}
              <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                <div>
                  <div className="text-sm font-bold text-neutral-900">{selectedRes.guest?.name}</div>
                  <div className="text-neutral-500">{selectedRes.guest?.phone} • {selectedRes.guest?.email || "No email"}</div>
                </div>
                <span className="px-3 py-1 rounded-full font-bold uppercase text-[10px] bg-neutral-900 text-white">
                  {selectedRes.status}
                </span>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl border border-neutral-100 bg-white">
                <div>
                  <div className="text-neutral-500 text-[11px]">Check-in Date:</div>
                  <div className="font-bold text-neutral-900">{new Date(selectedRes.checkInDate).toISOString().slice(0, 10)}</div>
                </div>
                <div>
                  <div className="text-neutral-500 text-[11px]">Check-out Date:</div>
                  <div className="font-bold text-neutral-900">{new Date(selectedRes.checkOutDate).toISOString().slice(0, 10)}</div>
                </div>
                <div>
                  <div className="text-neutral-500 text-[11px]">Suite Category:</div>
                  <div className="font-bold text-neutral-900">{selectedRes.rooms?.[0]?.roomType?.name}</div>
                </div>
                <div>
                  <div className="text-neutral-500 text-[11px]">Assigned Room:</div>
                  <div className="font-bold text-amber-600">
                    {selectedRes.rooms?.[0]?.room?.number ? `Room ${selectedRes.rooms[0].room.number}` : "Not Assigned"}
                  </div>
                </div>
              </div>

              {/* Folio Financials */}
              <div className="p-4 rounded-2xl border border-neutral-100 bg-neutral-50 space-y-2">
                <div className="flex justify-between font-semibold">
                  <span>Total Charges:</span>
                  <span>GH₵ {(selectedRes.totalPesewas / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-emerald-700">
                  <span>Amount Paid:</span>
                  <span>GH₵ {(selectedRes.amountPaidPesewas / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-neutral-200">
                  <span>Outstanding Balance:</span>
                  <span className={selectedRes.totalPesewas - selectedRes.amountPaidPesewas > 0 ? "text-rose-600" : "text-emerald-600"}>
                    GH₵ {((selectedRes.totalPesewas - selectedRes.amountPaidPesewas) / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Operational Action Buttons */}
              <div className="pt-2 flex flex-wrap justify-end gap-2">
                {selectedRes.folios?.[0]?.id && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setActiveFolioId(selectedRes.folios[0].id);
                      setFolioModalOpen(true);
                    }}
                    className="gap-1.5"
                  >
                    <Receipt className="w-4 h-4 text-amber-600" />
                    <span>Folio & Charges</span>
                  </Button>
                )}

                {selectedRes.status !== "CHECKED_IN" && selectedRes.status !== "CHECKED_OUT" && (
                  <Button
                    variant="blackPill"
                    onClick={() => {
                      setCiRoomId(selectedRes.rooms?.[0]?.roomId || "");
                      setCiIdType(selectedRes.guest?.idType || "Ghana Card");
                      setCiIdNumber(selectedRes.guest?.idNumber || "");
                      setCiNationality(selectedRes.guest?.nationality || "Ghanaian");
                      setCheckInModalOpen(true);
                    }}
                    className="gap-1.5"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Check In Guest</span>
                  </Button>
                )}

                {selectedRes.status === "CHECKED_IN" && (
                  <Button
                    variant="blackPill"
                    onClick={() => {
                      setCoOverrideBalance(false);
                      setCoOverrideReason("");
                      setCheckOutModalOpen(true);
                    }}
                    className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Check Out Guest</span>
                  </Button>
                )}

                <Button variant="outline" onClick={() => setDetailModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </Dialog>
        )}

        {/* Modal: Check-In Form */}
        {checkInModalOpen && selectedRes && (
          <Dialog open={checkInModalOpen} onOpenChange={setCheckInModalOpen} title={`Check In: ${selectedRes.guest?.name}`}>
            <form onSubmit={handleExecuteCheckIn} className="space-y-4 text-xs">
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs">
                Confirm room assignment and record mandatory guest identity details per Ghana Tourism Authority standards.
              </div>

              <div>
                <Label>Assign Physical Room *</Label>
                <select
                  value={ciRoomId}
                  onChange={(e) => setCiRoomId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-xs font-semibold"
                >
                  <option value="">Auto-Assign Clean Room</option>
                  {rooms
                    .filter((r) => r.roomTypeId === selectedRes.rooms?.[0]?.roomTypeId)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        Room {r.number} ({r.status})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>ID Type *</Label>
                  <select
                    value={ciIdType}
                    onChange={(e) => setCiIdType(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-xs font-semibold"
                  >
                    <option value="Ghana Card">Ghana Card</option>
                    <option value="Passport">International Passport</option>
                    <option value="Driver License">Driver's License</option>
                    <option value="Voter ID">Voter ID</option>
                  </select>
                </div>
                <div>
                  <Label>ID Document Number *</Label>
                  <Input
                    required
                    value={ciIdNumber}
                    onChange={(e) => setCiIdNumber(e.target.value)}
                    placeholder="GHA-123456789-0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nationality</Label>
                  <Input value={ciNationality} onChange={(e) => setCiNationality(e.target.value)} placeholder="Ghanaian" />
                </div>
                <div>
                  <Label>Vehicle Plate (optional)</Label>
                  <Input value={ciVehiclePlate} onChange={(e) => setCiVehiclePlate(e.target.value)} placeholder="GR 1234-24" />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="early-checkin"
                  checked={ciEarlyApproved}
                  onChange={(e) => setCiEarlyApproved(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="early-checkin" className="cursor-pointer">
                  Authorize Early Check-in (Manager override)
                </Label>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setCheckInModalOpen(false)}>Cancel</Button>
                <Button variant="blackPill" type="submit">Confirm Check-In</Button>
              </div>
            </form>
          </Dialog>
        )}

        {/* Modal: Check-Out Form */}
        {checkOutModalOpen && selectedRes && (
          <Dialog open={checkOutModalOpen} onOpenChange={setCheckOutModalOpen} title={`Check Out: ${selectedRes.reference}`}>
            <form onSubmit={handleExecuteCheckOut} className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                <div className="flex justify-between font-bold text-sm">
                  <span>Outstanding Folio Balance:</span>
                  <span className={selectedRes.totalPesewas - selectedRes.amountPaidPesewas > 0 ? "text-rose-600" : "text-emerald-600"}>
                    GH₵ {((selectedRes.totalPesewas - selectedRes.amountPaidPesewas) / 100).toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500">
                  Checking out marks assigned room(s) as DIRTY and automatically dispatches a turnover task to the Housekeeping board.
                </p>
              </div>

              {selectedRes.totalPesewas - selectedRes.amountPaidPesewas > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 space-y-3">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>Unpaid Balance Detected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="override-balance"
                      checked={coOverrideBalance}
                      onChange={(e) => setCoOverrideBalance(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="override-balance" className="font-semibold cursor-pointer">
                      Manager Override: Allow checkout with unpaid balance
                    </Label>
                  </div>

                  {coOverrideBalance && (
                    <div>
                      <Label>Override Reason (Mandatory) *</Label>
                      <Input
                        required
                        value={coOverrideReason}
                        onChange={(e) => setCoOverrideReason(e.target.value)}
                        placeholder="e.g. Corporate invoice to be settled via bank transfer"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setCheckOutModalOpen(false)}>Cancel</Button>
                <Button variant="blackPill" type="submit" className="bg-rose-600 hover:bg-rose-700 text-white">
                  Confirm Check-Out
                </Button>
              </div>
            </form>
          </Dialog>
        )}

        {/* Modal: Walk-in / Phone Reservation Creation */}
        {walkInModalOpen && (
          <Dialog open={walkInModalOpen} onOpenChange={setWalkInModalOpen} title="Front Desk Walk-in / Phone Booking">
            <form onSubmit={handleCreateWalkIn} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Suite Category *</Label>
                  <select
                    value={wiRoomTypeId}
                    onChange={(e) => setWiRoomTypeId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-xs font-semibold"
                  >
                    {roomTypes.map((rt) => (
                      <option key={rt.id} value={rt.id}>{rt.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Specific Room (optional)</Label>
                  <select
                    value={wiRoomId}
                    onChange={(e) => setWiRoomId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-xs font-semibold"
                  >
                    <option value="">Auto-Assign at Check-in</option>
                    {rooms
                      .filter((r) => !wiRoomTypeId || r.roomTypeId === wiRoomTypeId)
                      .map((r) => (
                        <option key={r.id} value={r.id}>Room {r.number} ({r.status})</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Check-in Date *</Label>
                  <Input type="date" required value={wiCheckIn} onChange={(e) => setWiCheckIn(e.target.value)} />
                </div>
                <div>
                  <Label>Check-out Date *</Label>
                  <Input type="date" required value={wiCheckOut} onChange={(e) => setWiCheckOut(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Adults</Label>
                  <Input type="number" min={1} value={wiAdults} onChange={(e) => setWiAdults(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Children</Label>
                  <Input type="number" min={0} value={wiChildren} onChange={(e) => setWiChildren(Number(e.target.value))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Guest Full Name *</Label>
                  <Input required value={wiName} onChange={(e) => setWiName(e.target.value)} placeholder="e.g. Kwame Mensah" />
                </div>
                <div>
                  <Label>Phone Number *</Label>
                  <Input required value={wiPhone} onChange={(e) => setWiPhone(e.target.value)} placeholder="+233241234567" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Email (optional)</Label>
                  <Input type="email" value={wiEmail} onChange={(e) => setWiEmail(e.target.value)} placeholder="guest@example.gh" />
                </div>
                <div>
                  <Label>Upfront Deposit Paid (GH₵)</Label>
                  <Input type="number" min={0} value={wiDepositGhs} onChange={(e) => setWiDepositGhs(e.target.value)} />
                </div>
              </div>

              <div>
                <Label>Notes & Special Requests</Label>
                <Input value={wiNotes} onChange={(e) => setWiNotes(e.target.value)} placeholder="Late arrival requested" />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setWalkInModalOpen(false)}>Cancel</Button>
                <Button variant="blackPill" type="submit">Create Reservation</Button>
              </div>
            </form>
          </Dialog>
        )}

        {/* Modal: Folio Viewer */}
        <FolioViewerModal
          isOpen={folioModalOpen}
          onClose={() => setFolioModalOpen(false)}
          folioId={activeFolioId}
          onSettleRequested={(folio) => {
            setFolioModalOpen(false);
            if (selectedRes) {
              setCoOverrideBalance(false);
              setCoOverrideReason("");
              setCheckOutModalOpen(true);
            }
          }}
        />

        {/* Modal: Hotel Receipt Invoice */}
        <HotelReceiptModal
          isOpen={receiptModalOpen}
          onClose={() => setReceiptModalOpen(false)}
          receipt={activeReceipt}
        />
      </div>
    </AppShell>
  );
}

