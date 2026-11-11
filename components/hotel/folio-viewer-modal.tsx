"use client";

import * as React from "react";
import { formatPesewas } from "@/lib/money";
import { formatDateTime } from "@/lib/date";
import type { FolioDetails, FolioChargeItem } from "@/lib/hotel/billing";
import {
  Receipt,
  Plus,
  Percent,
  CreditCard,
  Ban,
  AlertCircle,
  Building,
  User,
  BedDouble,
  Calendar,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog-and-drawer";

export function FolioViewerModal({
  isOpen,
  onClose,
  folioId,
  userRole,
  onSettleRequested,
}: {
  isOpen: boolean;
  onClose: () => void;
  folioId: string | null;
  userRole?: string;
  onSettleRequested?: (folio: FolioDetails) => void;
}) {
  const [folio, setFolio] = React.useState<FolioDetails | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Adjustment Modal
  const [adjustOpen, setAdjustOpen] = React.useState(false);
  const [adjustAmountGhs, setAdjustAmountGhs] = React.useState("");
  const [adjustReason, setAdjustReason] = React.useState("");
  const [submittingAdjust, setSubmittingAdjust] = React.useState(false);

  // Manual Charge Modal
  const [chargeOpen, setChargeOpen] = React.useState(false);
  const [chargeDesc, setChargeDesc] = React.useState("");
  const [chargeSource, setChargeSource] = React.useState<"RESTAURANT" | "EXTRA">("EXTRA");
  const [chargeAmountGhs, setChargeAmountGhs] = React.useState("");
  const [submittingCharge, setSubmittingCharge] = React.useState(false);

  // Void Charge Modal
  const [voidChargeId, setVoidChargeId] = React.useState<string | null>(null);
  const [voidReason, setVoidReason] = React.useState("");
  const [submittingVoid, setSubmittingVoid] = React.useState(false);

  const fetchFolio = React.useCallback(async () => {
    if (!folioId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/hotel/folios/${folioId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to fetch folio");
      }
      setFolio(data.data.folio);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading folio ledger");
    } finally {
      setLoading(false);
    }
  }, [folioId]);

  React.useEffect(() => {
    if (isOpen && folioId) {
      fetchFolio();
    }
  }, [isOpen, folioId, fetchFolio]);

  const handleApplyAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folio) return;
    const pesewas = Math.round((parseFloat(adjustAmountGhs) || 0) * 100);
    if (pesewas <= 0) {
      alert("Please enter a valid discount amount");
      return;
    }
    if (!adjustReason.trim()) {
      alert("A reason is strictly required for folio adjustments");
      return;
    }

    try {
      setSubmittingAdjust(true);
      const res = await fetch(`/api/admin/hotel/folios/${folio.folioId}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountPesewas: pesewas,
          reason: adjustReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to apply adjustment");
      }
      setAdjustOpen(false);
      setAdjustAmountGhs("");
      setAdjustReason("");
      await fetchFolio();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to apply adjustment");
    } finally {
      setSubmittingAdjust(false);
    }
  };

  const handleAddCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folio) return;
    const pesewas = Math.round((parseFloat(chargeAmountGhs) || 0) * 100);
    if (pesewas <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    if (!chargeDesc.trim()) {
      alert("Description is required");
      return;
    }

    try {
      setSubmittingCharge(true);
      const res = await fetch(`/api/admin/hotel/folios/${folio.folioId}/charges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: chargeDesc.trim(),
          source: chargeSource,
          amountPesewas: pesewas,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to add charge");
      }
      setChargeOpen(false);
      setChargeDesc("");
      setChargeAmountGhs("");
      await fetchFolio();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add charge");
    } finally {
      setSubmittingCharge(false);
    }
  };

  const handleVoidCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folio || !voidChargeId) return;
    if (!voidReason.trim()) {
      alert("Reason is strictly required to void a charge");
      return;
    }

    try {
      setSubmittingVoid(true);
      const res = await fetch(
        `/api/admin/hotel/folios/${folio.folioId}/charges/${voidChargeId}/void`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: voidReason.trim() }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to void charge");
      }
      setVoidChargeId(null);
      setVoidReason("");
      await fetchFolio();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to void charge");
    } finally {
      setSubmittingVoid(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={folio ? `Guest Folio: ${folio.folioNumber}` : "Folio Details"}
      description="Live in-house ledger: itemized room charges, restaurant orders, adjustments, and running balance."
    >
      <div className="space-y-4 pt-1 max-h-[82vh] overflow-y-auto pr-1">
        {loading && (
          <div className="text-center py-10 text-xs text-zinc-500">Loading guest folio...</div>
        )}

        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2 border border-red-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {folio && !loading && (
          <div className="space-y-5">
            {/* Guest & Room Header Card */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-zinc-50 rounded-2xl border border-zinc-200">
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase text-zinc-400">Guest</div>
                <div className="flex items-center gap-1.5 font-bold text-xs text-zinc-900">
                  <User className="w-3.5 h-3.5 text-zinc-500" />
                  {folio.guestName || "In-House Guest"}
                </div>
                <div className="text-[11px] text-zinc-500">{folio.guestPhone || "No phone"}</div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase text-zinc-400">Room & Stay</div>
                <div className="flex items-center gap-1.5 font-bold text-xs text-zinc-900">
                  <BedDouble className="w-3.5 h-3.5 text-amber-600" />
                  Room {folio.roomNumber || "N/A"} ({folio.roomTypeName || "Standard"})
                </div>
                <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-zinc-400" />
                  {folio.checkInDate} → {folio.checkOutDate}
                </div>
              </div>

              <div className="space-y-1 sm:text-right">
                <div className="text-[10px] font-bold uppercase text-zinc-400">Status & Balance</div>
                <div className="flex sm:justify-end">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      folio.status === "SETTLED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {folio.status}
                  </span>
                </div>
                <div className="font-mono font-extrabold text-sm text-zinc-900">
                  {formatPesewas(folio.financials.runningBalancePesewas)}
                </div>
              </div>
            </div>

            {/* Financial Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                <div className="text-[10px] font-bold text-zinc-500 uppercase">Room Charges</div>
                <div className="text-xs font-mono font-bold text-zinc-900 mt-1">
                  {formatPesewas(folio.financials.roomChargesPesewas)}
                </div>
              </div>

              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                <div className="text-[10px] font-bold text-zinc-500 uppercase">Restaurant / POS</div>
                <div className="text-xs font-mono font-bold text-amber-700 mt-1">
                  {formatPesewas(folio.financials.restaurantChargesPesewas)}
                </div>
              </div>

              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                <div className="text-[10px] font-bold text-zinc-500 uppercase">Adjustments</div>
                <div className="text-xs font-mono font-bold text-emerald-700 mt-1">
                  {folio.financials.adjustmentPesewas !== 0
                    ? `${folio.financials.adjustmentPesewas < 0 ? "-" : "+"}${formatPesewas(
                        Math.abs(folio.financials.adjustmentPesewas)
                      )}`
                    : "GH₵ 0.00"}
                </div>
              </div>

              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200">
                <div className="text-[10px] font-bold text-amber-900 uppercase">Running Balance</div>
                <div className="text-xs font-mono font-extrabold text-amber-950 mt-1">
                  {formatPesewas(folio.financials.runningBalancePesewas)}
                </div>
              </div>
            </div>

            {/* Action Buttons Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 pb-1">
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setChargeOpen(true)}
                  size="sm"
                  variant="outlinePill"
                  className="text-xs font-medium rounded-xl flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-zinc-600" />
                  Add Charge
                </Button>
                <Button
                  onClick={() => setAdjustOpen(true)}
                  size="sm"
                  variant="outlinePill"
                  className="text-xs font-medium rounded-xl flex items-center gap-1.5"
                >
                  <Percent className="w-3.5 h-3.5 text-emerald-600" />
                  Apply Discount / Adjustment
                </Button>
              </div>

              {onSettleRequested && (
                <Button
                  onClick={() => onSettleRequested(folio)}
                  size="sm"
                  className="bg-zinc-900 text-white hover:bg-black text-xs font-semibold rounded-xl flex items-center gap-1.5"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Settle & Check Out
                </Button>
              )}
            </div>

            {/* Ledger Charges Table */}
            <div>
              <div className="text-xs font-bold text-zinc-800 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-amber-600" />
                Ledger Entries ({folio.charges.length})
              </div>

              <div className="border border-zinc-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-100 text-zinc-600 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Source</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Posted By</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {folio.charges.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-zinc-400">
                          No charges recorded on this folio yet.
                        </td>
                      </tr>
                    ) : (
                      folio.charges.map((c) => {
                        const isCredit = c.source === "PAYMENT" || c.amountPesewas < 0;
                        return (
                          <tr key={c.id} className="hover:bg-zinc-50/50">
                            <td className="py-2.5 px-3 text-zinc-500 text-[11px] whitespace-nowrap">
                              {formatDateTime(c.createdAt)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  c.source === "ROOM"
                                    ? "bg-blue-50 text-blue-800"
                                    : c.source === "RESTAURANT"
                                    ? "bg-amber-50 text-amber-800"
                                    : c.source === "PAYMENT"
                                    ? "bg-emerald-50 text-emerald-800"
                                    : c.source === "ADJUSTMENT"
                                    ? "bg-purple-50 text-purple-800"
                                    : "bg-zinc-100 text-zinc-700"
                                }`}
                              >
                                {c.source}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-zinc-800">
                              <span className="font-medium">{c.description}</span>
                              {c.referenceId && (
                                <span className="block text-[10px] text-zinc-400 font-mono">
                                  Ref: {c.referenceId}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-zinc-500 text-[11px]">
                              {c.createdByName || "System"}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-mono font-bold ${
                                isCredit ? "text-emerald-700" : "text-zinc-900"
                              }`}
                            >
                              {c.amountPesewas < 0
                                ? `-${formatPesewas(Math.abs(c.amountPesewas))}`
                                : formatPesewas(c.amountPesewas)}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {folio.status === "OPEN" && c.source !== "PAYMENT" && (
                                <button
                                  type="button"
                                  onClick={() => setVoidChargeId(c.id)}
                                  className="text-[11px] text-red-600 hover:text-red-800 font-semibold cursor-pointer"
                                >
                                  Void
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Add Adjustment / Discount */}
        {adjustOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl border border-zinc-200">
              <h3 className="text-sm font-bold text-zinc-900">Apply Folio Adjustment / Discount</h3>
              <p className="text-xs text-zinc-500">
                Reduces folio balance. Must comply with your role limit (Front Desk 5%, Manager 20%, Owner 100%).
              </p>

              <form onSubmit={handleApplyAdjustment} className="space-y-3">
                <div>
                  <Label className="text-xs">Discount Amount (GHS)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={adjustAmountGhs}
                    onChange={(e) => setAdjustAmountGhs(e.target.value)}
                    placeholder="e.g. 50.00"
                    className="text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs">Reason (Strictly Required)</Label>
                  <Input
                    type="text"
                    required
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="e.g. Guest goodwill discount for AC maintenance"
                    className="text-xs mt-1"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outlinePill"
                    size="sm"
                    onClick={() => setAdjustOpen(false)}
                    className="text-xs rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submittingAdjust}
                    className="bg-emerald-700 text-white hover:bg-emerald-800 text-xs rounded-xl"
                  >
                    {submittingAdjust ? "Applying..." : "Apply Discount"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Manual Charge */}
        {chargeOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl border border-zinc-200">
              <h3 className="text-sm font-bold text-zinc-900">Post Room Charge</h3>
              <p className="text-xs text-zinc-500">
                Post restaurant food & beverage or room extra directly to this room folio.
              </p>

              <form onSubmit={handleAddCharge} className="space-y-3">
                <div>
                  <Label className="text-xs">Charge Category</Label>
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setChargeSource("RESTAURANT")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                        chargeSource === "RESTAURANT"
                          ? "bg-amber-500 text-white border-amber-600"
                          : "bg-zinc-100 text-zinc-700 border-zinc-200"
                      }`}
                    >
                      Restaurant / F&B
                    </button>
                    <button
                      type="button"
                      onClick={() => setChargeSource("EXTRA")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                        chargeSource === "EXTRA"
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "bg-zinc-100 text-zinc-700 border-zinc-200"
                      }`}
                    >
                      Room Extra / Service
                    </button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Description</Label>
                  <Input
                    type="text"
                    required
                    value={chargeDesc}
                    onChange={(e) => setChargeDesc(e.target.value)}
                    placeholder="e.g. In-room dining dinner, Mini-bar refreshment"
                    className="text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs">Amount (GHS)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={chargeAmountGhs}
                    onChange={(e) => setChargeAmountGhs(e.target.value)}
                    placeholder="e.g. 120.00"
                    className="text-xs mt-1"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outlinePill"
                    size="sm"
                    onClick={() => setChargeOpen(false)}
                    className="text-xs rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submittingCharge}
                    className="bg-zinc-900 text-white hover:bg-black text-xs rounded-xl"
                  >
                    {submittingCharge ? "Posting..." : "Post Charge"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Void Charge */}
        {voidChargeId && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl border border-zinc-200">
              <h3 className="text-sm font-bold text-red-700">Void Folio Charge</h3>
              <p className="text-xs text-zinc-500">
                Are you sure you want to void this charge? This action is recorded in the audit log.
              </p>

              <form onSubmit={handleVoidCharge} className="space-y-3">
                <div>
                  <Label className="text-xs">Void Reason (Strictly Required)</Label>
                  <Input
                    type="text"
                    required
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    placeholder="e.g. Wrong room charged, Customer sent back meal"
                    className="text-xs mt-1"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outlinePill"
                    size="sm"
                    onClick={() => setVoidChargeId(null)}
                    className="text-xs rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submittingVoid}
                    className="bg-red-700 text-white hover:bg-red-800 text-xs rounded-xl"
                  >
                    {submittingVoid ? "Voiding..." : "Confirm Void"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-zinc-200">
          <Button variant="outlinePill" onClick={onClose} className="text-xs rounded-xl px-4">
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

