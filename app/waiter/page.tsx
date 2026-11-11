"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { ROLES, UserRole } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import {
  Utensils,
  CheckCircle2,
  Clock,
  Send,
  RefreshCw,
  Search,
  LogOut,
  ShieldAlert,
  Flame,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";

interface WaiterOrderItem {
  id: string;
  quantity: number;
  station: "KITCHEN" | "BAR";
  notes?: string | null;
  selectedModifiersSnapshot?: Array<{
    optionName: string;
    priceDeltaPesewas: number;
  }>;
  item: {
    name: string;
    prepStation: "KITCHEN" | "BAR";
  };
}

interface WaiterOrder {
  id: string;
  orderNumber: string;
  type: "DINE_IN" | "ROOM_SERVICE" | "PICKUP" | "WAITER";
  status: "PLACED" | "ACCEPTED" | "PREPARING" | "READY" | "SERVED" | "COMPLETED";
  placedAt: string;
  readyAt?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  table?: { label: string } | null;
  reservation?: {
    reference: string;
    rooms?: Array<{ room?: { number: string } | null }>;
  } | null;
  items: WaiterOrderItem[];
}

export default function WaiterPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [orders, setOrders] = React.useState<WaiterOrder[]>([]);
  const [activeTab, setActiveTab] = React.useState<"READY" | "PREPARING" | "SERVED">("READY");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [servingId, setServingId] = React.useState<string | null>(null);
  const [isConnected, setIsConnected] = React.useState(true);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [wakeLockActive, setWakeLockActive] = React.useState(false);
  const [now, setNow] = React.useState<Date | null>(null);

  const prevReadyCountRef = React.useRef(0);

  // Clock & Wake Lock
  React.useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);

    let wakeSentinel: WakeLockSentinel | null = null;
    async function initWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          wakeSentinel = await navigator.wakeLock.request("screen");
          setWakeLockActive(true);
        }
      } catch {
        setWakeLockActive(false);
      }
    }
    void initWakeLock();

    return () => {
      clearInterval(clock);
      if (wakeSentinel) void wakeSentinel.release();
    };
  }, []);

  const refreshOrders = React.useCallback(async () => {
    try {
      const res = await fetch("/api/restaurant/waiter/orders");
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setOrders(json.data.orders || []);
          setIsConnected(true);
        }
      }
    } catch {
      setIsConnected(false);
    }
  }, []);

  // Fetch waiter orders every 5 seconds
  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/restaurant/waiter/orders");
        if (!res.ok) {
          if (res.status === 401) {
            router.replace("/login?redirect=/waiter");
            return;
          }
          throw new Error("Failed to load waiter orders");
        }

        const json = await res.json();
        if (!cancelled && json.success) {
          const fetched: WaiterOrder[] = json.data.orders || [];

          // Chime if ready tickets increased
          const readyCount = fetched.filter((o) => o.status === "READY").length;
          if (prevReadyCountRef.current > 0 && readyCount > prevReadyCountRef.current && soundEnabled) {
            try {
              const AudioContextClass =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
              if (AudioContextClass) {
                const ctx = new AudioContextClass();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.frequency.setValueAtTime(784, ctx.currentTime); // G5
                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.35);
              }
            } catch {
              // quiet
            }
          }
          prevReadyCountRef.current = readyCount;

          setOrders(fetched);
          setIsConnected(true);
        }
      } catch {
        if (!cancelled) {
          setIsConnected(false);
        }
      }
    }

    void load();
    const timer = setInterval(() => {
      void load();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [router, soundEnabled]);

  // Handle Mark Served
  const handleMarkServed = async (orderId: string) => {
    try {
      setServingId(orderId);
      const res = await fetch(`/api/restaurant/waiter/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SERVE" }),
      });

      if (res.ok) {
        await refreshOrders();
      }
    } catch {
      // quiet
    } finally {
      setServingId(null);
    }
  };

  // RBAC guard: WAITER, FRONT_DESK, MANAGER, OWNER_ADMIN
  const allowedRoles: UserRole[] = [ROLES.WAITER, ROLES.FRONT_DESK, ROLES.MANAGER, ROLES.OWNER_ADMIN];
  if (user && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-2" />
        <h1 className="text-2xl font-black">Access Restricted</h1>
        <p className="text-sm text-neutral-400 max-w-md">
          The Waiter Service screen is restricted to Waiters, Front Desk, and Management.
        </p>
        <Button
          variant="blackPill"
          className="bg-white text-black font-bold px-6 py-2.5"
          onClick={() => router.replace("/dashboard")}
        >
          Return to Dashboard
        </Button>
      </div>
    );
  }

  // Filter orders by active tab & search
  const filteredOrders = orders.filter((o) => {
    if (activeTab === "READY" && o.status !== "READY") return false;
    if (activeTab === "PREPARING" && o.status !== "PREPARING") return false;
    if (activeTab === "SERVED" && o.status !== "SERVED") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchOrder = o.orderNumber.toLowerCase().includes(q);
      const matchCustomer = o.customerName?.toLowerCase().includes(q);
      const matchTable = o.table?.label.toLowerCase().includes(q);
      const matchRoom = o.reservation?.rooms?.[0]?.room?.number?.toLowerCase().includes(q);
      return matchOrder || matchCustomer || matchTable || matchRoom;
    }
    return true;
  });

  const readyCount = orders.filter((o) => o.status === "READY").length;
  const prepCount = orders.filter((o) => o.status === "PREPARING").length;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans select-none pb-12">
      {/* Top Header */}
      <header className="h-16 bg-neutral-900 border-b border-neutral-800 px-4 sm:px-6 flex items-center justify-between shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-wide flex items-center gap-2">
              <span>WAITER FLOOR SERVICE</span>
              {readyCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-black text-xs font-black animate-pulse">
                  {readyCount} READY
                </span>
              )}
            </h1>
            <p className="text-[11px] text-neutral-400 font-mono">
              {now ? now.toLocaleTimeString() : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border text-xs font-bold transition-colors ${
              soundEnabled
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-neutral-800 border-neutral-700 text-neutral-500"
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Wake Lock */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
              wakeLockActive
                ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                : "bg-neutral-800 border-neutral-700 text-neutral-500"
            }`}
          >
            <Zap className="w-3 h-3" />
            <span>AWAKE</span>
          </div>

          {/* Live Sync Dot */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px]">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              }`}
            />
            <button
              type="button"
              onClick={() => void refreshOrders()}
              className="text-neutral-500 hover:text-white"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Filter Tabs & Search Bar */}
      <div className="p-4 max-w-5xl mx-auto w-full space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-neutral-900 p-1 rounded-2xl border border-neutral-800">
            <button
              type="button"
              onClick={() => setActiveTab("READY")}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-2 ${
                activeTab === "READY"
                  ? "bg-emerald-500 text-black shadow-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Ready for Delivery</span>
              <span className="w-5 h-5 rounded-full bg-black/20 text-xs flex items-center justify-center">
                {readyCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("PREPARING")}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-2 ${
                activeTab === "PREPARING"
                  ? "bg-amber-500 text-black shadow-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>In Kitchen</span>
              <span className="w-5 h-5 rounded-full bg-black/20 text-xs flex items-center justify-center">
                {prepCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("SERVED")}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${
                activeTab === "SERVED"
                  ? "bg-neutral-700 text-white shadow-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Served
            </button>
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
            <input
              type="text"
              placeholder="Search table, room, or order..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
        </div>

        {/* ORDER CARDS LIST */}
        <div className="space-y-3.5 pt-2">
          {filteredOrders.length === 0 ? (
            <div className="py-20 text-center text-neutral-500 rounded-3xl border border-dashed border-neutral-800 space-y-2">
              <Utensils className="w-8 h-8 mx-auto text-neutral-600 mb-2" />
              <p className="text-sm font-bold">No orders in this view</p>
              <p className="text-xs text-neutral-600">
                {activeTab === "READY"
                  ? "Kitchen is currently preparing tickets. Ready orders will appear here automatically."
                  : "No items match current filters."}
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              // Location / Destination display
              let destination = "Dine-In Table";
              let typeClass = "bg-blue-500/20 text-blue-400 border-blue-500/30";
              if (order.type === "DINE_IN" || order.type === "WAITER") {
                destination = order.table?.label ? `Table ${order.table.label}` : "Table";
              } else if (order.type === "ROOM_SERVICE") {
                const roomNum = order.reservation?.rooms?.[0]?.room?.number;
                destination = roomNum ? `Room ${roomNum}` : "Room Guest";
                typeClass = "bg-purple-500/20 text-purple-400 border-purple-500/30";
              } else if (order.type === "PICKUP") {
                destination = order.customerName ? `Pickup (${order.customerName})` : "Pickup";
                typeClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
              }

              // Time elapsed since placed
              const placedTime = new Date(order.placedAt).getTime();
              const currTime = now ? now.getTime() : placedTime;
              const elapsedMin = Math.floor(Math.max(0, currTime - placedTime) / 60000);

              const isReady = order.status === "READY";

              return (
                <div
                  key={order.id}
                  className={`bg-neutral-900 rounded-2xl border ${
                    isReady
                      ? "border-emerald-500/50 shadow-lg shadow-emerald-950/20"
                      : "border-neutral-800"
                  } p-5 space-y-4 transition-all`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl font-black text-white">#{order.orderNumber}</span>
                        <span
                          className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full border ${typeClass}`}
                        >
                          {destination}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-1 font-mono">
                        Placed {elapsedMin} min ago
                      </p>
                    </div>

                    {isReady && (
                      <span className="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-black animate-pulse flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> READY
                      </span>
                    )}
                  </div>

                  {/* Special Notes */}
                  {order.notes && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-xs text-amber-200 flex items-start gap-2">
                      <Flame className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="font-medium text-xs">{order.notes}</p>
                    </div>
                  )}

                  {/* Items list */}
                  <div className="space-y-2 border-t border-b border-neutral-800/80 py-3">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-start gap-3">
                        <span className="text-base font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg shrink-0">
                          {item.quantity}x
                        </span>
                        <div className="flex-1">
                          <span className="text-sm font-bold text-neutral-100">
                            {item.item.name}
                          </span>
                          {item.selectedModifiersSnapshot &&
                            item.selectedModifiersSnapshot.length > 0 && (
                              <div className="mt-0.5 flex flex-wrap gap-1.5">
                                {item.selectedModifiersSnapshot.map((mod, i) => (
                                  <span
                                    key={i}
                                    className="text-[11px] text-amber-300/90 font-medium bg-neutral-800 px-1.5 py-0.5 rounded"
                                  >
                                    +{mod.optionName}
                                  </span>
                                ))}
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Button: Mark Served */}
                  <div className="flex items-center justify-end gap-3 pt-1">
                    {isReady ? (
                      <Button
                        type="button"
                        size="lg"
                        disabled={servingId === order.id}
                        onClick={() => handleMarkServed(order.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm px-6 py-3 rounded-xl shadow-lg gap-2 active:scale-95 transition-all"
                      >
                        {servingId === order.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5" />
                        )}
                        <span>Mark Order Served</span>
                      </Button>
                    ) : (
                      <div className="text-xs text-neutral-500 italic">
                        {order.status === "SERVED"
                          ? "Order served to guest"
                          : "Preparing in kitchen"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
