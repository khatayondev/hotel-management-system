"use client";

import * as React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog-and-drawer";
import { useAuth } from "@/components/auth/auth-context";
import { ROLES } from "@/lib/rbac";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UserCheck,
  CheckCheck,
  AlertCircle,
  ShieldCheck,
  Wrench,
} from "lucide-react";

export default function HousekeepingBoardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [boardData, setBoardData] = React.useState<any | null>(null);

  // Status update modal
  const [statusModalOpen, setStatusModalOpen] = React.useState(false);
  const [selectedRoom, setSelectedRoom] = React.useState<any | null>(null);
  const [targetStatus, setTargetStatus] = React.useState("CLEAN");
  const [assignedStaffId, setAssignedStaffId] = React.useState("");
  const [statusNotes, setStatusNotes] = React.useState("");

  const [errorMsg, setErrorMsg] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");

  const fetchHousekeeping = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/hotel/housekeeping");
      if (res.ok) {
        const json = await res.json();
        setBoardData(json.data);
      }
    } catch {
      setErrorMsg("Failed to load housekeeping board");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchHousekeeping();
  }, []);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!selectedRoom) return;

    try {
      const payload = {
        roomId: selectedRoom.id,
        status: targetStatus,
        assignedToUserId: assignedStaffId || undefined,
        notes: statusNotes || undefined,
      };

      const res = await fetch("/api/admin/hotel/housekeeping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Status update failed");

      setSuccessMsg(`Room ${selectedRoom.number} marked as ${targetStatus}`);
      setStatusModalOpen(false);
      fetchHousekeeping();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const isHousekeepingRole = user?.role === ROLES.HOUSEKEEPING;
  const isSupervisor = user?.role === ROLES.FRONT_DESK || user?.role === ROLES.MANAGER || user?.role === ROLES.OWNER_ADMIN;

  const rooms = boardData?.rooms || [];
  const summary = boardData?.summary || {
    dirty: 0,
    clean: 0,
    inspected: 0,
    occupied: 0,
    outOfOrder: 0,
  };
  const staff = boardData?.housekeepingStaff || [];

  return (
    <AppShell activePath="/dashboard/housekeeping" userName="Housekeeping Operations">
      <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-neutral-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-amber-500" />
              <span>Housekeeping & Room Status Board</span>
            </h1>
            <p className="text-xs text-neutral-500 mt-1">
              Real-time room turnover queue. Claim tasks, mark rooms cleaned, and perform supervisor inspections.
            </p>
          </div>

          <Button variant="outline" size="sm" onClick={fetchHousekeeping} className="text-xs font-bold">
            Refresh Board
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

        {/* Summary Metric Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card variant="white" className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 space-y-1">
            <div className="text-[11px] font-bold uppercase text-amber-800">Dirty / Turnover</div>
            <div className="text-2xl font-black text-amber-900">{summary.dirty}</div>
          </Card>
          <Card variant="white" className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 space-y-1">
            <div className="text-[11px] font-bold uppercase text-emerald-800">Cleaned</div>
            <div className="text-2xl font-black text-emerald-900">{summary.clean}</div>
          </Card>
          <Card variant="white" className="p-4 rounded-2xl border border-purple-200 bg-purple-50/50 space-y-1">
            <div className="text-[11px] font-bold uppercase text-purple-800">Inspected</div>
            <div className="text-2xl font-black text-purple-900">{summary.inspected}</div>
          </Card>
          <Card variant="white" className="p-4 rounded-2xl border border-blue-200 bg-blue-50/50 space-y-1">
            <div className="text-[11px] font-bold uppercase text-blue-800">Occupied</div>
            <div className="text-2xl font-black text-blue-900">{summary.occupied}</div>
          </Card>
          <Card variant="white" className="p-4 rounded-2xl border border-neutral-200 bg-neutral-50/50 space-y-1">
            <div className="text-[11px] font-bold uppercase text-neutral-600">Out of Order</div>
            <div className="text-2xl font-black text-neutral-800">{summary.outOfOrder}</div>
          </Card>
        </div>

        {/* Room Turnover Board */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room: any) => {
            const task = room.housekeepingTasks?.[0];
            const isDirty = room.status === "DIRTY";
            const isClean = room.status === "CLEAN";
            const isInspected = room.status === "INSPECTED";
            const isOccupied = room.status === "OCCUPIED";

            return (
              <Card
                key={room.id}
                variant="white"
                className={`p-5 rounded-3xl border transition-all space-y-3 ${
                  isDirty ? "border-amber-300 shadow-sm" : "border-neutral-200"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-black text-neutral-900">Room {room.number}</h3>
                    <div className="text-xs text-neutral-500">{room.roomType?.name} • Floor {room.floor}</div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isClean ? "bg-emerald-100 text-emerald-800" :
                    isDirty ? "bg-amber-100 text-amber-800" :
                    isOccupied ? "bg-blue-100 text-blue-800" :
                    isInspected ? "bg-purple-100 text-purple-800" :
                    "bg-rose-100 text-rose-800"
                  }`}>
                    {room.status}
                  </span>
                </div>

                {task && (
                  <div className="text-[11px] bg-neutral-50 p-2.5 rounded-xl text-neutral-600 space-y-1">
                    <div className="font-semibold text-neutral-900">Active Task: {task.notes || "Cleaning required"}</div>
                    {task.assignedTo && (
                      <div className="text-neutral-500">Assigned: <span className="font-bold text-neutral-800">{task.assignedTo.name}</span></div>
                    )}
                  </div>
                )}

                {room.notes && (
                  <p className="text-[11px] text-neutral-500 italic">Notes: {room.notes}</p>
                )}

                {/* Quick Action Buttons */}
                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-2 text-xs">
                  {isDirty && (
                    <Button
                      variant="blackPill"
                      size="sm"
                      onClick={() => {
                        setSelectedRoom(room);
                        setTargetStatus("CLEAN");
                        setAssignedStaffId(task?.assignedToUserId || "");
                        setStatusNotes("Turnover completed, clean linen placed");
                        setStatusModalOpen(true);
                      }}
                      className="gap-1 text-[11px] h-8 px-3"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Clean</span>
                    </Button>
                  )}

                  {isClean && isSupervisor && (
                    <Button
                      variant="blackPill"
                      size="sm"
                      onClick={() => {
                        setSelectedRoom(room);
                        setTargetStatus("INSPECTED");
                        setStatusNotes("Room inspected and approved for guest arrival");
                        setStatusModalOpen(true);
                      }}
                      className="gap-1 text-[11px] h-8 px-3 bg-purple-700 hover:bg-purple-800 text-white"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Inspect & Approve</span>
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedRoom(room);
                      setTargetStatus(room.status);
                      setAssignedStaffId(task?.assignedToUserId || "");
                      setStatusNotes(room.notes || "");
                      setStatusModalOpen(true);
                    }}
                    className="text-[11px] h-8 px-2.5"
                  >
                    Update
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Modal: Update Housekeeping Status */}
        {statusModalOpen && selectedRoom && (
          <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen} title={`Room ${selectedRoom.number} Status`}>
            <form onSubmit={handleUpdateStatus} className="space-y-4 text-xs">
              <div>
                <Label>Room Status</Label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-xs font-semibold"
                >
                  <option value="CLEAN">CLEAN (Turnover Done)</option>
                  {isSupervisor && <option value="INSPECTED">INSPECTED (Supervisor Approved)</option>}
                  <option value="DIRTY">DIRTY (Needs Turnover)</option>
                  <option value="OUT_OF_ORDER">OUT OF ORDER (Maintenance)</option>
                </select>
                {isHousekeepingRole && targetStatus === "INSPECTED" && (
                  <p className="text-[11px] text-rose-600 mt-1">
                    Inspection requires Front Desk or Manager review.
                  </p>
                )}
              </div>

              <div>
                <Label>Assign Housekeeping Staff</Label>
                <select
                  value={assignedStaffId}
                  onChange={(e) => setAssignedStaffId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-xs font-semibold"
                >
                  <option value="">Unassigned</option>
                  {staff.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Turnover / Inspection Notes</Label>
                <Input
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="e.g. Minibar restocked, linens changed"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setStatusModalOpen(false)}>Cancel</Button>
                <Button variant="blackPill" type="submit">Update Room Status</Button>
              </div>
            </form>
          </Dialog>
        )}
      </div>
    </AppShell>
  );
}
