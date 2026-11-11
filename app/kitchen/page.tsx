"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { ROLES, UserRole } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog-and-drawer";
import {
  Utensils,
  Wine,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Volume2,
  VolumeX,
  RefreshCw,
  Search,
  Eye,
  EyeOff,
  LogOut,
  ShieldAlert,
  Flame,
  Zap,
} from "lucide-react";

// Web Audio API synthesized kitchen chime (no external MP3 asset dependency)
function playKitchenChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // High clear chime: Note 1 (D5 - 587.33Hz) then Note 2 (A5 - 880Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.15);
    gain2.gain.setValueAtTime(0.3, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.6);
  } catch {
    // Audio autoplay restrictions or unsupported
  }
}

interface TicketItem {
  id: string;
  itemId: string;
  quantity: number;
  station: "KITCHEN" | "BAR";
  notes?: string | null;
  selectedModifiersSnapshot?: Array<{
    groupName: string;
    optionName: string;
    priceDeltaPesewas: number;
  }>;
  item: {
    id: string;
    name: string;
    description?: string | null;
    prepStation: "KITCHEN" | "BAR";
    isAvailable: boolean;
  };
}

interface KitchenTicket {
  id: string;
  orderNumber: string;
  type: "DINE_IN" | "ROOM_SERVICE" | "PICKUP" | "WAITER";
  status: "PLACED" | "ACCEPTED" | "PREPARING" | "READY";
  paymentStatus: string;
  placedAt: string;
  acceptedAt?: string | null;
  preparingAt?: string | null;
  readyAt?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  table?: { label: string } | null;
  reservation?: {
    reference: string;
    rooms?: Array<{ room?: { number: string } | null }>;
  } | null;
  items: TicketItem[];
}

interface MenuItem86 {
  id: string;
  name: string;
  prepStation: "KITCHEN" | "BAR";
  isAvailable: boolean;
  category?: { name: string } | null;
}

export default function KitchenPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6">
          <Utensils className="w-10 h-10 text-amber-500 animate-pulse mb-3" />
          <p className="text-sm font-semibold tracking-wider uppercase text-neutral-400">
            Initializing Kitchen Display...
          </p>
        </div>
      }
    >
      <KitchenDisplayContent />
    </React.Suspense>
  );
}

function KitchenDisplayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isOwner, isManager } = useAuth();

  // Query station from URL (?station=bar or ?station=kitchen)
  const stationQuery = (searchParams.get("station") || "KITCHEN").toUpperCase();
  const [stationFilter, setStationFilter] = React.useState<"ALL" | "KITCHEN" | "BAR">(
    stationQuery === "BAR" ? "BAR" : stationQuery === "ALL" ? "ALL" : "KITCHEN"
  );

  const [tickets, setTickets] = React.useState<KitchenTicket[]>([]);
  const [isConnected, setIsConnected] = React.useState(true);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [wakeLockActive, setWakeLockActive] = React.useState(false);

  // Settings for amber/red timers
  const [amberMinutes, setAmberMinutes] = React.useState(10);
  const [redMinutes, setRedMinutes] = React.useState(20);

  // Current clock time
  const [now, setNow] = React.useState<Date | null>(null);

  // 86 List panel state
  const [eightySixOpen, setEightySixOpen] = React.useState(false);
  const [menuItems, setMenuItems] = React.useState<MenuItem86[]>([]);
  const [eightySixSearch, setEightySixSearch] = React.useState("");
  const [updatingItemId, setUpdatingItemId] = React.useState<string | null>(null);

  // Cancellation modal state
  const [cancelModalOpen, setCancelModalOpen] = React.useState(false);
  const [ticketToCancel, setTicketToCancel] = React.useState<KitchenTicket | null>(null);
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelling, setCancelling] = React.useState(false);

  // Action in-flight tracker
  const [actionTicketId, setActionTicketId] = React.useState<string | null>(null);

  // Reference to track previous ticket IDs to trigger sound alert on new arrivals
  const previousTicketIdsRef = React.useRef<Set<string>>(new Set());

  // 1. Initialize clock & Screen Wake Lock API
  React.useEffect(() => {
    const clockTimer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    // Request Wake Lock to prevent screen sleep on tablets/TVs
    let wakeLockSentinel: WakeLockSentinel | null = null;
    async function requestWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          wakeLockSentinel = await navigator.wakeLock.request("screen");
          setWakeLockActive(true);
          wakeLockSentinel.addEventListener("release", () => {
            setWakeLockActive(false);
          });
        }
      } catch {
        setWakeLockActive(false);
      }
    }

    void requestWakeLock();

    // Re-acquire lock on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(clockTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockSentinel) {
        void wakeLockSentinel.release();
      }
    };
  }, []);

  // 2. Polling loop every 5 seconds (modular for SSE swap)
  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const stationParam = stationFilter === "ALL" ? "" : `?station=${stationFilter}`;
        const res = await fetch(`/api/restaurant/kitchen/orders${stationParam}`);

        if (!res.ok) {
          if (res.status === 401) {
            router.replace("/login?redirect=/kitchen");
            return;
          }
          throw new Error("Failed to load KDS tickets");
        }

        const json = await res.json();
        if (!cancelled && json.success) {
          const fetchedTickets: KitchenTicket[] = json.data.orders || [];

          // Check for new tickets to trigger audio chime
          if (previousTicketIdsRef.current.size > 0) {
            const hasNewTickets = fetchedTickets.some(
              (t) =>
                (t.status === "PLACED" || t.status === "ACCEPTED") &&
                !previousTicketIdsRef.current.has(t.id)
            );
            if (hasNewTickets && soundEnabled) {
              playKitchenChime();
            }
          }
          previousTicketIdsRef.current = new Set(fetchedTickets.map((t) => t.id));

          setTickets(fetchedTickets);
          if (json.data.settings) {
            if (json.data.settings.kdsAmberMinutes) {
              setAmberMinutes(json.data.settings.kdsAmberMinutes);
            }
            if (json.data.settings.kdsRedMinutes) {
              setRedMinutes(json.data.settings.kdsRedMinutes);
            }
          }
          setIsConnected(true);
        }
      } catch {
        if (!cancelled) {
          setIsConnected(false);
        }
      }
    }

    void load();
    const interval = setInterval(() => {
      void load();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [stationFilter, soundEnabled, router]);

  const refreshOrders = React.useCallback(async () => {
    try {
      const stationParam = stationFilter === "ALL" ? "" : `?station=${stationFilter}`;
      const res = await fetch(`/api/restaurant/kitchen/orders${stationParam}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setTickets(json.data.orders || []);
          setIsConnected(true);
        }
      }
    } catch {
      setIsConnected(false);
    }
  }, [stationFilter]);

  // 4. Fetch menu items for 86 list
  const fetchMenuItems = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/restaurant/items");
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setMenuItems(json.data.items || []);
        }
      }
    } catch {
      // quiet
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      try {
        const res = await fetch("/api/admin/restaurant/items");
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && json.success) {
            setMenuItems(json.data.items || []);
          }
        }
      } catch {
        // quiet
      }
    }
    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  // Toggle 86 status for an item
  const handleToggle86 = async (item: MenuItem86) => {
    try {
      setUpdatingItemId(item.id);
      const nextAvailable = !item.isAvailable;
      const res = await fetch("/api/admin/restaurant/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          isAvailable: nextAvailable,
        }),
      });

      if (res.ok) {
        setMenuItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, isAvailable: nextAvailable } : i))
        );
      }
    } catch {
      // quiet
    } finally {
      setUpdatingItemId(null);
    }
  };

  // 5. Ticket Action Handlers
  const handleStartPrep = async (ticket: KitchenTicket) => {
    try {
      setActionTicketId(ticket.id);
      const res = await fetch(`/api/restaurant/kitchen/orders/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "START" }),
      });

      if (res.ok) {
        await refreshOrders();
      }
    } catch {
      // quiet
    } finally {
      setActionTicketId(null);
    }
  };

  const handleMarkReady = async (ticket: KitchenTicket) => {
    try {
      setActionTicketId(ticket.id);
      const res = await fetch(`/api/restaurant/kitchen/orders/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "READY" }),
      });

      if (res.ok) {
        await refreshOrders();
      }
    } catch {
      // quiet
    } finally {
      setActionTicketId(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!ticketToCancel || !cancelReason.trim()) return;
    try {
      setCancelling(true);
      const res = await fetch(`/api/restaurant/kitchen/orders/${ticketToCancel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CANCEL",
          reason: cancelReason.trim(),
        }),
      });

      if (res.ok) {
        setCancelModalOpen(false);
        setTicketToCancel(null);
        setCancelReason("");
        await refreshOrders();
      }
    } catch {
      // quiet
    } finally {
      setCancelling(false);
    }
  };

  // Group tickets into 3 columns: New, Preparing, Ready
  const newTickets = tickets.filter(
    (t) => t.status === "PLACED" || t.status === "ACCEPTED"
  );
  const preparingTickets = tickets.filter((t) => t.status === "PREPARING");
  const readyTickets = tickets.filter((t) => t.status === "READY");

  // Filter 86 list by search
  const filtered86Items = menuItems.filter((i) =>
    i.name.toLowerCase().includes(eightySixSearch.toLowerCase())
  );
  const eightySixCount = menuItems.filter((i) => !i.isAvailable).length;

  // Authorization Guard: Only KITCHEN, MANAGER, OWNER_ADMIN
  const allowedRoles: UserRole[] = [ROLES.KITCHEN, ROLES.MANAGER, ROLES.OWNER_ADMIN];
  if (user && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-2" />
        <h1 className="text-2xl font-black tracking-tight">Access Restricted</h1>
        <p className="text-sm text-neutral-400 max-w-md">
          The Kitchen Display System is restricted to Kitchen, Bar, and Management staff.
        </p>
        <Button
          variant="blackPill"
          className="bg-white text-black hover:bg-neutral-200 font-bold px-6 py-2.5"
          onClick={() => router.replace("/dashboard")}
        >
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col select-none overflow-x-hidden font-sans">
      {/* KDS TOP CONTROL BAR */}
      <header className="h-16 bg-neutral-900 border-b border-neutral-800 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-lg">
        {/* Left: Branding & Station Selector */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              {stationFilter === "BAR" ? (
                <Wine className="w-5 h-5 text-purple-400" />
              ) : (
                <Utensils className="w-5 h-5 text-amber-400" />
              )}
            </div>
            <div>
              <div className="text-base font-black tracking-wide flex items-center gap-2">
                <span>AURA KDS</span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                  {stationFilter} SCREEN
                </span>
              </div>
              <div className="text-[11px] text-neutral-400 font-mono">
                {now ? now.toLocaleTimeString() : "00:00:00"}
              </div>
            </div>
          </div>

          {/* Station Switcher Tabs */}
          <div className="hidden sm:flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
            <button
              type="button"
              onClick={() => setStationFilter("KITCHEN")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                stationFilter === "KITCHEN"
                  ? "bg-amber-500 text-black shadow"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Utensils className="w-3.5 h-3.5" /> Kitchen
            </button>
            <button
              type="button"
              onClick={() => setStationFilter("BAR")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                stationFilter === "BAR"
                  ? "bg-purple-600 text-white shadow"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Wine className="w-3.5 h-3.5" /> Bar
            </button>
            <button
              type="button"
              onClick={() => setStationFilter("ALL")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                stationFilter === "ALL"
                  ? "bg-neutral-700 text-white shadow"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              All
            </button>
          </div>
        </div>

        {/* Right: Controls, 86 List, Audio, Wake Lock, Status */}
        <div className="flex items-center gap-3">
          {/* 86 List Quick Toggle */}
          <button
            type="button"
            onClick={() => {
              setEightySixOpen(true);
              void fetchMenuItems();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs font-bold text-neutral-200 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>86 List</span>
            {eightySixCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {eightySixCount}
              </span>
            )}
          </button>

          {/* Sound Alert Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) playKitchenChime();
            }}
            title={soundEnabled ? "Audio chime ON" : "Audio chime MUTED"}
            className={`p-2 rounded-xl border text-xs font-bold transition-colors ${
              soundEnabled
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-neutral-800 border-neutral-700 text-neutral-500"
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>

          {/* Wake Lock Status Indicator */}
          <div
            title={
              wakeLockActive
                ? "Screen Wake Lock active (prevents tablet sleep)"
                : "Wake Lock inactive"
            }
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
              wakeLockActive
                ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                : "bg-neutral-800 border-neutral-700 text-neutral-500"
            }`}
          >
            <Zap className="w-3 h-3" />
            <span>AWAKE</span>
          </div>

          {/* Live Sync Connection Dot */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px]">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500 animate-ping"
              }`}
            />
            <span className="hidden sm:inline font-mono text-neutral-400">
              {isConnected ? "LIVE" : "OFFLINE"}
            </span>
            <button
              type="button"
              onClick={() => void refreshOrders()}
              className="text-neutral-500 hover:text-white"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          {/* Navigation / Exit */}
          {user && (
            <button
              type="button"
              onClick={() => router.push(user.role === ROLES.KITCHEN ? "/login" : "/dashboard")}
              title="Exit KDS"
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* THREE-COLUMN KDS BOARD */}
      <main className="flex-1 p-4 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-y-auto">
        {/* COLUMN 1: NEW / ACCEPTED */}
        <div className="flex flex-col bg-neutral-900/50 rounded-2xl border border-neutral-800 overflow-hidden">
          <div className="p-3.5 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              <h2 className="text-sm font-black uppercase tracking-wider text-neutral-200">
                New Tickets
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-black">
              {newTickets.length}
            </span>
          </div>

          <div className="flex-1 p-3 space-y-3.5 overflow-y-auto max-h-[calc(100vh-140px)]">
            {newTickets.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-neutral-600 text-xs italic">
                No new orders waiting
              </div>
            ) : (
              newTickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  stationFilter={stationFilter}
                  now={now}
                  amberMinutes={amberMinutes}
                  redMinutes={redMinutes}
                  onAction={() => handleStartPrep(ticket)}
                  actionLabel="Start Prep"
                  actionColor="bg-blue-600 hover:bg-blue-500 text-white"
                  actionLoading={actionTicketId === ticket.id}
                  canCancel={isOwner || isManager}
                  onCancel={() => {
                    setTicketToCancel(ticket);
                    setCancelModalOpen(true);
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* COLUMN 2: PREPARING */}
        <div className="flex flex-col bg-neutral-900/50 rounded-2xl border border-neutral-800 overflow-hidden">
          <div className="p-3.5 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <h2 className="text-sm font-black uppercase tracking-wider text-neutral-200">
                In Kitchen / Preparing
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-black">
              {preparingTickets.length}
            </span>
          </div>

          <div className="flex-1 p-3 space-y-3.5 overflow-y-auto max-h-[calc(100vh-140px)]">
            {preparingTickets.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-neutral-600 text-xs italic">
                No orders currently in prep
              </div>
            ) : (
              preparingTickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  stationFilter={stationFilter}
                  now={now}
                  amberMinutes={amberMinutes}
                  redMinutes={redMinutes}
                  onAction={() => handleMarkReady(ticket)}
                  actionLabel="Mark Ready"
                  actionColor="bg-emerald-600 hover:bg-emerald-500 text-white"
                  actionLoading={actionTicketId === ticket.id}
                  canCancel={isOwner || isManager}
                  onCancel={() => {
                    setTicketToCancel(ticket);
                    setCancelModalOpen(true);
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* COLUMN 3: READY */}
        <div className="flex flex-col bg-neutral-900/50 rounded-2xl border border-neutral-800 overflow-hidden">
          <div className="p-3.5 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <h2 className="text-sm font-black uppercase tracking-wider text-neutral-200">
                Ready for Pickup / Waiter
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-black">
              {readyTickets.length}
            </span>
          </div>

          <div className="flex-1 p-3 space-y-3.5 overflow-y-auto max-h-[calc(100vh-140px)]">
            {readyTickets.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-neutral-600 text-xs italic">
                No ready orders waiting for pickup
              </div>
            ) : (
              readyTickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  stationFilter={stationFilter}
                  now={now}
                  amberMinutes={amberMinutes}
                  redMinutes={redMinutes}
                  isReadyColumn
                  canCancel={isOwner || isManager}
                  onCancel={() => {
                    setTicketToCancel(ticket);
                    setCancelModalOpen(true);
                  }}
                />
              ))
            )}
          </div>
        </div>
      </main>

      {/* 86 LIST SLIDE-OVER / MODAL */}
      <Dialog
        open={eightySixOpen}
        onOpenChange={setEightySixOpen}
        title="86 List — Menu Availability Toggle"
      >
        <div className="p-6 space-y-4 max-h-[80vh] flex flex-col">
          <p className="text-xs text-muted-foreground">
            Toggle items on or off when ingredients run out. Changes update the public online menu instantly.
          </p>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search dishes or drinks..."
              value={eightySixSearch}
              onChange={(e) => setEightySixSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border space-y-1">
            {filtered86Items.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground italic">
                No items match search.
              </p>
            ) : (
              filtered86Items.map((item) => (
                <div
                  key={item.id}
                  className="py-3 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-sm font-bold flex items-center gap-2">
                      <span>{item.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {item.prepStation}
                      </span>
                    </div>
                    {item.category?.name && (
                      <p className="text-xs text-muted-foreground">{item.category.name}</p>
                    )}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={updatingItemId === item.id}
                    onClick={() => handleToggle86(item)}
                    className={`gap-1.5 font-bold text-xs ${
                      item.isAvailable
                        ? "border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                        : "border-rose-500 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20"
                    }`}
                  >
                    {item.isAvailable ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Available (86 It)</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Sold Out (Enable)</span>
                      </>
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </Dialog>

      {/* CANCELLATION REASON MODAL (Manager only) */}
      <Dialog
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        title="Cancel Restaurant Ticket (Manager Override)"
      >
        <div className="p-6 space-y-4">
          <p className="text-xs text-muted-foreground">
            Cancelling ticket #{ticketToCancel?.orderNumber}. A mandatory reason must be logged for audit records.
          </p>

          <div>
            <label className="block text-xs font-bold uppercase mb-1">
              Cancellation Reason *
            </label>
            <Input
              type="text"
              placeholder="e.g. Guest changed mind, Out of red snapper, Spilled in prep"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelModalOpen(false)}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="blackPill"
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold"
              disabled={!cancelReason.trim() || cancelling}
              onClick={handleConfirmCancel}
            >
              {cancelling ? "Cancelling..." : "Confirm Cancellation"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

/**
 * High-Contrast Large Touch Ticket Card for KDS
 */
function TicketCard({
  ticket,
  stationFilter,
  now,
  amberMinutes,
  redMinutes,
  isReadyColumn = false,
  onAction,
  actionLabel,
  actionColor,
  actionLoading = false,
  canCancel = false,
  onCancel,
}: {
  ticket: KitchenTicket;
  stationFilter: "ALL" | "KITCHEN" | "BAR";
  now: Date | null;
  amberMinutes: number;
  redMinutes: number;
  isReadyColumn?: boolean;
  onAction?: () => void;
  actionLabel?: string;
  actionColor?: string;
  actionLoading?: boolean;
  canCancel?: boolean;
  onCancel?: () => void;
}) {
  // Compute elapsed minutes since placedAt
  const placedTime = new Date(ticket.placedAt).getTime();
  const currentTime = now ? now.getTime() : placedTime;
  const elapsedSeconds = Math.max(0, Math.floor((currentTime - placedTime) / 1000));
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const remainingSeconds = elapsedSeconds % 60;
  const timeStr = `${elapsedMinutes}:${remainingSeconds.toString().padStart(2, "0")}`;

  // Timer alert color
  let timerBadgeColor = "bg-neutral-800 text-neutral-300 border-neutral-700";
  let cardBorderColor = "border-neutral-800";

  if (elapsedMinutes >= redMinutes) {
    timerBadgeColor = "bg-rose-500/20 text-rose-400 border-rose-500/50 animate-pulse";
    cardBorderColor = "border-rose-500/60 shadow-lg shadow-rose-950/40";
  } else if (elapsedMinutes >= amberMinutes) {
    timerBadgeColor = "bg-amber-500/20 text-amber-400 border-amber-500/50";
    cardBorderColor = "border-amber-500/50 shadow-md shadow-amber-950/30";
  }

  // Type badge label & style
  let typeLabel = "DINE-IN";
  let typeBadgeClass = "bg-blue-500/20 text-blue-400 border-blue-500/30";
  let destinationText = ticket.table?.label ? `Table ${ticket.table.label}` : "Table";

  if (ticket.type === "ROOM_SERVICE") {
    typeLabel = "ROOM SERVICE";
    typeBadgeClass = "bg-purple-500/20 text-purple-400 border-purple-500/30";
    const roomNum = ticket.reservation?.rooms?.[0]?.room?.number;
    destinationText = roomNum ? `Room ${roomNum}` : "Room Guest";
  } else if (ticket.type === "PICKUP") {
    typeLabel = "PICKUP";
    typeBadgeClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    destinationText = ticket.customerName || "Takeout";
  } else if (ticket.type === "WAITER") {
    typeLabel = "WAITER";
    typeBadgeClass = "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
    destinationText = ticket.table?.label ? `Table ${ticket.table.label}` : "Floor";
  }

  // Filter items if specific station requested
  const visibleItems =
    stationFilter === "ALL"
      ? ticket.items
      : ticket.items.filter((i) => i.station === stationFilter);

  return (
    <div
      className={`bg-neutral-900 rounded-2xl border ${cardBorderColor} p-4 space-y-3.5 transition-all shadow-md`}
    >
      {/* TICKET HEADER: Order Number, Type Badge, Timer */}
      <div className="flex items-start justify-between gap-2 border-b border-neutral-800 pb-3">
        <div>
          <div className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            <span>#{ticket.orderNumber}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${typeBadgeClass}`}
            >
              {typeLabel}
            </span>
            <span className="text-xs font-bold text-neutral-300">{destinationText}</span>
          </div>
        </div>

        {/* Live Timer */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono font-black text-sm ${timerBadgeColor}`}
        >
          <Clock className="w-4 h-4" />
          <span>{timeStr}</span>
        </div>
      </div>

      {/* SPECIAL NOTES CALLOUT (if customer provided notes) */}
      {ticket.notes && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-xs text-amber-200 flex items-start gap-2">
          <Flame className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase tracking-wider text-[10px] block text-amber-400">
              Special Instruction:
            </span>
            <p className="font-medium text-xs">{ticket.notes}</p>
          </div>
        </div>
      )}

      {/* ITEMS LIST */}
      <div className="space-y-3 divide-y divide-neutral-800/80">
        {visibleItems.map((item) => (
          <div key={item.id} className="pt-2.5 first:pt-0">
            <div className="flex items-start gap-3">
              <span className="text-lg font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg shrink-0">
                {item.quantity}x
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-neutral-100 flex items-center justify-between gap-2">
                  <span className="leading-snug">{item.item.name}</span>
                  {stationFilter === "ALL" && (
                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700 shrink-0">
                      {item.station}
                    </span>
                  )}
                </div>

                {/* Selected Modifiers */}
                {item.selectedModifiersSnapshot && item.selectedModifiersSnapshot.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {item.selectedModifiersSnapshot.map((mod, idx) => (
                      <div
                        key={idx}
                        className="text-xs text-amber-300/90 font-medium flex items-center gap-1.5"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span>{mod.optionName}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Item-specific Notes */}
                {item.notes && (
                  <p className="text-xs text-neutral-400 italic mt-0.5">
                    Note: {item.notes}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* TICKET ACTION FOOTER */}
      <div className="pt-2 border-t border-neutral-800 flex items-center justify-between gap-2">
        {canCancel && (
          <button
            type="button"
            onClick={onCancel}
            title="Cancel ticket (Manager)"
            className="text-xs text-neutral-500 hover:text-rose-400 font-bold px-2.5 py-2 rounded-xl hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {onAction && actionLabel && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={onAction}
              className={`px-5 py-2.5 rounded-xl text-sm font-black tracking-wide shadow-lg transition-transform active:scale-95 flex items-center gap-2 ${actionColor}`}
            >
              {actionLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>{actionLabel}</span>
            </button>
          )}

          {isReadyColumn && (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Ready for Floor</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
