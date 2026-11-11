"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatPesewas } from "@/lib/money";
import { Button } from "@/components/ui/button";
import {
  Utensils,
  CheckCircle2,
  Clock,
  AlertCircle,
  CreditCard,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";

interface OrderTrackingData {
  id: string;
  orderNumber: string;
  trackingToken: string;
  type: "DINE_IN" | "PICKUP" | "ROOM_SERVICE" | "WAITER";
  status: "PLACED" | "ACCEPTED" | "PREPARING" | "READY" | "SERVED" | "COMPLETED" | "CANCELLED";
  paymentStatus: "PENDING" | "PAID" | "CHARGED_TO_ROOM" | "REFUNDED";
  placedAt: string;
  acceptedAt?: string | null;
  preparingAt?: string | null;
  readyAt?: string | null;
  servedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  subtotalPesewas: number;
  discountPesewas: number;
  taxPesewas: number;
  totalPesewas: number;
  paystackReference?: string | null;
  table?: { label: string } | null;
  roomNumber?: string | null;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPricePesewas: number;
    totalPricePesewas: number;
    selectedModifiers?: Array<{ optionName: string; priceDeltaPesewas: number }>;
    notes?: string | null;
    station: "KITCHEN" | "BAR";
  }>;
}

export default function OrderTrackingPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen py-24 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
          <p className="text-sm">Loading order...</p>
        </div>
      }
    >
      <OrderTrackingContent />
    </React.Suspense>
  );
}

function OrderTrackingContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params?.token as string;

  const [order, setOrder] = React.useState<OrderTrackingData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [paymentBanner, setPaymentBanner] = React.useState(searchParams.get("payment") === "success");

  // Load and poll order status every 5 seconds
  React.useEffect(() => {
    let cancelled = false;

    async function fetchOrder() {
      if (!token) return;
      try {
        const res = await fetch(`/api/restaurant/orders/${token}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.success && json.data.order) {
          setOrder(json.data.order);
          setLastUpdated(new Date());
          setError("");
        } else {
          setError(json.message || "Order not found");
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error loading order status");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchOrder();
    const timer = setInterval(() => {
      void fetchOrder();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token]);

  if (loading && !order) {
    return (
      <div className="min-h-screen py-24 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-sm">Fetching live order status...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen py-24 px-4 max-w-md mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold">Order Not Found</h1>
        <p className="text-sm text-muted-foreground">
          {error || "We could not find an order matching this tracking link."}
        </p>
        <Link href="/menu">
          <Button className="bg-amber-500 hover:bg-amber-600 text-white gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Menu
          </Button>
        </Link>
      </div>
    );
  }

  // Stepper milestones
  const steps = [
    { key: "PLACED", label: "Placed", desc: "Received by system" },
    { key: "ACCEPTED", label: "Accepted", desc: "Confirmed with kitchen" },
    { key: "PREPARING", label: "Preparing", desc: "Cooking & mixing" },
    { key: "READY", label: "Ready", desc: order.type === "PICKUP" ? "Ready for pickup" : "Ready for service" },
    { key: "SERVED", label: "Complete", desc: order.type === "PICKUP" ? "Picked up" : "Served" },
  ];

  const getStepIndex = (status: string) => {
    switch (status) {
      case "PLACED":
        return 0;
      case "ACCEPTED":
        return 1;
      case "PREPARING":
        return 2;
      case "READY":
        return 3;
      case "SERVED":
      case "COMPLETED":
        return 4;
      default:
        return -1;
    }
  };

  const currentStepIdx = getStepIndex(order.status);
  const isCancelled = order.status === "CANCELLED";

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-4 sm:px-6 max-w-2xl mx-auto space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <Link href="/menu" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Menu
        </Link>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live updates ({lastUpdated ? lastUpdated.toLocaleTimeString() : "syncing..."})</span>
        </div>
      </div>

      {/* Payment Success Banner */}
      {paymentBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Payment received! Your order is being prepared by the culinary team.</span>
          </div>
          <button onClick={() => setPaymentBanner(false)} className="text-emerald-700 font-bold hover:underline">
            ✕
          </button>
        </div>
      )}

      {/* Unpaid Pickup Warning */}
      {order.type === "PICKUP" && order.paymentStatus === "PENDING" && !isCancelled && (
        <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/30 space-y-2">
          <div className="flex items-center gap-2 text-amber-500 font-semibold text-sm">
            <Clock className="w-4 h-4" />
            Payment Required for Pickup
          </div>
          <p className="text-xs text-muted-foreground">
            The kitchen will begin preparing your order as soon as payment is confirmed.
          </p>
          {order.paystackReference && (
            <Button
              size="sm"
              onClick={() => {
                window.location.href = `https://checkout.paystack.com/${order.paystackReference}`;
              }}
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs gap-1.5 mt-1"
            >
              <CreditCard className="w-3.5 h-3.5" /> Complete Payment with Paystack
            </Button>
          )}
        </div>
      )}

      {/* Cancelled Banner */}
      {isCancelled && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive space-y-1">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertCircle className="w-4 h-4" /> Order Cancelled
          </div>
          <p className="text-xs">
            {order.cancelReason || "This order was cancelled by restaurant management."}
          </p>
        </div>
      )}

      {/* Order Header Card */}
      <div className="p-5 rounded-2xl border border-border bg-card space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border">
                {order.orderNumber}
              </span>
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                  order.type === "ROOM_SERVICE"
                    ? "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                    : order.type === "PICKUP"
                    ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                    : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                }`}
              >
                {order.type === "ROOM_SERVICE"
                  ? "Room Service"
                  : order.type === "PICKUP"
                  ? "Pickup"
                  : "Dine-In"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Placed on {new Date(order.placedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span className="font-bold text-lg text-amber-500">
              {formatPesewas(order.totalPesewas)}
            </span>
            <p className="text-[11px] text-muted-foreground">
              {order.paymentStatus === "CHARGED_TO_ROOM"
                ? "Charged to Hotel Folio"
                : order.paymentStatus === "PAID"
                ? "Paid in Full"
                : "Payment Pending"}
            </p>
          </div>
        </div>

        {/* Destination Information */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-secondary/40 border border-border">
            <span className="text-muted-foreground text-[11px]">Location / Destination:</span>
            <p className="font-semibold text-foreground text-sm mt-0.5">
              {order.table?.label ||
                (order.roomNumber ? `Room ${order.roomNumber}` : "Pickup Counter")}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-secondary/40 border border-border">
            <span className="text-muted-foreground text-[11px]">Guest Details:</span>
            <p className="font-semibold text-foreground text-sm mt-0.5">
              {order.customerName || "Hotel Guest"}
            </p>
          </div>
        </div>

        {/* Live Stepper Tracker */}
        {!isCancelled && (
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>Order Progress</span>
              <span className="text-amber-500 font-bold uppercase tracking-wider text-[11px]">
                {order.status}
              </span>
            </div>

            <div className="relative flex items-center justify-between">
              {/* Stepper Line */}
              <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1 bg-secondary -z-0">
                <div
                  className="h-full bg-amber-500 transition-all duration-500"
                  style={{
                    width: `${Math.max(0, (currentStepIdx / (steps.length - 1)) * 100)}%`,
                  }}
                />
              </div>

              {/* Steps */}
              {steps.map((st, idx) => {
                const isPassed = idx <= currentStepIdx;
                const isCurrent = idx === currentStepIdx;
                return (
                  <div key={st.key} className="flex flex-col items-center relative z-10">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isCurrent
                          ? "bg-amber-500 text-white ring-4 ring-amber-500/20 scale-110"
                          : isPassed
                          ? "bg-amber-500 text-white"
                          : "bg-secondary text-muted-foreground border border-border"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <span
                      className={`text-[10px] font-medium mt-1 ${
                        isCurrent ? "text-amber-500 font-bold" : "text-muted-foreground"
                      }`}
                    >
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-xs text-muted-foreground pt-1">
              {steps[currentStepIdx]?.desc || "Processing order..."}
            </p>
          </div>
        )}
      </div>

      {/* Itemized Receipt */}
      <div className="p-5 rounded-2xl border border-border bg-card space-y-3 shadow-sm">
        <h3 className="text-sm font-bold text-foreground border-b border-border pb-2 flex items-center gap-1.5">
          <Utensils className="w-4 h-4 text-amber-500" /> Items in this Order
        </h3>

        <div className="space-y-2.5 divide-y divide-border/60">
          {order.items.map((i) => (
            <div key={i.id} className="pt-2 first:pt-0 flex items-start justify-between text-xs">
              <div className="space-y-0.5">
                <p className="font-semibold text-foreground">
                  {i.quantity}x {i.name}
                </p>
                {i.selectedModifiers && i.selectedModifiers.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {i.selectedModifiers.map((m) => m.optionName).join(", ")}
                  </p>
                )}
                {i.notes && (
                  <p className="text-[10px] text-amber-500 italic">Note: {i.notes}</p>
                )}
              </div>
              <span className="font-medium text-foreground">
                {formatPesewas(i.totalPricePesewas)}
              </span>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-border space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatPesewas(order.subtotalPesewas)}</span>
          </div>
          {order.taxPesewas > 0 && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Taxes</span>
              <span>{formatPesewas(order.taxPesewas)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm font-bold text-foreground pt-1 border-t border-border">
            <span>Total</span>
            <span className="text-amber-500">{formatPesewas(order.totalPesewas)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
