"use client";

import * as React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog-and-drawer";
import {
  BedDouble,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Move,
  Hotel,
} from "lucide-react";

export default function TapeChartCalendarPage() {
  const [loading, setLoading] = React.useState(true);
  const [startDate, setStartDate] = React.useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [days, setDays] = React.useState(14);
  const [dateColumns, setDateColumns] = React.useState<string[]>([]);
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [reservationRooms, setReservationRooms] = React.useState<any[]>([]);

  // Move/extend modal
  const [moveModalOpen, setMoveModalOpen] = React.useState(false);
  const [selectedResRoom, setSelectedResRoom] = React.useState<any | null>(null);
  const [newRoomId, setNewRoomId] = React.useState("");
  const [newCheckIn, setNewCheckIn] = React.useState("");
  const [newCheckOut, setNewCheckOut] = React.useState("");

  const [errorMsg, setErrorMsg] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");

  const fetchTapeChart = async (start = startDate, count = days) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/hotel/tape-chart?startDate=${start}&days=${count}`);
      if (res.ok) {
        const json = await res.json();
        setDateColumns(json.data.dateColumns || []);
        setRooms(json.data.rooms || []);
        setReservationRooms(json.data.reservationRooms || []);
      }
    } catch {
      setErrorMsg("Failed to load tape chart calendar");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchTapeChart(startDate, days);
  }, [startDate, days]);

  const handlePrevRange = () => {
    const current = new Date(startDate);
    current.setUTCDate(current.getUTCDate() - 7);
    const prevStr = current.toISOString().slice(0, 10);
    setStartDate(prevStr);
  };

  const handleNextRange = () => {
    const current = new Date(startDate);
    current.setUTCDate(current.getUTCDate() + 7);
    const nextStr = current.toISOString().slice(0, 10);
    setStartDate(nextStr);
  };

  const handleSaveMoveExtend = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!selectedResRoom) return;

    try {
      const payload = {
        reservationRoomId: selectedResRoom.id,
        newRoomId: newRoomId || undefined,
        newCheckIn,
        newCheckOut,
      };

      const res = await fetch("/api/admin/hotel/tape-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to move or extend reservation");
      }

      setSuccessMsg("Reservation moved/extended successfully!");
      setMoveModalOpen(false);
      fetchTapeChart();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <AppShell activePath="/dashboard/calendar" userName="Hotel Front Desk">
      <div className="p-4 sm:p-8 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-neutral-900 flex items-center gap-2">
              <BedDouble className="w-6 h-6 text-amber-500" />
              <span>Reservation Tape Chart</span>
            </h1>
            <p className="text-xs text-neutral-500 mt-1">
              Visual room allocation timeline. Click on any reservation block to reassign rooms or adjust stay dates.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrevRange} className="h-9 px-3 gap-1">
              <ChevronLeft className="w-4 h-4" />
              <span>Previous 7 Days</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStartDate(new Date().toISOString().slice(0, 10))}
              className="h-9 px-3"
            >
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={handleNextRange} className="h-9 px-3 gap-1">
              <span>Next 7 Days</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
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

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-neutral-600 font-medium bg-white p-3 rounded-2xl border border-neutral-200">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span>Checked In</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span>Confirmed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-500" />
            <span>Pending Payment</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-purple-500" />
            <span>Held (Cart Lock)</span>
          </div>
        </div>

        {/* Tape Chart Grid */}
        <div className="bg-white rounded-3xl border border-neutral-200 shadow-xs overflow-x-auto">
          <div className="min-w-[1200px]">
            {/* Header row: Room column + Date columns */}
            <div className="grid grid-cols-[200px_repeat(14,_minmax(70px,_1fr))] border-b border-neutral-200 bg-neutral-50 text-neutral-700 font-bold text-xs sticky top-0 z-20">
              <div className="p-3 border-r border-neutral-200 uppercase text-[10px] text-neutral-500 flex items-center">
                Room / Suite
              </div>
              {dateColumns.map((colDate, idx) => {
                const d = new Date(colDate);
                const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
                const dayNum = d.getUTCDate();
                const isToday = colDate === new Date().toISOString().slice(0, 10);

                return (
                  <div
                    key={colDate}
                    className={`p-2 text-center border-r border-neutral-200 ${
                      isToday ? "bg-amber-100/60 font-black text-amber-900" : ""
                    }`}
                  >
                    <div className="text-[10px] text-neutral-400 font-normal">{dayName}</div>
                    <div className="text-xs">{dayNum}</div>
                  </div>
                );
              })}
            </div>

            {/* Room Rows */}
            <div className="divide-y divide-neutral-100">
              {rooms.map((room) => {
                // Find reservations assigned to this specific room
                const assignedResRooms = reservationRooms.filter((rr) => rr.roomId === room.id);

                return (
                  <div
                    key={room.id}
                    className="grid grid-cols-[200px_repeat(14,_minmax(70px,_1fr))] hover:bg-neutral-50/40 relative min-h-[52px]"
                  >
                    {/* Room Info Cell */}
                    <div className="p-2.5 border-r border-neutral-200 bg-neutral-50/50 flex flex-col justify-center">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-neutral-900">Room {room.number}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          room.status === "CLEAN" ? "bg-emerald-100 text-emerald-800" :
                          room.status === "DIRTY" ? "bg-amber-100 text-amber-800" :
                          room.status === "OCCUPIED" ? "bg-blue-100 text-blue-800" :
                          room.status === "INSPECTED" ? "bg-purple-100 text-purple-800" :
                          "bg-rose-100 text-rose-800"
                        }`}>
                          {room.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-neutral-500 truncate mt-0.5">
                        {room.roomType?.name} • Floor {room.floor}
                      </div>
                    </div>

                    {/* Date Grid Cells (Background) */}
                    {dateColumns.map((colDate) => {
                      const isToday = colDate === new Date().toISOString().slice(0, 10);
                      return (
                        <div
                          key={`cell-${room.id}-${colDate}`}
                          className={`border-r border-neutral-100 ${isToday ? "bg-amber-50/30" : ""}`}
                        />
                      );
                    })}

                    {/* Reservation Overlay Blocks */}
                    {assignedResRooms.map((rr) => {
                      const resCheckInStr = new Date(rr.checkIn).toISOString().slice(0, 10);
                      const resCheckOutStr = new Date(rr.checkOut).toISOString().slice(0, 10);

                      // Calculate span on this grid
                      const startIndex = dateColumns.indexOf(resCheckInStr);
                      const endIndex = dateColumns.indexOf(resCheckOutStr);

                      // If outside visible date range or partially visible
                      const effectiveStart = startIndex !== -1 ? startIndex : 0;
                      const effectiveEnd = endIndex !== -1 ? endIndex : dateColumns.length;

                      if (endIndex !== -1 && endIndex <= 0) return null;
                      if (startIndex !== -1 && startIndex >= dateColumns.length) return null;

                      const spanColumns = Math.max(1, effectiveEnd - effectiveStart);
                      const gridColumnStart = effectiveStart + 2; // +1 for 1-based, +1 for room info cell
                      const gridColumnEnd = gridColumnStart + spanColumns;

                      const statusColor =
                        rr.status === "CHECKED_IN"
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : rr.status === "CONFIRMED"
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : rr.status === "PENDING_PAYMENT"
                          ? "bg-amber-600 hover:bg-amber-700 text-white"
                          : "bg-purple-600 hover:bg-purple-700 text-white";

                      return (
                        <div
                          key={rr.id}
                          style={{
                            gridColumnStart,
                            gridColumnEnd,
                          }}
                          onClick={() => {
                            setSelectedResRoom(rr);
                            setNewRoomId(rr.roomId || "");
                            setNewCheckIn(resCheckInStr);
                            setNewCheckOut(resCheckOutStr);
                            setMoveModalOpen(true);
                          }}
                          className={`my-1 mx-0.5 rounded-xl px-2 py-1 flex items-center justify-between text-xs font-bold shadow-xs cursor-pointer transition-transform active:scale-95 truncate z-10 ${statusColor}`}
                          title={`${rr.reservation?.reference} - ${rr.reservation?.guest?.name} (${resCheckInStr} to ${resCheckOutStr})`}
                        >
                          <div className="truncate">
                            <span className="font-mono text-[10px]">{rr.reservation?.reference}</span>
                            <span className="ml-1 text-[11px] truncate font-semibold">
                              {rr.reservation?.guest?.name}
                            </span>
                          </div>
                          <Move className="w-3 h-3 shrink-0 opacity-70 ml-1" />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal: Move / Extend Reservation */}
        {moveModalOpen && selectedResRoom && (
          <Dialog open={moveModalOpen} onOpenChange={setMoveModalOpen} title={`Reassign / Extend Reservation`}>
            <form onSubmit={handleSaveMoveExtend} className="space-y-4 text-xs">
              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200">
                <div className="font-bold text-neutral-900">{selectedResRoom.reservation?.guest?.name}</div>
                <div className="text-neutral-500 font-mono text-[11px]">{selectedResRoom.reservation?.reference}</div>
              </div>

              <div>
                <Label>Reassign to Room</Label>
                <select
                  value={newRoomId}
                  onChange={(e) => setNewRoomId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-xs font-semibold"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.number} ({r.roomType?.name} • {r.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>New Check-In Date</Label>
                  <Input type="date" required value={newCheckIn} onChange={(e) => setNewCheckIn(e.target.value)} />
                </div>
                <div>
                  <Label>New Check-Out Date</Label>
                  <Input type="date" required value={newCheckOut} onChange={(e) => setNewCheckOut(e.target.value)} />
                </div>
              </div>

              <p className="text-[11px] text-neutral-500">
                Note: Overlapping assignments to the same room will be automatically rejected by database exclusion constraint with a conflict notification.
              </p>

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setMoveModalOpen(false)}>Cancel</Button>
                <Button variant="blackPill" type="submit">Save Changes</Button>
              </div>
            </form>
          </Dialog>
        )}
      </div>
    </AppShell>
  );
}
