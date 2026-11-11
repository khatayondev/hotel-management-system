"use client";

import * as React from "react";
import { formatPesewas } from "@/lib/money";
import { formatDateTime } from "@/lib/date";
import type { HotelReceiptDetail } from "@/lib/hotel/billing";
import {
  Printer,
  Download,
  MessageSquare,
  Share2,
  Check,
  Building,
  Calendar,
  FileText,
  User,
  Phone,
  BedDouble,
  Receipt as ReceiptIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog-and-drawer";

export function HotelReceiptModal({
  isOpen,
  onClose,
  receipt,
}: {
  isOpen: boolean;
  onClose: () => void;
  receipt: HotelReceiptDetail | null;
}) {
  const [layout, setLayout] = React.useState<"A4" | "THERMAL">("A4");
  const [copied, setCopied] = React.useState(false);
  const [smsSending, setSmsSending] = React.useState(false);
  const [smsSent, setSmsSent] = React.useState(false);

  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleSendSms = async () => {
    try {
      setSmsSending(true);
      const res = await fetch(`/api/admin/hotel/receipts/${receipt.id}/send-sms`, {
        method: "POST",
      });
      if (res.ok) {
        setSmsSent(true);
        setTimeout(() => setSmsSent(false), 3000);
      }
    } catch {
      // non-blocking
    } finally {
      setSmsSending(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(
      `Hotel Receipt: ${receipt.receiptNumber}\nGuest: ${receipt.customerName}\nTotal: ${formatPesewas(
        receipt.totalPesewas
      )}\nPaid: ${formatPesewas(receipt.amountPaidPesewas)}\nBalance: ${formatPesewas(
        receipt.balanceDuePesewas
      )}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Hotel Invoice Receipt: ${receipt.receiptNumber}`}
      description="Official hotel folio settlement statement with itemized room charges, restaurant orders, extras, and taxes."
    >
      <div className="space-y-4 pt-1 max-h-[82vh] overflow-y-auto pr-1">
        {/* Layout Switcher & Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-zinc-200 dark:border-zinc-800 no-print">
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => setLayout("A4")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                layout === "A4"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                A4 Invoice Layout
              </span>
            </button>
            <button
              type="button"
              onClick={() => setLayout("THERMAL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                layout === "THERMAL"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5" />
                80mm Thermal Layout
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              size="sm"
              className="bg-zinc-900 text-white hover:bg-black text-xs font-medium rounded-xl flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </Button>
            <Button
              onClick={handleSendSms}
              variant="outlinePill"
              size="sm"
              disabled={smsSending}
              className="text-xs font-medium rounded-xl flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
              {smsSent ? "Sent!" : smsSending ? "Sending..." : "SMS Receipt"}
            </Button>
            <Button
              onClick={handleCopy}
              variant="outlinePill"
              size="sm"
              className="text-xs font-medium rounded-xl flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* LAYOUT 1: A4 Hotel Invoice Statement Layout */}
        {/* ------------------------------------------------------------- */}
        {layout === "A4" && (
          <div
            id="hotel-a4-invoice"
            className="bg-white text-zinc-900 p-6 sm:p-8 border border-zinc-200 rounded-2xl shadow-xs space-y-6 text-xs leading-normal"
          >
            {/* Header: Hotel Branding & Invoice Info */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-zinc-200">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center text-white font-bold">
                    <Building className="w-4 h-4" />
                  </div>
                  <h1 className="text-lg font-extrabold tracking-tight uppercase text-zinc-900">
                    Aura Royal Hotel & Suites
                  </h1>
                </div>
                <p className="text-zinc-500 text-[11px]">Airport Residential Area, Airport Bypass Rd</p>
                <p className="text-zinc-500 text-[11px]">Accra, Greater Accra, Ghana • +233 24 111 9988</p>
                <p className="text-zinc-400 text-[10px]">TIN: C0029482910 | Reg: CS10492819</p>
              </div>

              <div className="sm:text-right space-y-1">
                <span className="inline-block px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 font-bold rounded-lg text-xs uppercase tracking-wider">
                  Guest Folio Invoice
                </span>
                <div className="text-sm font-extrabold font-mono text-zinc-900 pt-1">
                  {receipt.receiptNumber}
                </div>
                <div className="text-zinc-500 text-[11px]">
                  Date: {formatDateTime(receipt.createdAt)}
                </div>
                {receipt.status === "VOIDED" && (
                  <div className="text-red-600 font-bold uppercase text-[11px]">
                    *** VOIDED STATEMENT ***
                  </div>
                )}
              </div>
            </div>

            {/* Guest & Reservation Metadata Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-zinc-50 rounded-xl border border-zinc-200/80">
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Guest Information</div>
                <div className="flex items-center gap-1.5 font-bold text-zinc-800 text-sm">
                  <User className="w-3.5 h-3.5 text-zinc-500" />
                  {receipt.customerName}
                </div>
                <div className="flex items-center gap-1.5 text-zinc-600 text-xs">
                  <Phone className="w-3 h-3 text-zinc-400" />
                  {receipt.customerPhone}
                </div>
                {receipt.cashierName && (
                  <div className="text-zinc-500 text-[11px]">Front Desk Agent: {receipt.cashierName}</div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Stay Information</div>
                <div className="flex items-center gap-1.5 font-bold text-zinc-800 text-xs">
                  <BedDouble className="w-3.5 h-3.5 text-amber-600" />
                  Room: {receipt.roomNumber || "N/A"} ({receipt.roomTypeName || "Standard Room"})
                </div>
                <div className="flex items-center gap-1.5 text-zinc-600 text-[11px]">
                  <Calendar className="w-3 h-3 text-zinc-400" />
                  Check-in: {receipt.checkInDate || "N/A"} → Check-out: {receipt.checkOutDate || "N/A"}
                </div>
                <div className="text-zinc-500 text-[11px] font-mono">
                  Ref: {receipt.reservationReference || receipt.folioNumber || "N/A"}
                </div>
              </div>
            </div>

            {/* Itemized Charges Table */}
            <div>
              <div className="text-xs font-bold text-zinc-800 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <ReceiptIcon className="w-3.5 h-3.5 text-amber-600" />
                Itemized Folio Charges & Taxes
              </div>

              <div className="border border-zinc-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-100 text-zinc-600 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right">Amount (GHS)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {receipt.items.map((item, idx) => {
                      const isNegative = item.amountPesewas < 0;
                      return (
                        <tr key={idx} className="hover:bg-zinc-50/50">
                          <td className="py-2 px-3 font-semibold text-zinc-700">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${
                                item.category === "ROOM_NIGHT"
                                  ? "bg-blue-50 text-blue-800"
                                  : item.category === "RESTAURANT"
                                  ? "bg-amber-50 text-amber-800"
                                  : item.category === "TAX"
                                  ? "bg-purple-50 text-purple-800"
                                  : item.category === "ADJUSTMENT"
                                  ? "bg-emerald-50 text-emerald-800"
                                  : "bg-zinc-100 text-zinc-700"
                              }`}
                            >
                              {item.category.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-zinc-800">{item.description}</td>
                          <td
                            className={`py-2 px-3 text-right font-mono font-medium ${
                              isNegative ? "text-emerald-700 font-bold" : "text-zinc-900"
                            }`}
                          >
                            {isNegative ? `-${formatPesewas(Math.abs(item.amountPesewas))}` : formatPesewas(item.amountPesewas)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary & Split Payments Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              {/* Payment tenders applied */}
              <div className="space-y-2">
                <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                  Payments Reconciled
                </div>
                <div className="border border-zinc-200 rounded-xl p-3 bg-zinc-50/60 space-y-1.5">
                  {receipt.payments.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <span className="font-medium text-zinc-700">
                        {p.method}
                        {p.provider ? ` (${p.provider})` : ""}
                        {p.reference ? ` • ${p.reference}` : ""}
                      </span>
                      <span className="font-mono font-bold text-zinc-900">
                        {formatPesewas(p.amountPesewas)}
                      </span>
                    </div>
                  ))}
                  {receipt.changePesewas > 0 && (
                    <div className="flex justify-between items-center text-xs pt-1 border-t border-zinc-200 text-zinc-500">
                      <span>Cash Change Given:</span>
                      <span className="font-mono">{formatPesewas(receipt.changePesewas)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Ledger Balance Summary Box */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-xs text-zinc-600">
                  <span>Gross Subtotal:</span>
                  <span className="font-mono font-medium">{formatPesewas(receipt.subtotalPesewas)}</span>
                </div>
                {receipt.discountPesewas > 0 && (
                  <div className="flex justify-between text-xs text-emerald-700 font-semibold">
                    <span>Discount / Adjustment:</span>
                    <span className="font-mono">-{formatPesewas(receipt.discountPesewas)}</span>
                  </div>
                )}
                {receipt.taxesPesewas > 0 && (
                  <div className="flex justify-between text-xs text-purple-700 font-semibold">
                    <span>Itemized Taxes:</span>
                    <span className="font-mono">+{formatPesewas(receipt.taxesPesewas)}</span>
                  </div>
                )}
                <div className="border-t border-zinc-200 pt-2 flex justify-between text-sm font-extrabold text-zinc-900">
                  <span>Total Due:</span>
                  <span className="font-mono">{formatPesewas(receipt.totalPesewas)}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-zinc-700">
                  <span>Total Paid:</span>
                  <span className="font-mono text-emerald-700">{formatPesewas(receipt.amountPaidPesewas)}</span>
                </div>
                <div className="border-t border-dashed border-zinc-300 pt-2 flex justify-between text-sm font-black">
                  <span>Outstanding Balance:</span>
                  <span
                    className={`font-mono ${
                      receipt.balanceDuePesewas > 0 ? "text-amber-700" : "text-emerald-700"
                    }`}
                  >
                    {formatPesewas(receipt.balanceDuePesewas)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Notice & Signature */}
            <div className="pt-6 border-t border-zinc-200 flex flex-col sm:flex-row justify-between items-end gap-6 text-[10px] text-zinc-500">
              <div className="space-y-1">
                <p>Thank you for staying at Aura Royal Hotel & Suites!</p>
                <p>All rates include VAT and local levies where applicable. Ghana Cedi (GHS).</p>
              </div>
              <div className="text-center sm:text-right w-44">
                <div className="border-b border-zinc-400 pb-8" />
                <span className="pt-1 block">Guest Signature</span>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* LAYOUT 2: 80mm Thermal Receipt Layout */}
        {/* ------------------------------------------------------------- */}
        {layout === "THERMAL" && (
          <div className="flex justify-center">
            <div
              id="thermal-receipt"
              className="w-[300px] sm:w-[320px] bg-white text-black p-5 border border-dashed border-zinc-400 rounded-2xl shadow-md font-mono text-xs leading-relaxed"
            >
              {/* Hotel Header */}
              <div className="text-center space-y-1 mb-3">
                <h2 className="text-sm font-bold tracking-wider uppercase">AURA ROYAL HOTEL</h2>
                <p className="text-[11px] text-zinc-600">Airport Residential Area</p>
                <p className="text-[11px] text-zinc-600">Accra, Ghana • +233 24 111 9988</p>
                <p className="text-[10px] text-zinc-500">TIN: C0029482910</p>
              </div>

              <div className="border-t border-dashed border-zinc-400 my-2" />

              {/* Metadata */}
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Receipt:</span>
                  <span className="font-bold">{receipt.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Date:</span>
                  <span>{formatDateTime(receipt.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Guest:</span>
                  <span className="font-medium truncate max-w-[170px]">{receipt.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Phone:</span>
                  <span>{receipt.customerPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Room:</span>
                  <span className="font-bold">{receipt.roomNumber || "N/A"}</span>
                </div>
                {receipt.reservationReference && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Booking Ref:</span>
                    <span className="font-semibold">{receipt.reservationReference}</span>
                  </div>
                )}
                {receipt.status === "VOIDED" && (
                  <div className="bg-red-50 text-red-700 p-1 rounded text-center font-bold my-1 border border-red-200">
                    *** VOIDED SALE ***
                  </div>
                )}
              </div>

              <div className="border-t border-dashed border-zinc-400 my-2" />

              {/* Line items */}
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between font-bold text-[10px] text-zinc-500 uppercase pb-1 border-b border-zinc-200">
                  <span>Description</span>
                  <span>Price</span>
                </div>
                {receipt.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start">
                    <span className="truncate max-w-[190px]">{item.description}</span>
                    <span className="shrink-0 font-medium">
                      {item.amountPesewas < 0
                        ? `-${formatPesewas(Math.abs(item.amountPesewas))}`
                        : formatPesewas(item.amountPesewas)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-zinc-400 my-2" />

              {/* Financial calculations */}
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Subtotal:</span>
                  <span>{formatPesewas(receipt.subtotalPesewas)}</span>
                </div>
                {receipt.discountPesewas > 0 && (
                  <div className="flex justify-between text-emerald-800">
                    <span>Discount:</span>
                    <span>-{formatPesewas(receipt.discountPesewas)}</span>
                  </div>
                )}
                {receipt.taxesPesewas > 0 && (
                  <div className="flex justify-between text-purple-800">
                    <span>Taxes:</span>
                    <span>+{formatPesewas(receipt.taxesPesewas)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-xs pt-1 border-t border-zinc-200">
                  <span>Total Due:</span>
                  <span>{formatPesewas(receipt.totalPesewas)}</span>
                </div>
                <div className="flex justify-between font-bold text-xs text-emerald-800">
                  <span>Amount Paid:</span>
                  <span>{formatPesewas(receipt.amountPaidPesewas)}</span>
                </div>
                {receipt.changePesewas > 0 && (
                  <div className="flex justify-between text-zinc-500">
                    <span>Cash Change:</span>
                    <span>{formatPesewas(receipt.changePesewas)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-xs pt-1 border-t border-dashed border-zinc-400">
                  <span>Balance Due:</span>
                  <span>{formatPesewas(receipt.balanceDuePesewas)}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-zinc-400 my-2" />

              {/* Tender details */}
              <div className="space-y-0.5 text-[10px] text-zinc-600">
                <span className="font-bold uppercase text-[9px] text-zinc-400">Payments:</span>
                {receipt.payments.map((p, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>
                      {p.method}
                      {p.provider ? ` (${p.provider})` : ""}
                    </span>
                    <span>{formatPesewas(p.amountPesewas)}</span>
                  </div>
                ))}
              </div>

              <div className="text-center pt-4 text-[10px] text-zinc-500 space-y-0.5">
                <p>Thank you for choosing</p>
                <p className="font-bold">Aura Royal Hotel!</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-zinc-200 dark:border-zinc-800 no-print">
          <Button
            variant="outlinePill"
            onClick={onClose}
            className="text-xs rounded-xl px-4"
          >
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
