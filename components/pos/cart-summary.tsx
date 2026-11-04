"use client";

import * as React from "react";
import {
  Trash2,
  Tag,
  Clock,
  Zap,
  Calendar,
  CreditCard,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Input } from "@/components/ui/controls";
import { formatPesewas } from "@/lib/money";
import type { PosItemInput } from "@/lib/pos/types";
import type { DiscountState } from "./discount-modal";

export interface PosStaffOption {
  id: string;
  name: string;
  specialties?: string[];
}

export function CartSummary({
  items,
  staffList,
  selectedStaffId,
  onSelectStaff,
  isWalkIn,
  onToggleWalkIn,
  scheduledTime,
  onChangeScheduledTime,
  discount,
  onOpenDiscountModal,
  onRemoveItem,
  onClearCart,
  onProceedToCheckout,
}: {
  items: PosItemInput[];
  staffList: PosStaffOption[];
  selectedStaffId: string;
  onSelectStaff: (staffId: string) => void;
  isWalkIn: boolean;
  onToggleWalkIn: (walkIn: boolean) => void;
  scheduledTime: string;
  onChangeScheduledTime: (val: string) => void;
  discount: DiscountState;
  onOpenDiscountModal: () => void;
  onRemoveItem: (index: number) => void;
  onClearCart: () => void;
  onProceedToCheckout: () => void;
}) {
  // Calculate live subtotal
  let subtotalPesewas = 0;
  let totalDurationMin = 0;

  for (const item of items) {
    let itemTotal = item.pricePesewas;
    let itemDur = item.durationMin;
    for (const addon of item.addOns || []) {
      itemTotal += addon.pricePesewas;
      itemDur += addon.durationMin;
    }
    subtotalPesewas += itemTotal;
    totalDurationMin += itemDur;
  }

  // Calculate live discount
  let discountPesewas = 0;
  if (discount.type === "PERCENT" && discount.percent) {
    discountPesewas = Math.round((subtotalPesewas * discount.percent) / 100);
  } else if (discount.type === "PROMO") {
    discountPesewas = discount.calculatedDiscountPesewas || 0;
  }

  const totalPesewas = Math.max(0, subtotalPesewas - discountPesewas);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 flex flex-col justify-between shadow-sm h-full">
      <div className="space-y-4">
        {/* Cart Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-sm text-zinc-900 dark:text-white uppercase tracking-wider">
              Current Sale
            </h2>
            <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs px-2 py-0.5 rounded-full font-bold">
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={onClearCart}
              className="text-xs text-red-600 hover:text-red-700 font-medium"
            >
              Clear Cart
            </button>
          )}
        </div>

        {/* Timing Controls (Solo shop mode: Stylist selection omitted) */}
        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-100 dark:border-zinc-800/60">
          {/* Solo direct shop mode: Assigned Staff selector omitted
          <div>
            <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
              Assigned Staff
            </Label>
            <select
              value={selectedStaffId}
              onChange={(e) => onSelectStaff(e.target.value)}
              className="w-full h-8 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 text-zinc-900 dark:text-white font-medium"
            >
              {staffList.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} {st.specialties && st.specialties.length > 0 ? `(${st.specialties[0]})` : ""}
                </option>
              ))}
            </select>
          </div>
          */}

          {/* Walk-in vs Scheduled Slot */}
          <div>
            <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
              Timing
            </Label>
            <div className="flex p-0.5 bg-zinc-200/70 dark:bg-zinc-900 rounded-xl">
              <button
                type="button"
                onClick={() => onToggleWalkIn(true)}
                className={`flex-1 py-1 text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  isWalkIn
                    ? "bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white shadow-xs font-bold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-black"
                }`}
              >
                <Zap className="w-3 h-3 text-amber-500" />
                <span>Now (Walk-in)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onToggleWalkIn(false);
                  if (!scheduledTime) {
                    // Default to today at next rounded hour
                    const now = new Date();
                    now.setMinutes(0, 0, 0);
                    now.setHours(now.getHours() + 1);
                    const pad = (n: number) => String(n).padStart(2, "0");
                    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:00`;
                    onChangeScheduledTime(dateStr);
                  }
                }}
                className={`flex-1 py-1 text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  !isWalkIn
                    ? "bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white shadow-xs font-bold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-black"
                }`}
              >
                <Calendar className="w-3 h-3 text-blue-500" />
                <span>Book Slot</span>
              </button>
            </div>
          </div>

          {!isWalkIn && (
            <div className="pt-2 space-y-2 border-t border-zinc-200/60 dark:border-zinc-700/60 animate-in fade-in">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                  Select Appointment Date
                </Label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date().toISOString().split("T")[0];
                      const currentTime = scheduledTime ? scheduledTime.split("T")[1] || "10:00" : "10:00";
                      onChangeScheduledTime(`${today}T${currentTime}`);
                    }}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-zinc-200/70 hover:bg-zinc-300 text-zinc-700 cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const tmrw = new Date();
                      tmrw.setDate(tmrw.getDate() + 1);
                      const tmrwStr = tmrw.toISOString().split("T")[0];
                      const currentTime = scheduledTime ? scheduledTime.split("T")[1] || "10:00" : "10:00";
                      onChangeScheduledTime(`${tmrwStr}T${currentTime}`);
                    }}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-zinc-200/70 hover:bg-zinc-300 text-zinc-700 cursor-pointer"
                  >
                    Tomorrow
                  </button>
                </div>
              </div>

              <Input
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={scheduledTime ? scheduledTime.split("T")[0] : ""}
                onChange={(e) => {
                  const newDate = e.target.value;
                  const currentTime = scheduledTime ? scheduledTime.split("T")[1] || "10:00" : "10:00";
                  onChangeScheduledTime(`${newDate}T${currentTime}`);
                }}
                className="h-8 text-xs rounded-xl"
              />

              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                  Available Salon Slot
                </Label>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-1 pt-0.5">
                  {["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"].map((slot) => {
                    const currentDate = scheduledTime ? scheduledTime.split("T")[0] : new Date().toISOString().split("T")[0];
                    const slotDateTime = `${currentDate}T${slot}`;
                    const isSelected = scheduledTime?.startsWith(`${currentDate}T${slot}`);
                    const formatHour = (s: string) => {
                      const h = parseInt(s.split(":")[0], 10);
                      const ampm = h >= 12 ? "PM" : "AM";
                      const hr = h % 12 || 12;
                      return `${hr}:00 ${ampm}`;
                    };

                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => onChangeScheduledTime(slotDateTime)}
                        className={`py-1 text-[10px] font-bold rounded-lg transition-all border text-center cursor-pointer ${
                          isSelected
                            ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
                            : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300"
                        }`}
                      >
                        {formatHour(slot)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slot Duration & End Time Preview */}
              {scheduledTime && (
                <div className="p-2 rounded-xl bg-blue-50/80 border border-blue-200/60 text-[11px] text-blue-900 flex items-center justify-between font-medium">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Slot: {new Date(scheduledTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                  <span className="text-blue-700 text-[10px]">
                    {totalDurationMin} mins (ends ~{new Date(new Date(scheduledTime).getTime() + totalDurationMin * 60000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })})
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Items List */}
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {items.map((item, idx) => {
            const itemAddons = item.addOns || [];
            const addonTotal = itemAddons.reduce((sum, a) => sum + a.pricePesewas, 0);
            const totalLinePrice = item.pricePesewas + addonTotal;

            return (
              <div
                key={idx}
                className="p-3 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-2xl flex items-start justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <h4 className="font-semibold text-xs text-zinc-900 dark:text-white">
                    {item.serviceName}
                  </h4>
                  <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                    <Clock className="w-3 h-3" />
                    <span>{item.durationMin}m</span>
                    <span>•</span>
                    <span>{formatPesewas(item.pricePesewas)}</span>
                  </div>

                  {itemAddons.length > 0 && (
                    <div className="pt-1 space-y-0.5">
                      {itemAddons.map((addon, aIdx) => (
                        <div
                          key={aIdx}
                          className="text-[10px] text-zinc-600 dark:text-zinc-400 flex items-center gap-1 pl-1"
                        >
                          <Plus className="w-2.5 h-2.5 text-amber-500" />
                          <span>{addon.name} (+{formatPesewas(addon.pricePesewas)})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-zinc-900 dark:text-white">
                    {formatPesewas(totalLinePrice)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(idx)}
                    className="text-zinc-400 hover:text-red-600 p-1 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="p-8 text-center text-zinc-400 text-xs border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
              Cart is empty. Tap any service from the catalog to start a sale.
            </div>
          )}
        </div>
      </div>

      {/* Live Financial Totals & Checkout Button */}
      <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3 mt-4">
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
            <span>Subtotal ({totalDurationMin} mins)</span>
            <span className="font-semibold text-zinc-900 dark:text-white">
              {formatPesewas(subtotalPesewas)}
            </span>
          </div>

          {/* Discount Trigger / Display */}
          <div className="flex justify-between items-center py-1">
            <button
              type="button"
              onClick={onOpenDiscountModal}
              className="text-[11px] font-semibold text-zinc-900 dark:text-white flex items-center gap-1 hover:underline"
            >
              <Tag className="w-3.5 h-3.5 text-amber-500" />
              <span>
                {discount.type === "PERCENT"
                  ? `Discount (${discount.percent}%)`
                  : discount.type === "PROMO"
                  ? `Promo (${discount.promoCode})`
                  : "Apply Discount / Promo"}
              </span>
            </button>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {discountPesewas > 0 ? `-${formatPesewas(discountPesewas)}` : "—"}
            </span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-zinc-100 dark:border-zinc-800 text-base font-bold text-zinc-900 dark:text-white">
            <span>Total Payable</span>
            <span className="text-xl tracking-tight">{formatPesewas(totalPesewas)}</span>
          </div>
        </div>

        {/* Checkout Button */}
        <Button
          type="button"
          disabled={items.length === 0}
          onClick={onProceedToCheckout}
          className="w-full bg-zinc-900 hover:bg-black text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 font-bold h-12 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50"
        >
          <CreditCard className="w-4 h-4" />
          <span>Proceed to Tender & Checkout</span>
        </Button>
      </div>
    </div>
  );
}
