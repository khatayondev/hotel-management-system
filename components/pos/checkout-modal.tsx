"use client";

import * as React from "react";
import {
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  Split,
  Trash2,
  AlertCircle,
  CheckCircle,
  Receipt as ReceiptIcon,
  Calendar,
  Clock,
  Sparkles,
  ArrowRight,
  BedDouble,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog-and-drawer";
import { formatPesewas } from "@/lib/money";
import { triggerGlobalDataSync } from "@/hooks/use-smart-polling";
import type { PosPaymentSplitInput, PosCheckoutInput, PosReceiptDetail, PaymentMethod } from "@/lib/pos/types";

export function CheckoutModal({
  isOpen,
  onClose,
  checkoutPayload,
  totalPesewas,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  checkoutPayload: Omit<PosCheckoutInput, "payments">;
  totalPesewas: number;
  onSuccess: (receipt: PosReceiptDetail) => void;
}) {
  const isScheduled = !checkoutPayload.isWalkIn && !!checkoutPayload.scheduledStartUtc;

  // Selected payment mode
  const [activeMethod, setActiveMethod] = React.useState<PaymentMethod | "SPLIT">("CASH");

  // In-House Guest Room Charge State
  const [selectedGuestFolio, setSelectedGuestFolio] = React.useState<{
    folioId: string;
    guestName: string;
    roomNumber: string;
    balancePesewas: number;
  } | null>(null);
  const [guestSearchQuery, setGuestSearchQuery] = React.useState("");
  const [inHouseGuests, setInHouseGuests] = React.useState<Array<{
    folioId: string;
    guestName: string;
    roomNumber: string;
    guestPhone: string;
    balancePesewas: number;
  }>>([]);
  const [loadingGuests, setLoadingGuests] = React.useState(false);

  // For scheduled slots: whether paying in full, deposit (50%), or reserving to pay later
  const [coverageType, setCoverageType] = React.useState<"FULL" | "DEPOSIT" | "PAY_LATER">("FULL");

  // Single method fields
  const [cashTenderedGhs, setCashTenderedGhs] = React.useState<string>("");
  const [momoProvider, setMomoProvider] = React.useState<string>("MTN");
  const [momoPhone, setMomoPhone] = React.useState<string>("");
  const [momoRef, setMomoRef] = React.useState<string>("");
  const [cardNetwork, setCardNetwork] = React.useState<string>("VISA");
  const [cardAuthRef, setCardAuthRef] = React.useState<string>("");
  const [bankName, setBankName] = React.useState<string>("GCB Bank");
  const [bankRef, setBankRef] = React.useState<string>("");

  // Split payment list
  const [splitPayments, setSplitPayments] = React.useState<PosPaymentSplitInput[]>([]);

  // Tip and submission states
  const [tipGhs, setTipGhs] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const tipPesewas = Math.max(0, Math.round((parseFloat(tipGhs) || 0) * 100));
  const finalTotalPesewas = totalPesewas + tipPesewas;

  // Amount expected to be collected right now
  const targetCollectionPesewas = React.useMemo(() => {
    if (isScheduled && coverageType === "PAY_LATER") return 0;
    if (isScheduled && coverageType === "DEPOSIT") {
      return Math.round(finalTotalPesewas * 0.5);
    }
    return finalTotalPesewas;
  }, [isScheduled, coverageType, finalTotalPesewas]);

  // Sync state on modal open
  const [prevIsOpen, setPrevIsOpen] = React.useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setActiveMethod("CASH");
      setCoverageType("FULL");
      setCashTenderedGhs((targetCollectionPesewas / 100).toFixed(2));
      setMomoPhone(checkoutPayload.customer?.phone || "");
      setMomoRef("");
      setCardAuthRef("");
      setBankRef("");
      setTipGhs("");
      setError(null);
      setSplitPayments([
        {
          method: "CASH",
          amountPesewas: targetCollectionPesewas,
          tenderedPesewas: targetCollectionPesewas,
        },
      ]);
    }
  }

  // Update default cash tendered when target changes
  React.useEffect(() => {
    if (isOpen && activeMethod === "CASH") {
      setCashTenderedGhs((targetCollectionPesewas / 100).toFixed(2));
    }
  }, [targetCollectionPesewas, activeMethod, isOpen]);

  // Load in-house guests when Charge to Room is active
  React.useEffect(() => {
    if (isOpen && activeMethod === "CHARGE_TO_ROOM") {
      let ignore = false;
      const loadGuests = async () => {
        try {
          setLoadingGuests(true);
          const res = await fetch(`/api/admin/hotel/in-house-guests?query=${encodeURIComponent(guestSearchQuery)}`);
          const data = await res.json();
          if (!ignore && res.ok) {
            setInHouseGuests(data.data?.guests || []);
          }
        } catch {
          // non-blocking
        } finally {
          if (!ignore) setLoadingGuests(false);
        }
      };
      loadGuests();
      return () => {
        ignore = true;
      };
    }
  }, [isOpen, activeMethod, guestSearchQuery]);

  // Cash change math
  const cashTenderedPesewas = Math.max(0, Math.round((parseFloat(cashTenderedGhs) || 0) * 100));
  const cashChangePesewas = Math.max(0, cashTenderedPesewas - targetCollectionPesewas);

  // Split payments calculations
  const splitTotalPaid = splitPayments.reduce((sum, p) => sum + (p.amountPesewas || 0), 0);
  const splitRemainingDue = Math.max(0, targetCollectionPesewas - splitTotalPaid);

  let splitChangePesewas = 0;
  for (const p of splitPayments) {
    if (p.method === "CASH" && p.tenderedPesewas && p.tenderedPesewas > p.amountPesewas) {
      splitChangePesewas += p.tenderedPesewas - p.amountPesewas;
    }
  }

  // Quick preset bill buttons for cash tender
  const quickCashPresets = React.useMemo(() => {
    const dueGhs = Math.ceil(targetCollectionPesewas / 100);
    const presets = new Set<number>();
    presets.add(dueGhs);
    [20, 50, 100, 200, 300, 500].forEach((b) => {
      if (b >= dueGhs) presets.add(b);
    });
    return Array.from(presets).sort((a, b) => a - b).slice(0, 5);
  }, [targetCollectionPesewas]);

  const handleAddSplit = (method: PaymentMethod) => {
    const unallocated = Math.max(0, targetCollectionPesewas - splitTotalPaid);
    setSplitPayments((prev) => [
      ...prev,
      {
        method,
        amountPesewas: unallocated,
        tenderedPesewas: method === "CASH" ? unallocated : undefined,
        provider: method === "MOBILE_MONEY" ? "MTN" : method === "CARD" ? "VISA" : undefined,
        reference: "",
      },
    ]);
  };

  const handleRemoveSplit = (idx: number) => {
    setSplitPayments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateSplit = (idx: number, updates: Partial<PosPaymentSplitInput>) => {
    setSplitPayments((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...updates };
      return copy;
    });
  };

  const handleCompleteSale = async () => {
    setError(null);

    // Build finalized payments array
    let finalPayments: PosPaymentSplitInput[] = [];

    if (isScheduled && coverageType === "PAY_LATER") {
      // Zero paid now: slot reservation
      finalPayments = [];
    } else if (activeMethod === "SPLIT") {
      if (splitPayments.length === 0) {
        setError("At least one split payment method is required.");
        return;
      }
      for (const p of splitPayments) {
        if (p.amountPesewas < 0) {
          setError("Payment amounts cannot be negative.");
          return;
        }
        if (p.method === "CASH" && (p.tenderedPesewas ?? 0) < p.amountPesewas) {
          setError("Cash tendered cannot be less than the cash portion of the bill.");
          return;
        }
      }
      finalPayments = splitPayments;
    } else if (activeMethod === "CASH") {
      if (cashTenderedPesewas < targetCollectionPesewas) {
        setError("Cash handed over cannot be less than the amount due.");
        return;
      }
      finalPayments = [
        {
          method: "CASH",
          amountPesewas: targetCollectionPesewas,
          tenderedPesewas: cashTenderedPesewas,
        },
      ];
    } else if (activeMethod === "MOBILE_MONEY") {
      finalPayments = [
        {
          method: "MOBILE_MONEY",
          amountPesewas: targetCollectionPesewas,
          provider: momoProvider,
          reference: momoRef.trim() || undefined,
          notes: momoPhone.trim() ? `Sender: ${momoPhone.trim()}` : undefined,
        },
      ];
    } else if (activeMethod === "CARD") {
      finalPayments = [
        {
          method: "CARD",
          amountPesewas: targetCollectionPesewas,
          provider: cardNetwork,
          reference: cardAuthRef.trim() || undefined,
        },
      ];
    } else if (activeMethod === "BANK_TRANSFER") {
      finalPayments = [
        {
          method: "BANK_TRANSFER",
          amountPesewas: targetCollectionPesewas,
          provider: bankName,
          reference: bankRef.trim() || undefined,
        },
      ];
    } else if (activeMethod === "CHARGE_TO_ROOM") {
      if (!selectedGuestFolio) {
        setError("Please search and select an in-house guest room to charge.");
        return;
      }
      finalPayments = [
        {
          method: "CHARGE_TO_ROOM",
          amountPesewas: targetCollectionPesewas,
          folioId: selectedGuestFolio.folioId,
          roomNumber: selectedGuestFolio.roomNumber,
          notes: `Charged to Room ${selectedGuestFolio.roomNumber} (${selectedGuestFolio.guestName})`,
        },
      ];
    }

    setIsSubmitting(true);
    try {
      const payload: PosCheckoutInput = {
        ...checkoutPayload,
        tipPesewas,
        payments: finalPayments,
      };

      const res = await fetch("/api/admin/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to process POS checkout");
      }

      triggerGlobalDataSync("all");
      onSuccess(data.data.receipt);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred during checkout.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isScheduled ? "Book Slot & Select Payment" : "POS Checkout & Tender"}
      description={
        isScheduled
          ? "Reserve this salon slot, collect cash or mobile payment, and issue a receipt."
          : "Accept cash, mobile money, card, or split tenders with instant receipt generation."
      }
    >
      <div className="space-y-4 pt-1 max-h-[80vh] overflow-y-auto pr-1">
        {/* Scheduled Slot Notice */}
        {isScheduled && checkoutPayload.scheduledStartUtc && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <span className="font-bold text-blue-950 dark:text-blue-200">
                  Scheduled Appointment:{" "}
                  {new Date(checkoutPayload.scheduledStartUtc).toLocaleDateString([], {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="text-blue-700 dark:text-blue-300 block text-[11px]">
                  Slot starts at{" "}
                  {new Date(checkoutPayload.scheduledStartUtc).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>

            <div className="flex bg-white dark:bg-zinc-900 rounded-xl p-0.5 border border-blue-200 dark:border-blue-800">
              <button
                type="button"
                onClick={() => setCoverageType("FULL")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  coverageType === "FULL"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                100% Full
              </button>
              <button
                type="button"
                onClick={() => setCoverageType("DEPOSIT")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  coverageType === "DEPOSIT"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                50% Deposit
              </button>
              <button
                type="button"
                onClick={() => setCoverageType("PAY_LATER")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  coverageType === "PAY_LATER"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                Pay Later
              </button>
            </div>
          </div>
        )}

        {/* Total Banner */}
        <div className="p-4 bg-zinc-950 text-white rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">
              {isScheduled && coverageType === "DEPOSIT" ? "Deposit Due Now" : "Total Amount Due"}
            </span>
            <div className="text-2xl font-black tracking-tight text-white">
              {formatPesewas(targetCollectionPesewas)}
            </div>
            {isScheduled && coverageType === "DEPOSIT" && (
              <span className="text-[11px] text-amber-300 font-medium">
                Remaining {formatPesewas(finalTotalPesewas - targetCollectionPesewas)} due at appointment
              </span>
            )}
            {tipPesewas > 0 && (
              <span className="text-[11px] text-zinc-400 block">
                Includes {formatPesewas(tipPesewas)} staff tip
              </span>
            )}
          </div>

          <div className="text-right">
            <span className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">
              Payment Status
            </span>
            <div className="text-sm font-bold text-emerald-400">
              {coverageType === "PAY_LATER"
                ? "Slot Reserved (Unpaid)"
                : activeMethod === "CASH" && cashChangePesewas > 0
                ? "Cash Change Calculated"
                : "Ready to Tender"}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Optional Tip Input */}
        {coverageType !== "PAY_LATER" && (
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="tip-input" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Optional Staff Tip (GH₵)
              </Label>
              <p className="text-[10px] text-zinc-500">Attributed directly to scheduled specialist</p>
            </div>
            <Input
              id="tip-input"
              type="number"
              step="1"
              min="0"
              value={tipGhs}
              onChange={(e) => setTipGhs(e.target.value)}
              placeholder="0.00"
              className="w-28 h-9 text-xs rounded-xl text-right font-semibold"
            />
          </div>
        )}

        {/* Payment Method Selector Tabs */}
        {coverageType !== "PAY_LATER" ? (
          <div className="space-y-3">
            <Label className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider block">
              Select Payment Method
            </Label>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl">
              <button
                type="button"
                onClick={() => setActiveMethod("CASH")}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeMethod === "CASH"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-white/60 dark:hover:bg-zinc-700"
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMethod("MOBILE_MONEY")}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeMethod === "MOBILE_MONEY"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-white/60 dark:hover:bg-zinc-700"
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>MoMo</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMethod("CARD")}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeMethod === "CARD"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-white/60 dark:hover:bg-zinc-700"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Card</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMethod("CHARGE_TO_ROOM")}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeMethod === "CHARGE_TO_ROOM"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-white/60 dark:hover:bg-zinc-700"
                }`}
              >
                <BedDouble className="w-4 h-4" />
                <span>To Room</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMethod("BANK_TRANSFER")}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeMethod === "BANK_TRANSFER"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-white/60 dark:hover:bg-zinc-700"
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Bank</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveMethod("SPLIT");
                  if (splitPayments.length === 0) {
                    setSplitPayments([
                      {
                        method: "CASH",
                        amountPesewas: Math.round(targetCollectionPesewas / 2),
                        tenderedPesewas: Math.round(targetCollectionPesewas / 2),
                      },
                      {
                        method: "MOBILE_MONEY",
                        amountPesewas: targetCollectionPesewas - Math.round(targetCollectionPesewas / 2),
                        provider: "MTN",
                      },
                    ]);
                  }
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeMethod === "SPLIT"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-white/60 dark:hover:bg-zinc-700"
                }`}
              >
                <Split className="w-4 h-4" />
                <span>Split</span>
              </button>
            </div>

            {/* 1. CASH PAYMENT PANEL */}
            {activeMethod === "CASH" && (
              <div className="p-4 bg-white dark:bg-zinc-900 border-2 border-emerald-500/40 rounded-2xl space-y-4 shadow-sm animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-xl">
                      <Banknote className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider">
                        Cash Tender & Change
                      </h3>
                      <p className="text-[11px] text-zinc-500">
                        Collect physical banknotes and return customer change
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200">
                    Due: {formatPesewas(targetCollectionPesewas)}
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                    Quick Cash Presets (Tap to Set)
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {quickCashPresets.map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCashTenderedGhs(val.toFixed(2))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          parseFloat(cashTenderedGhs) === val
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border-zinc-200"
                        }`}
                      >
                        {val === Math.ceil(targetCollectionPesewas / 100) ? `Exact: GH₵ ${val}` : `GH₵ ${val}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tender Input */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <Label htmlFor="cashTenderInput" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Cash Handed Over (GH₵)
                    </Label>
                    <Input
                      id="cashTenderInput"
                      type="number"
                      step="1"
                      min={(targetCollectionPesewas / 100).toFixed(2)}
                      value={cashTenderedGhs}
                      onChange={(e) => setCashTenderedGhs(e.target.value)}
                      className="h-10 text-sm font-bold text-zinc-900 rounded-xl"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Calculated Change Due
                    </Label>
                    <div
                      className={`h-10 px-3 rounded-xl flex items-center justify-between font-black text-sm border ${
                        cashChangePesewas > 0
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800/40 dark:text-zinc-400"
                      }`}
                    >
                      <span>Change:</span>
                      <span className="text-base font-extrabold">
                        {cashChangePesewas > 0 ? formatPesewas(cashChangePesewas) : "GH₵ 0.00"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Change callout banner */}
                {cashChangePesewas > 0 ? (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-emerald-900 dark:text-emerald-200 text-xs font-bold">
                    <span>Hand back to customer:</span>
                    <span className="text-base font-black">{formatPesewas(cashChangePesewas)} change</span>
                  </div>
                ) : (
                  <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-xl text-center text-zinc-600 dark:text-zinc-400 text-xs font-medium">
                    Exact amount tendered • No change required
                  </div>
                )}
              </div>
            )}

            {/* 2. MOBILE MONEY (MOMO) PANEL */}
            {activeMethod === "MOBILE_MONEY" && (
              <div className="p-4 bg-white dark:bg-zinc-900 border-2 border-amber-500/40 rounded-2xl space-y-4 shadow-sm animate-in fade-in">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded-xl">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider">
                      Mobile Money Payment (MoMo)
                    </h3>
                    <p className="text-[11px] text-zinc-500">
                      Record client MoMo payment or transaction reference
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Network Provider
                    </Label>
                    <select
                      value={momoProvider}
                      onChange={(e) => setMomoProvider(e.target.value)}
                      className="w-full h-10 text-xs border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 bg-white dark:bg-zinc-900 font-semibold"
                    >
                      <option value="MTN">MTN MoMo</option>
                      <option value="TELECEL">Telecel Cash (Vodafone)</option>
                      <option value="AT">AT Money (AirtelTigo)</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Customer Phone Number
                    </Label>
                    <Input
                      type="text"
                      value={momoPhone}
                      onChange={(e) => setMomoPhone(e.target.value)}
                      placeholder="e.g. 024 123 4567"
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    MoMo Transaction ID / Reference (Optional)
                  </Label>
                  <Input
                    type="text"
                    value={momoRef}
                    onChange={(e) => setMomoRef(e.target.value)}
                    placeholder="e.g. 284910284..."
                    className="h-10 text-xs font-mono rounded-xl"
                  />
                </div>
              </div>
            )}

            {/* 3. CARD / POS SLIP PANEL */}
            {activeMethod === "CARD" && (
              <div className="p-4 bg-white dark:bg-zinc-900 border-2 border-blue-500/40 rounded-2xl space-y-4 shadow-sm animate-in fade-in">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded-xl">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider">
                      Card / Physical POS Terminal Slip
                    </h3>
                    <p className="text-[11px] text-zinc-500">
                      Swiped or tapped on salon card machine
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Card Network
                    </Label>
                    <select
                      value={cardNetwork}
                      onChange={(e) => setCardNetwork(e.target.value)}
                      className="w-full h-10 text-xs border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 bg-white dark:bg-zinc-900 font-semibold"
                    >
                      <option value="VISA">Visa Card</option>
                      <option value="MASTERCARD">Mastercard</option>
                      <option value="GH_LINK">Gh-Link National Card</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      POS Approval / Slip Code (Optional)
                    </Label>
                    <Input
                      type="text"
                      value={cardAuthRef}
                      onChange={(e) => setCardAuthRef(e.target.value)}
                      placeholder="e.g. AUTH-98213"
                      className="h-10 text-xs font-mono rounded-xl"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 4. BANK TRANSFER PANEL */}
            {activeMethod === "BANK_TRANSFER" && (
              <div className="p-4 bg-white dark:bg-zinc-900 border-2 border-purple-500/40 rounded-2xl space-y-4 shadow-sm animate-in fade-in">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 rounded-xl">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider">
                      Direct Bank Wire / Transfer
                    </h3>
                    <p className="text-[11px] text-zinc-500">
                      Direct deposit or mobile bank app transfer
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Bank Name
                    </Label>
                    <select
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full h-10 text-xs border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 bg-white dark:bg-zinc-900 font-semibold"
                    >
                      <option value="GCB Bank">GCB Bank</option>
                      <option value="Ecobank Ghana">Ecobank Ghana</option>
                      <option value="Stanbic Bank">Stanbic Bank</option>
                      <option value="Fidelity Bank">Fidelity Bank</option>
                      <option value="Absa Bank">Absa Bank</option>
                      <option value="Standard Chartered">Standard Chartered</option>
                      <option value="Zenith Bank">Zenith Bank</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Transfer / Sender Reference
                    </Label>
                    <Input
                      type="text"
                      value={bankRef}
                      onChange={(e) => setBankRef(e.target.value)}
                      placeholder="e.g. TX-WIRE-48192"
                      className="h-10 text-xs font-mono rounded-xl"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* CHARGE TO ROOM PANEL */}
            {activeMethod === "CHARGE_TO_ROOM" && (
              <div className="p-4 bg-white dark:bg-zinc-900 border-2 border-amber-500/40 rounded-2xl space-y-4 shadow-sm animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded-xl">
                      <BedDouble className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider">
                        Charge to Guest Room
                      </h3>
                      <p className="text-[11px] text-zinc-500">
                        Post restaurant dining or room service to an in-house folio
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                    Total: {formatPesewas(targetCollectionPesewas)}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Search In-House Guest by Room # or Name
                    </Label>
                    <Input
                      type="text"
                      value={guestSearchQuery}
                      onChange={(e) => setGuestSearchQuery(e.target.value)}
                      placeholder="e.g. 101, Kwesi, +23324..."
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>

                  {selectedGuestFolio && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-amber-950 block">
                          Selected: Room {selectedGuestFolio.roomNumber} — {selectedGuestFolio.guestName}
                        </span>
                        <span className="text-[11px] text-amber-800">
                          Current Folio Balance: {formatPesewas(selectedGuestFolio.balancePesewas)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedGuestFolio(null)}
                        className="text-xs text-amber-900 underline font-semibold cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  {!selectedGuestFolio && (
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl max-h-40 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                      {loadingGuests ? (
                        <div className="text-center py-4 text-xs text-zinc-400">Searching in-house guests...</div>
                      ) : inHouseGuests.length === 0 ? (
                        <div className="text-center py-4 text-xs text-zinc-400">
                          No in-house guests found matching your search.
                        </div>
                      ) : (
                        inHouseGuests.map((g) => (
                          <button
                            key={g.folioId}
                            type="button"
                            onClick={() =>
                              setSelectedGuestFolio({
                                folioId: g.folioId,
                                guestName: g.guestName,
                                roomNumber: g.roomNumber,
                                balancePesewas: g.balancePesewas,
                              })
                            }
                            className="w-full text-left p-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 flex justify-between items-center text-xs transition-colors cursor-pointer"
                          >
                            <div>
                              <span className="font-bold text-zinc-900 dark:text-white">
                                Room {g.roomNumber}
                              </span>
                              <span className="text-zinc-500 block text-[11px]">{g.guestName}</span>
                            </div>
                            <span className="font-mono text-zinc-700 dark:text-zinc-300 text-[11px]">
                              Bal: {formatPesewas(g.balancePesewas)}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. SPLIT PAYMENT PANEL */}
            {activeMethod === "SPLIT" && (
              <div className="p-4 bg-white dark:bg-zinc-900 border-2 border-zinc-900/40 rounded-2xl space-y-4 shadow-sm animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 rounded-xl">
                      <Split className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider">
                        Split Tender ({splitPayments.length} Methods)
                      </h3>
                      <p className="text-[11px] text-zinc-500">
                        Combine Cash + MoMo + Card on the same sale
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outlinePill"
                      size="sm"
                      onClick={() => handleAddSplit("CASH")}
                      className="h-7 px-2 text-[10px]"
                    >
                      + Cash
                    </Button>
                    <Button
                      type="button"
                      variant="outlinePill"
                      size="sm"
                      onClick={() => handleAddSplit("MOBILE_MONEY")}
                      className="h-7 px-2 text-[10px]"
                    >
                      + MoMo
                    </Button>
                    <Button
                      type="button"
                      variant="outlinePill"
                      size="sm"
                      onClick={() => handleAddSplit("CARD")}
                      className="h-7 px-2 text-[10px]"
                    >
                      + Card
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {splitPayments.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">
                          Method #{idx + 1}: {p.method}
                        </span>
                        {splitPayments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSplit(idx)}
                            className="text-red-500 hover:text-red-700 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px] text-zinc-500 block">Amount (GH₵)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={(p.amountPesewas / 100).toFixed(2)}
                            onChange={(e) => {
                              const pesewas = Math.round((parseFloat(e.target.value) || 0) * 100);
                              handleUpdateSplit(idx, {
                                amountPesewas: pesewas,
                                tenderedPesewas: p.method === "CASH" ? Math.max(pesewas, p.tenderedPesewas || pesewas) : undefined,
                              });
                            }}
                            className="h-8 text-xs font-bold"
                          />
                        </div>

                        {p.method === "CASH" ? (
                          <div>
                            <Label className="text-[10px] text-zinc-500 block">Tendered (GH₵)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={((p.tenderedPesewas ?? p.amountPesewas) / 100).toFixed(2)}
                              onChange={(e) => {
                                const tendered = Math.round((parseFloat(e.target.value) || 0) * 100);
                                handleUpdateSplit(idx, { tenderedPesewas: tendered });
                              }}
                              className="h-8 text-xs font-bold"
                            />
                          </div>
                        ) : (
                          <div>
                            <Label className="text-[10px] text-zinc-500 block">Reference #</Label>
                            <Input
                              type="text"
                              value={p.reference || ""}
                              onChange={(e) => handleUpdateSplit(idx, { reference: e.target.value })}
                              placeholder="Ref..."
                              className="h-8 text-xs"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {splitRemainingDue > 0 && (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-amber-800 text-xs font-bold rounded-xl flex justify-between">
                    <span>Remaining Split Due:</span>
                    <span>{formatPesewas(splitRemainingDue)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* PAY LATER RESERVATION MODE */
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-2 text-xs">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-white font-bold">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Unpaid Slot Reservation</span>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
              This appointment slot will be booked on the calendar with status{" "}
              <strong>PENDING PAYMENT</strong>. The client can pay via cash, MoMo, or card when they arrive at the studio.
            </p>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <Button
            type="button"
            variant="outlinePill"
            onClick={onClose}
            className="rounded-xl text-xs h-10 px-4 cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            disabled={isSubmitting}
            onClick={handleCompleteSale}
            className="bg-zinc-900 hover:bg-black text-white dark:bg-white dark:text-zinc-900 rounded-xl text-xs h-10 px-5 font-bold flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <ReceiptIcon className="w-4 h-4" />
            <span>
              {isSubmitting
                ? "Processing..."
                : isScheduled
                ? coverageType === "PAY_LATER"
                  ? "Reserve Slot (Unpaid)"
                  : "Book Slot & Print Receipt"
                : "Complete Sale & Print Receipt"}
            </span>
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
