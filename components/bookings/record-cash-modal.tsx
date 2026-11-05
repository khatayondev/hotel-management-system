"use client";

import * as React from "react";
import {
  Banknote,
  Smartphone,
  CreditCard,
  Building2,
  CheckCircle2,
  AlertCircle,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog-and-drawer";
import { formatPesewas } from "@/lib/money";
import { triggerGlobalDataSync } from "@/hooks/use-smart-polling";

interface RecordCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  bookingReference: string;
  customerName: string;
  balanceDuePesewas: number;
  onSuccess: () => void;
}

export function RecordCashModal({
  isOpen,
  onClose,
  bookingId,
  bookingReference,
  customerName,
  balanceDuePesewas,
  onSuccess,
}: RecordCashModalProps) {
  const [channel, setChannel] = React.useState<"CASH" | "MOBILE_MONEY" | "CARD" | "BANK_TRANSFER">("CASH");
  const [amountGhs, setAmountGhs] = React.useState<string>((balanceDuePesewas / 100).toFixed(2));
  const [tenderedGhs, setTenderedGhs] = React.useState<string>((balanceDuePesewas / 100).toFixed(2));
  const [reference, setReference] = React.useState<string>("");
  const [provider, setProvider] = React.useState<string>("MTN");
  const [notes, setNotes] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Sync state on open
  const [prevIsOpen, setPrevIsOpen] = React.useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setChannel("CASH");
      setAmountGhs((balanceDuePesewas / 100).toFixed(2));
      setTenderedGhs((balanceDuePesewas / 100).toFixed(2));
      setReference("");
      setProvider("MTN");
      setNotes("");
      setError(null);
    }
  }

  const amountPesewas = Math.max(0, Math.round((parseFloat(amountGhs) || 0) * 100));
  const tenderedPesewas = Math.max(0, Math.round((parseFloat(tenderedGhs) || 0) * 100));
  const changePesewas = Math.max(0, tenderedPesewas - amountPesewas);

  // Quick preset bill buttons
  const quickPresets = React.useMemo(() => {
    const due = Math.ceil(amountPesewas / 100);
    const set = new Set<number>();
    set.add(due);
    [20, 50, 100, 200, 300, 500].forEach((v) => {
      if (v >= due) set.add(v);
    });
    return Array.from(set).sort((a, b) => a - b).slice(0, 5);
  }, [amountPesewas]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (amountPesewas <= 0) {
      setError("Please enter a valid amount greater than zero.");
      return;
    }

    if (amountPesewas > balanceDuePesewas) {
      setError(`Payment cannot exceed the remaining balance of ${formatPesewas(balanceDuePesewas)}.`);
      return;
    }

    if (channel === "CASH" && tenderedPesewas < amountPesewas) {
      setError("Cash tendered cannot be less than the payment amount.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountPesewas,
          channel,
          tenderedPesewas: channel === "CASH" ? tenderedPesewas : undefined,
          provider: channel === "MOBILE_MONEY" ? provider : undefined,
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to record payment");
      }

      triggerGlobalDataSync("all");
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error recording payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Receive In-Person Payment"
      description={`Record cash or mobile payment received from ${customerName} for booking #${bookingReference}.`}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Balance Overview Banner */}
        <div className="p-4 bg-zinc-950 text-white rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">
              Remaining Balance Due
            </span>
            <div className="text-2xl font-black text-amber-300">
              {formatPesewas(balanceDuePesewas)}
            </div>
            <span className="text-[11px] text-zinc-400">
              Client: {customerName} (#{bookingReference})
            </span>
          </div>

          <div className="text-right">
            <span className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">
              Amount Applying
            </span>
            <div className="text-xl font-bold text-emerald-400">
              {formatPesewas(amountPesewas)}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-start gap-2 border border-red-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Payment Method Selector */}
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-zinc-800 uppercase tracking-wider block">
            Payment Method
          </Label>
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-zinc-100 rounded-2xl">
            <button
              type="button"
              onClick={() => setChannel("CASH")}
              className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                channel === "CASH"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-zinc-700 hover:bg-white/60"
              }`}
            >
              <Banknote className="w-4 h-4" />
              <span>Cash</span>
            </button>

            <button
              type="button"
              onClick={() => setChannel("MOBILE_MONEY")}
              className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                channel === "MOBILE_MONEY"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-zinc-700 hover:bg-white/60"
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>MoMo</span>
            </button>

            <button
              type="button"
              onClick={() => setChannel("CARD")}
              className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                channel === "CARD"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-700 hover:bg-white/60"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Card</span>
            </button>

            <button
              type="button"
              onClick={() => setChannel("BANK_TRANSFER")}
              className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                channel === "BANK_TRANSFER"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-700 hover:bg-white/60"
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Bank</span>
            </button>
          </div>
        </div>

        {/* Amount to Apply Input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label htmlFor="payAmount" className="text-xs font-semibold text-zinc-700">
              Payment Amount to Collect (GH₵)
            </Label>
            <button
              type="button"
              onClick={() => {
                setAmountGhs((balanceDuePesewas / 100).toFixed(2));
                setTenderedGhs((balanceDuePesewas / 100).toFixed(2));
              }}
              className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              Pay Full Balance ({formatPesewas(balanceDuePesewas)})
            </button>
          </div>
          <Input
            id="payAmount"
            type="number"
            step="0.5"
            min="1"
            max={(balanceDuePesewas / 100).toFixed(2)}
            value={amountGhs}
            onChange={(e) => {
              setAmountGhs(e.target.value);
              if (channel === "CASH") {
                setTenderedGhs(e.target.value);
              }
            }}
            required
            className="h-10 text-sm font-bold rounded-xl"
          />
        </div>

        {/* CASH SPECIFIC: Tender & Change */}
        {channel === "CASH" && (
          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block">
                Quick Cash Tender Presets
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {quickPresets.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTenderedGhs(val.toFixed(2))}
                    className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      parseFloat(tenderedGhs) === val
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-white text-zinc-800 border-emerald-200 hover:bg-emerald-100"
                    }`}
                  >
                    {val === Math.ceil(amountPesewas / 100) ? `Exact: GH₵ ${val}` : `GH₵ ${val}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <Label htmlFor="tenderedInput" className="text-xs font-semibold text-emerald-950 block mb-1">
                  Cash Handed Over (GH₵)
                </Label>
                <Input
                  id="tenderedInput"
                  type="number"
                  step="1"
                  min={amountGhs}
                  value={tenderedGhs}
                  onChange={(e) => setTenderedGhs(e.target.value)}
                  className="h-9 text-xs font-bold rounded-xl bg-white"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-emerald-950 block mb-1">
                  Change to Return
                </Label>
                <div className="h-9 px-3 rounded-xl bg-white border border-emerald-200 flex items-center justify-between font-black text-sm text-emerald-800">
                  <span>Change:</span>
                  <span>{changePesewas > 0 ? formatPesewas(changePesewas) : "GH₵ 0.00"}</span>
                </div>
              </div>
            </div>

            {changePesewas > 0 && (
              <div className="p-2 bg-emerald-100/80 rounded-xl text-center text-xs font-black text-emerald-900">
                Return {formatPesewas(changePesewas)} cash change to customer
              </div>
            )}
          </div>
        )}

        {/* MOMO SPECIFIC */}
        {channel === "MOBILE_MONEY" && (
          <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold text-zinc-700 block mb-1">Provider</Label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full h-9 text-xs border border-zinc-200 rounded-xl px-2.5 bg-white font-semibold"
                >
                  <option value="MTN">MTN MoMo</option>
                  <option value="TELECEL">Telecel Cash</option>
                  <option value="AT">AT Money</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-700 block mb-1">Tx Ref / ID</Label>
                <Input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. 294819..."
                  className="h-9 text-xs rounded-xl bg-white font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* CARD / BANK SPECIFIC */}
        {(channel === "CARD" || channel === "BANK_TRANSFER") && (
          <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-2">
            <div>
              <Label className="text-xs font-semibold text-zinc-700 block mb-1">
                {channel === "CARD" ? "Card Approval Slip Code" : "Bank Transfer Ref"}
              </Label>
              <Input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. SLIP-98124..."
                className="h-9 text-xs rounded-xl bg-white font-mono"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
          <Button
            type="button"
            variant="outlinePill"
            onClick={onClose}
            className="rounded-xl text-xs h-10 px-4 cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={loading}
            className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs h-10 px-5 font-bold flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Receipt className="w-4 h-4" />
            <span>{loading ? "Recording..." : `Confirm ${channel === "CASH" ? "Cash" : channel} Payment`}</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

