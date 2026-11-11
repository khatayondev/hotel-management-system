"use client";

import * as React from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusChip, StatusType } from "@/components/ui/status-chip";
import { LineChart, CircularProgressRing } from "@/components/ui/charts";
import { DashedAddCard } from "@/components/ui/checklist-and-add-card";
import {
  Skeleton,
  EmptyState,
  ViewToggle,
  SortDropdown,
} from "@/components/ui/controls";
import { ContextMenuPopover, Dialog } from "@/components/ui/dialog-and-drawer";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Bell,
  MoreVertical,
  Scissors,
  Check,
  AlertCircle,
  ExternalLink,
  CreditCard,
  BedDouble,
  Hotel,
  LogIn,
  LogOut,
  Sparkles,
  Users,
} from "lucide-react";
import { formatPesewas } from "@/lib/money";
import { cn } from "@/lib/utils";
import { OwnerOnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { FrontDeskTabletBoard } from "@/components/dashboard/front-desk-tablet-board";
import { useSmartPolling, triggerGlobalDataSync } from "@/hooks/use-smart-polling";
import { LiveSyncIndicator } from "@/components/ui/live-sync-indicator";

interface DashboardData {
  user: {
    firstName: string;
    fullName: string;
    role: string;
    hasViewAll: boolean;
  };
  overallInfo: {
    totalCompletedBookings: number;
    pendingPaymentsCount: number;
    pendingPaymentsPesewas: number;
    todayStats: {
      todayBookingsCount: number;
      todayPendingCount: number;
      todayCompletedCount: number;
    };
  };
  bookingStats?: {
    total: number;
    confirmed: number;
    checkedIn: number;
    completed: number;
    cancelled: number;
    pendingPayment: number;
    noShow: number;
  };
  weeklyProgress: {
    day: string;
    current: number;
    previous: number;
    isToday?: boolean;
  }[];
  monthProgress: {
    currentRevenuePesewas: number;
    targetRevenuePesewas: number;
    percentOfTarget: number;
    percentChangeVsLastMonth: number;
  };
  todayChecklist: {
    id: string;
    reference: string;
    customerName: string;
    customerPhone: string;
    serviceName: string;
    timeFormatted: string;
    staffName: string;
    status: string;
    completed: boolean;
    totalPesewas: number;
    amountPaidPesewas: number;
  }[];
  pendingPayments: {
    id: string;
    reference: string;
    customerName: string;
    customerPhone: string;
    serviceName: string;
    amountPendingPesewas: number;
    totalPesewas: number;
    depositRequiredPesewas: number;
    timeFormatted: string;
    staffName: string;
    status: string;
  }[];
  latestBookings: {
    id: string;
    reference: string;
    customerName: string;
    customerPhone: string;
    serviceName: string;
    categoryName: string;
    staffName: string;
    startUtc: string;
    timeFormatted: string;
    totalPesewas: number;
    amountPaidPesewas: number;
    status: string;
    source: string;
  }[];
}

export default function DashboardOverviewPage() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [hotelKpis, setHotelKpis] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notification, setNotification] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  // Widget 6 controls (Latest Bookings)
  const [bookingsView, setBookingsView] = React.useState<"grid" | "list">("grid");
  const [bookingsSort, setBookingsSort] = React.useState("recent");

  // Context menu state for pending payments
  const [activeContextMenuId, setActiveContextMenuId] = React.useState<string | null>(null);

  // Download report dialog state
  const [reportModalOpen, setReportModalOpen] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);

  // Fetch live dashboard telemetry
  const loadDashboard = React.useCallback(async (isSilent = true) => {
    try {
      const res = await fetch("/api/dashboard/overview");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      } else if (res.status === 401) {
        if (typeof window !== "undefined") {
          try {
            document.cookie = "aura_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
          } catch {}
          window.location.href = "/login?redirect=/dashboard";
        }
      } else if (!isSilent) {
        setNotification({ type: "error", message: "Failed to load dashboard metrics." });
      }
    } catch {
      if (!isSilent) {
        setNotification({ type: "error", message: "Network error loading dashboard telemetry." });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load on mount
  React.useEffect(() => {
    loadDashboard(false);
    fetch("/api/admin/hotel/kpis")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.kpis) {
          setHotelKpis(json.data.kpis);
        }
      })
      .catch(() => {});
  }, [loadDashboard]);

  // Smart SWR Polling (1 min interval + focus revalidation + visibility pause)
  const { isRefreshing, lastRefreshedAt, refresh } = useSmartPolling(
    () => loadDashboard(true),
    {
      intervalMs: 60000,
      syncTopic: "overview",
    }
  );

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Toggle checklist appointment completion
  const handleToggleComplete = async (bookingId: string) => {
    if (!data) return;

    // Optimistic toggle
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        todayChecklist: prev.todayChecklist.map((item) =>
          item.id === bookingId ? { ...item, completed: !item.completed } : item
        ),
      };
    });

    try {
      const res = await fetch(`/api/dashboard/appointments/${bookingId}/toggle-complete`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        showNotification("error", json.error?.message || "Failed to update appointment status.");
        loadDashboard();
      } else {
        showNotification("success", json.data.message);
        triggerGlobalDataSync("all");
      }
    } catch {
      showNotification("error", "Network error updating appointment status.");
      loadDashboard();
    }
  };

  // Send payment reminder SMS
  const handleSendReminder = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/dashboard/appointments/${bookingId}/remind`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        showNotification("error", json.error?.message || "Failed to dispatch payment reminder.");
      } else {
        showNotification("success", json.data.message);
      }
    } catch {
      showNotification("error", "Network error dispatching reminder.");
    }
  };

  // Handle Download Monthly Report
  const handleDownloadReport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/admin/reports?export=true");
      if (res.ok) {
        showNotification("success", "Monthly financial & operations report exported successfully.");
        setReportModalOpen(false);
      } else {
        const json = await res.json();
        showNotification("error", json.error?.message || "Insufficient permission to export reports.");
      }
    } catch {
      showNotification("error", "Error exporting report.");
    } finally {
      setIsExporting(false);
    }
  };

  // Helper mapping booking status to status chip
  const getStatusChipProps = (status: string): { status: StatusType; label: string } => {
    switch (status) {
      case "CONFIRMED":
        return { status: "green", label: "Confirmed" };
      case "COMPLETED":
        return { status: "grey", label: "Completed" };
      case "PENDING_PAYMENT":
        return { status: "amber", label: "Pending Payment" };
      case "CHECKED_IN":
        return { status: "green", label: "Checked In" };
      case "CANCELLED":
        return { status: "red", label: "Cancelled" };
      default:
        return { status: "grey", label: status };
    }
  };

  // Sorted latest bookings
  const sortedLatestBookings = React.useMemo(() => {
    if (!data) return [];
    const list = [...data.latestBookings];
    if (bookingsSort === "amount") {
      return list.sort((a, b) => b.totalPesewas - a.totalPesewas);
    }
    if (bookingsSort === "status") {
      return list.sort((a, b) => a.status.localeCompare(b.status));
    }
    return list; // default recent
  }, [data, bookingsSort]);

  return (
    <AppShell
      activePath="/dashboard"
      userName={data?.user?.firstName || "Studio"}
    >
      <div className="space-y-8 pb-16">
        {/* Toast Alert */}
        {notification && (
          <div
            className={cn(
              "p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-lg border animate-in fade-in duration-200",
              notification.type === "success"
                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                : "bg-rose-50 text-rose-900 border-rose-200"
            )}
          >
            <div className="flex items-center gap-2">
              {notification.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-current opacity-60 hover:opacity-100 cursor-pointer text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Owner Onboarding Checklist */}
        {data?.user?.role === "OWNER_ADMIN" && <OwnerOnboardingChecklist />}

        {/* Top Operations Header with Live Sync Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
              Hotel & Studio Operations
            </h1>
            <p className="text-xs text-zinc-500">
              Live room occupancy, daily arrivals/departures, and guest folios
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <LiveSyncIndicator
              isRefreshing={isRefreshing}
              lastRefreshedAt={lastRefreshedAt}
              onRefresh={refresh}
            />
          </div>
        </div>

        {/* HOTEL OPERATIONS COMMAND CENTER & KPIS */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Hotel className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-black text-zinc-950 tracking-tight">
                Hotel Operations KPIs
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link href="/dashboard/reservations">
                <Button variant="outline" size="sm" className="h-8 text-xs font-bold gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Reservations</span>
                </Button>
              </Link>
              <Link href="/dashboard/calendar">
                <Button variant="outline" size="sm" className="h-8 text-xs font-bold gap-1">
                  <BedDouble className="w-3.5 h-3.5" />
                  <span>Tape Chart</span>
                </Button>
              </Link>
              <Link href="/dashboard/housekeeping">
                <Button variant="outline" size="sm" className="h-8 text-xs font-bold gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Housekeeping</span>
                </Button>
              </Link>
              <Link href="/dashboard/rooms">
                <Button variant="outline" size="sm" className="h-8 text-xs font-bold gap-1">
                  <Hotel className="w-3.5 h-3.5" />
                  <span>Rooms Admin</span>
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* Arrivals Today */}
            <Link href="/dashboard/reservations?status=CONFIRMED" className="group">
              <div className="p-4 rounded-2xl bg-white border border-black/10 shadow-xs space-y-1 hover:border-emerald-400 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Arrivals Today
                  </span>
                  <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-emerald-900">
                  {hotelKpis ? hotelKpis.arrivalsTodayCount : "—"}
                </div>
              </div>
            </Link>

            {/* Departures Today */}
            <Link href="/dashboard/reservations?status=CHECKED_IN" className="group">
              <div className="p-4 rounded-2xl bg-white border border-black/10 shadow-xs space-y-1 hover:border-blue-400 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                    Departures Today
                  </span>
                  <LogOut className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="text-2xl font-black text-blue-900">
                  {hotelKpis ? hotelKpis.departuresTodayCount : "—"}
                </div>
              </div>
            </Link>

            {/* In-House Guests */}
            <Link href="/dashboard/reservations?status=CHECKED_IN" className="group">
              <div className="p-4 rounded-2xl bg-white border border-black/10 shadow-xs space-y-1 hover:border-purple-400 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                    In-House Guests
                  </span>
                  <Users className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <div className="text-2xl font-black text-purple-900">
                  {hotelKpis ? hotelKpis.inHouseGuestsCount : "—"}
                </div>
              </div>
            </Link>

            {/* Occupancy % */}
            <Link href="/dashboard/calendar" className="group">
              <div className="p-4 rounded-2xl bg-white border border-black/10 shadow-xs space-y-1 hover:border-amber-400 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                    Occupancy Rate
                  </span>
                  <span className="text-[10px] font-bold text-neutral-500">
                    {hotelKpis ? `${hotelKpis.occupiedRoomsCount}/${hotelKpis.operationalRoomsCount}` : ""}
                  </span>
                </div>
                <div className="text-2xl font-black text-amber-900">
                  {hotelKpis ? `${hotelKpis.occupancyPercent}%` : "—"}
                </div>
              </div>
            </Link>

            {/* Rooms By Status */}
            <Link href="/dashboard/housekeeping" className="group">
              <div className="p-3.5 rounded-2xl bg-white border border-black/10 shadow-xs space-y-1 hover:border-neutral-400 hover:shadow-sm transition-all">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 block">
                  Rooms By Status
                </span>
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <span className="text-emerald-700 font-bold" title="Clean">{hotelKpis?.roomsByStatus?.CLEAN ?? 0} Clean</span>
                  <span className="text-amber-700 font-bold" title="Dirty">{hotelKpis?.roomsByStatus?.DIRTY ?? 0} Dirty</span>
                  <span className="text-blue-700 font-bold" title="Occupied">{hotelKpis?.roomsByStatus?.OCCUPIED ?? 0} Occ</span>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* BOOKINGS STATCARDS (Moved from bookings page to maximize appointment calendar space) */}
        {!loading && !data ? (
          <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-200 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
            <h3 className="text-base font-bold text-zinc-900">Unable to load studio metrics</h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              We couldn&apos;t reach the live operational database or your session expired.
            </p>
            <div className="flex items-center justify-center gap-3 pt-1">
              <Button
                variant="blackPill"
                size="sm"
                onClick={() => {
                  setLoading(true);
                  loadDashboard(false);
                }}
                className="cursor-pointer font-bold"
              >
                Retry Loading
              </Button>
              <Link href="/login">
                <Button variant="outlinePill" size="sm" className="cursor-pointer font-bold">
                  Re-login to Studio
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Link href="/bookings" className="group">
            <div className="p-3.5 rounded-2xl bg-white border border-black/10 shadow-xs space-y-1 hover:border-black/30 hover:shadow-sm transition-all">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block group-hover:text-zinc-700">Total Bookings</span>
              <div className="text-xl font-black text-[#1E1E1E]">
                {loading ? "—" : (data?.bookingStats?.total ?? 0)}
              </div>
            </div>
          </Link>
          <Link href="/bookings?status=CONFIRMED" className="group">
            <div className="p-3.5 rounded-2xl bg-white border border-black/10 shadow-xs space-y-1 hover:border-emerald-400 hover:shadow-sm transition-all">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Confirmed</span>
              <div className="text-xl font-black text-emerald-900">
                {loading ? "—" : (data?.bookingStats?.confirmed ?? 0)}
              </div>
            </div>
          </Link>
          <Link href="/bookings?status=CHECKED_IN" className="group">
            <div className="p-3.5 rounded-2xl bg-white border border-black/10 shadow-xs space-y-1 hover:border-zinc-400 hover:shadow-sm transition-all">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 block">Checked In</span>
              <div className="text-xl font-black text-zinc-800">
                {loading ? "—" : (data?.bookingStats?.checkedIn ?? 0)}
              </div>
            </div>
          </Link>
          <Link href="/bookings?status=COMPLETED" className="group">
            <div className="p-3.5 rounded-2xl bg-white border border-black/10 shadow-xs space-y-1 hover:border-zinc-400 hover:shadow-sm transition-all">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-700 block">Completed</span>
              <div className="text-xl font-black text-[#1E1E1E]">
                {loading ? "—" : (data?.bookingStats?.completed ?? 0)}
              </div>
            </div>
          </Link>
          <Link href="/bookings?status=PENDING_PAYMENT" className="group">
            <div className="p-3.5 rounded-2xl bg-white border border-black/10 shadow-xs space-y-1 hover:border-amber-400 hover:shadow-sm transition-all">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Pending Pay</span>
              <div className="text-xl font-black text-amber-900">
                {loading ? "—" : (data?.bookingStats?.pendingPayment ?? 0)}
              </div>
            </div>
          </Link>
          <Link href="/bookings?status=CANCELLED" className="group">
            <div className="p-3.5 rounded-2xl bg-white border border-black/10 shadow-xs space-y-1 hover:border-rose-400 hover:shadow-sm transition-all">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">Cancelled</span>
              <div className="text-xl font-black text-rose-800">
                {loading ? "—" : (data?.bookingStats?.cancelled ?? 0)}
              </div>
            </div>
          </Link>
        </div>
        )}

        {/* FRONT DESK TABLET BOARD (NO STATCARDS, FUNCTIONAL OPERATIONAL COMMAND CENTER) */}
        {(loading || data) && (
          data?.user?.role === "FRONT_DESK" || data?.user?.role === "STAFF_RECEPTIONIST" ? (
          <FrontDeskTabletBoard
            todayChecklist={data?.todayChecklist || []}
            pendingPayments={data?.pendingPayments || []}
            latestBookings={data?.latestBookings || []}
            loading={loading}
            onToggleComplete={handleToggleComplete}
            onSendReminder={handleSendReminder}
            onRefresh={loadDashboard}
          />
        ) : (
          <>
            {/* =========================================================================
                ROW 1: OVERALL INFORMATION (1), WEEKLY PROGRESS (2), MONTH PROGRESS (3)
               ========================================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* WIDGET 1: DARK 'OVERALL INFORMATION' CARD (5 Cols) */}
          <div className="lg:col-span-5">
            {loading || !data ? (
              <Card variant="dark" className="p-6 h-full flex flex-col justify-between">
                <Skeleton className="h-6 w-1/3 bg-white/10" />
                <div className="space-y-3 my-4">
                  <Skeleton className="h-10 w-2/3 bg-white/10" />
                  <Skeleton className="h-4 w-1/2 bg-white/10" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Skeleton className="h-16 rounded-xl bg-white/10" />
                  <Skeleton className="h-16 rounded-xl bg-white/10" />
                  <Skeleton className="h-16 rounded-xl bg-white/10" />
                </div>
              </Card>
            ) : (
              <Card
                variant="dark"
                className="p-6 h-full flex flex-col justify-between shadow-xl relative overflow-hidden"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
                      Overall Information
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[10px] font-semibold text-white/80">
                      {data.user.hasViewAll ? "Studio Total" : "My Desk"}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                      {data.overallInfo.totalCompletedBookings}
                    </div>
                    <p className="text-xs text-white/70 mt-1 font-medium">
                      Completed client appointments to date
                    </p>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/10">
                    <span className="text-[11px] text-white/60 block">Pending Payments</span>
                    <div className="text-lg font-bold text-amber-300 mt-0.5">
                      {formatPesewas(data.overallInfo.pendingPaymentsPesewas)}
                    </div>
                    <span className="text-[10px] text-white/60">
                      Across {data.overallInfo.pendingPaymentsCount} outstanding appointments
                    </span>
                  </div>
                </div>

                {/* Three Mini Tiles */}
                <div className="grid grid-cols-3 gap-2 mt-6 pt-4 border-t border-white/10">
                  <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <span className="text-[10px] text-white/60 block">Today&apos;s</span>
                    <span className="text-sm font-extrabold text-white mt-0.5 block">
                      {data.overallInfo.todayStats.todayBookingsCount}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <span className="text-[10px] text-amber-400/80 block">Pending</span>
                    <span className="text-sm font-extrabold text-amber-300 mt-0.5 block">
                      {data.overallInfo.todayStats.todayPendingCount}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <span className="text-[10px] text-emerald-400/80 block">Completed</span>
                    <span className="text-sm font-extrabold text-emerald-300 mt-0.5 block">
                      {data.overallInfo.todayStats.todayCompletedCount}
                    </span>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* WIDGET 2: 'WEEKLY PROGRESS' LINE CHART (4 Cols) */}
          <div className="lg:col-span-4">
            {loading || !data ? (
              <Card variant="white" className="p-6 h-full flex flex-col justify-between">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-44 w-full my-4" />
                <Skeleton className="h-4 w-1/3" />
              </Card>
            ) : (
              <Card variant="white" className="p-6 h-full flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#1E1E1E]">Weekly Progress</h3>
                      <p className="text-[11px] text-[#71717A]">This week vs Last week</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#1E1E1E] text-white text-[10px] font-bold">
                      Today
                    </span>
                  </div>

                  <div className="mt-4">
                    <LineChart data={data.weeklyProgress} height={170} />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#F4F4F6] text-[11px] text-[#71717A]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#1E1E1E]" />
                    <span>This week</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#A1A1AA]" />
                    <span>Last week</span>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* WIDGET 3: 'MONTH PROGRESS' RING FOR ADMIN / 'TODAY APPOINTMENTS' FOR FRONT DESK (3 Cols) */}
          <div className="lg:col-span-3">
            {loading || !data ? (
              <Card variant="white" className="p-6 h-full flex flex-col justify-between items-center text-center">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="w-32 h-32 rounded-full my-4" />
                <Skeleton className="h-8 w-full rounded-full" />
              </Card>
            ) : data.user.role === "STAFF_RECEPTIONIST" ? (
              <Card variant="white" className="p-6 h-full flex flex-col justify-between items-center text-center shadow-sm">
                <div className="w-full">
                  <h3 className="text-sm font-bold text-[#1E1E1E]">Today&apos;s Appointments</h3>
                  <p className="text-[11px] text-[#71717A] mt-0.5">Front desk schedule tracking</p>

                  <div className="my-3 flex justify-center">
                    {(() => {
                      const todayTotal = data.overallInfo.todayStats.todayBookingsCount;
                      const todayDone = data.overallInfo.todayStats.todayCompletedCount;
                      const pct = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 100;
                      return (
                        <CircularProgressRing
                          progress={pct}
                          size={135}
                          strokeWidth={11}
                          label={todayTotal > 0 ? `${todayDone}/${todayTotal}` : "0"}
                          sublabel="completed"
                        />
                      );
                    })()}
                  </div>

                  <div className="text-xs">
                    <span className="font-extrabold text-[#1E1E1E]">
                      {data.overallInfo.todayStats.todayCompletedCount} of {data.overallInfo.todayStats.todayBookingsCount}
                    </span>
                    <span className="text-[#71717A]"> bookings finished</span>
                  </div>

                  <p className="text-[11px] font-semibold text-amber-600 mt-1">
                    {data.overallInfo.todayStats.todayPendingCount} awaiting payment / check-in
                  </p>
                </div>

                <Link href="/pos" className="w-full mt-4">
                  <Button
                    variant="blackPill"
                    size="sm"
                    className="w-full text-[11px] gap-1.5 cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Open POS Checkout</span>
                  </Button>
                </Link>
              </Card>
            ) : (
              <Card variant="white" className="p-6 h-full flex flex-col justify-between items-center text-center shadow-sm">
                <div className="w-full">
                  <h3 className="text-sm font-bold text-[#1E1E1E]">Month Progress</h3>
                  <p className="text-[11px] text-[#71717A] mt-0.5">Revenue target tracking</p>

                  <div className="my-3 flex justify-center">
                    <CircularProgressRing
                      progress={data.monthProgress.percentOfTarget}
                      size={135}
                      strokeWidth={11}
                      label={`${data.monthProgress.percentOfTarget}%`}
                      sublabel="of target"
                    />
                  </div>

                  <div className="text-xs">
                    <span className="font-extrabold text-[#1E1E1E]">
                      {formatPesewas(data.monthProgress.currentRevenuePesewas)}
                    </span>
                    <span className="text-[#71717A]">
                      {" "}/ {formatPesewas(data.monthProgress.targetRevenuePesewas)}
                    </span>
                  </div>

                  <p className="text-[11px] font-semibold text-emerald-600 mt-1">
                    {data.monthProgress.percentChangeVsLastMonth >= 0 ? "+" : ""}
                    {data.monthProgress.percentChangeVsLastMonth}% vs last month
                  </p>
                </div>

                <Button
                  variant="outlinePill"
                  size="sm"
                  className="w-full mt-4 text-[11px] gap-1.5 cursor-pointer"
                  onClick={() => setReportModalOpen(true)}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Report</span>
                </Button>
              </Card>
            )}
          </div>
        </div>

        {/* =========================================================================
            ROW 2: TODAY CHECKLIST CARD (4) & PENDING PAYMENTS CARDS (5)
           ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* WIDGET 4: 'TODAY' CHECKLIST CARD (5 Cols) */}
          <div className="lg:col-span-5">
            <Card variant="white" className="p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-[#F4F4F6]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#1E1E1E]" />
                  <h3 className="text-sm font-bold text-[#1E1E1E]">Today&apos;s Appointments</h3>
                </div>
                <span className="text-[11px] font-semibold text-[#71717A]">
                  {data?.todayChecklist.filter((c) => c.completed).length || 0} of{" "}
                  {data?.todayChecklist.length || 0} completed
                </span>
              </div>

              {loading || !data ? (
                <div className="space-y-3 py-4">
                  <Skeleton className="h-12 w-full rounded-2xl" />
                  <Skeleton className="h-12 w-full rounded-2xl" />
                  <Skeleton className="h-12 w-full rounded-2xl" />
                </div>
              ) : data.todayChecklist.length === 0 ? (
                <div className="py-8 text-center">
                  <EmptyState
                    title="No Appointments Today"
                    description="No client sessions currently booked for today. Create an appointment or walk-in sale."
                  />
                </div>
              ) : (
                <div className="divide-y divide-[#F4F4F6] mt-1">
                  {data.todayChecklist.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "py-3.5 px-2 flex items-start justify-between gap-3 transition-all rounded-xl",
                        item.completed ? "opacity-60 bg-[#FAFAFB]" : "hover:bg-[#F4F4F6]/60"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox circle */}
                        <button
                          type="button"
                          onClick={() => handleToggleComplete(item.id)}
                          className={cn(
                            "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-colors",
                            item.completed
                              ? "bg-[#1E1E1E] border-[#1E1E1E] text-white"
                              : "border-[#D4D4D8] hover:border-[#1E1E1E]"
                          )}
                          aria-label={`Toggle completion for ${item.customerName}`}
                        >
                          {item.completed && <Check className="w-3 h-3 stroke-[3]" />}
                        </button>

                        <div>
                          <p
                            className={cn(
                              "text-xs font-bold text-[#1E1E1E]",
                              item.completed && "line-through text-[#71717A]"
                            )}
                          >
                            {item.customerName}
                          </p>
                          <p className="text-[11px] text-[#71717A] mt-0.5 font-medium">
                            {item.serviceName}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-[#A1A1AA]">
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3" />
                              {item.timeFormatted}
                            </span>
                            {/* Solo direct shop mode: item.staffName omitted */}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <StatusChip
                          status={item.completed ? "grey" : "green"}
                          label={item.completed ? "Done" : "Ready"}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* WIDGET 5: 'PENDING PAYMENTS' CARDS & DASHED 'ADD BOOKING' (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#1E1E1E]">Pending Payments</h3>
                <p className="text-[11px] text-[#71717A]">
                  Outstanding client balances requiring deposit confirmation
                </p>
              </div>
              <span className="text-xs font-bold text-amber-600">
                {data ? `${data.pendingPayments.length} Pending` : ""}
              </span>
            </div>

            {loading || !data ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Skeleton className="h-36 rounded-[28px]" />
                <Skeleton className="h-36 rounded-[28px]" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.pendingPayments.map((p) => (
                  <Card
                    key={p.id}
                    variant="white"
                    className="p-5 flex flex-col justify-between hover:border-[#1E1E1E]/30 transition-all shadow-xs relative"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-[#1E1E1E]">{p.customerName}</h4>
                          <p className="text-[11px] text-[#71717A] mt-0.5">{p.serviceName}</p>
                        </div>

                        {/* Three dots context menu */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveContextMenuId(activeContextMenuId === p.id ? null : p.id)
                            }
                            className="p-1 rounded-full text-[#71717A] hover:text-[#1E1E1E] hover:bg-[#F4F4F6] cursor-pointer"
                            aria-label="Actions menu"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          <ContextMenuPopover
                            isOpen={activeContextMenuId === p.id}
                            onClose={() => setActiveContextMenuId(null)}
                            items={[
                              {
                                label: "Remind (SMS)",
                                icon: <Bell className="w-3.5 h-3.5" />,
                                onClick: () => handleSendReminder(p.id),
                              },
                              {
                                label: "Edit Booking",
                                icon: <Scissors className="w-3.5 h-3.5" />,
                                onClick: () => showNotification("success", `Opening editor for ${p.reference}`),
                              },
                              {
                                label: "Cancel Appointment",
                                danger: true,
                                onClick: () => showNotification("error", `Cancelled ${p.reference}`),
                              },
                            ]}
                          />
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-[#F4F4F6]">
                        <span className="text-[10px] text-[#71717A] uppercase font-bold tracking-wider">
                          Balance Due
                        </span>
                        <div className="text-base font-extrabold text-[#1E1E1E] mt-0.5">
                          {formatPesewas(p.amountPendingPesewas)}
                        </div>
                        <span className="text-[10px] text-[#A1A1AA] block mt-0.5 font-mono">
                          {p.reference} • {p.timeFormatted}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#F4F4F6]">
                      <Button
                        variant="blackPill"
                        size="sm"
                        className="flex-1 text-[11px] h-8 flex items-center justify-center gap-1.5 cursor-pointer"
                        onClick={() => handleSendReminder(p.id)}
                      >
                        <Bell className="w-3 h-3" />
                        <span>Send Reminder</span>
                      </Button>
                    </div>
                  </Card>
                ))}

                {/* Dashed 'Add booking' card */}
                <DashedAddCard
                  label="Add Booking"
                  description="Schedule client or register walk-in"
                  onClick={() => showNotification("success", "Launching booking scheduler...")}
                />
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            ROW 3: WIDGET 6 - 'LATEST BOOKINGS' DARK CARDS
           ========================================================================= */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-extrabold text-[#1E1E1E]">Latest Bookings</h3>
              <p className="text-xs text-[#71717A]">
                Recent studio reservations across hair, makeup, lash, and fashion rentals
              </p>
            </div>

            <div className="flex items-center gap-3">
              <ViewToggle view={bookingsView} onChange={setBookingsView} />
              <SortDropdown
                options={[
                  { id: "recent", label: "Most Recent" },
                  { id: "amount", label: "Highest Amount" },
                  { id: "status", label: "Status" },
                ]}
                selected={bookingsSort}
                onSelect={setBookingsSort}
              />
            </div>
          </div>

          {loading || !data ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Skeleton className="h-44 rounded-[28px] bg-[#1E1E1E]/20" />
              <Skeleton className="h-44 rounded-[28px] bg-[#1E1E1E]/20" />
              <Skeleton className="h-44 rounded-[28px] bg-[#1E1E1E]/20" />
            </div>
          ) : sortedLatestBookings.length === 0 ? (
            <EmptyState
              title="No Bookings Recorded"
              description="No appointments found for your role scope."
            />
          ) : bookingsView === "grid" ? (
            /* GRID VIEW OF DARK CARDS */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedLatestBookings.map((b) => {
                const chipProps = getStatusChipProps(b.status);
                return (
                  <Card
                    key={b.id}
                    variant="dark"
                    className="p-5 flex flex-col justify-between hover:border-white/30 transition-all shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                            {b.categoryName}
                          </span>
                          <h4 className="text-sm font-bold text-white mt-0.5 leading-snug">
                            {b.customerName}
                          </h4>
                          <p className="text-xs text-white/70 font-medium">{b.serviceName}</p>
                        </div>
                        <StatusChip status={chipProps.status} label={chipProps.label} />
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/10 space-y-1.5 text-xs text-white/70">
                        {/* Solo direct shop mode: Staff Stylist omitted
                        <div className="flex justify-between">
                          <span>Staff Stylist:</span>
                          <span className="text-white font-medium">{b.staffName}</span>
                        </div>
                        */}
                        <div className="flex justify-between">
                          <span>Time (Accra GMT):</span>
                          <span className="text-white font-mono">{b.timeFormatted}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Reference:</span>
                          <span className="text-white/60 font-mono text-[11px]">{b.reference}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-5 pt-3 border-t border-white/10">
                      <div>
                        <span className="text-[10px] text-white/50 block">Total</span>
                        <span className="text-sm font-black text-white">
                          {formatPesewas(b.totalPesewas)}
                        </span>
                      </div>
                      <Link href={`/appointments?ref=${b.reference}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-white/80 hover:text-white text-xs gap-1 cursor-pointer"
                        >
                          <span>Details</span>
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            /* LIST VIEW OF DARK CARDS */
            <div className="space-y-3">
              {sortedLatestBookings.map((b) => {
                const chipProps = getStatusChipProps(b.status);
                return (
                  <Card
                    key={b.id}
                    variant="dark"
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:border-white/30 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-white/10 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {b.customerName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white">{b.customerName}</h4>
                          <span className="text-[11px] text-white/50 font-mono">({b.reference})</span>
                        </div>
                        <p className="text-[11px] text-white/70 mt-0.5">
                          {b.serviceName} • {b.categoryName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                      <div className="text-right">
                        <span className="text-xs font-black text-white block">
                          {formatPesewas(b.totalPesewas)}
                        </span>
                        <span className="text-[10px] text-white/50 font-mono">{b.timeFormatted}</span>
                      </div>
                      <StatusChip status={chipProps.status} label={chipProps.label} />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </>
    ))}
      </div>

      {/* DOWNLOAD REPORT MODAL */}
      <Dialog
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title="Download Operations & Revenue Report"
        description="Generate an official financial and appointment audit export for Ghana revenue compliance."
      >
        <div className="space-y-4">
          <div className="p-4 bg-[#F4F4F6] rounded-2xl border border-[#E4E4E7] text-xs space-y-2">
            <div className="flex justify-between text-[#71717A]">
              <span>Period:</span>
              <span className="font-bold text-[#1E1E1E]">October 2026 (Month-to-Date)</span>
            </div>
            <div className="flex justify-between text-[#71717A]">
              <span>Total Revenue:</span>
              <span className="font-bold text-[#1E1E1E]">
                {data ? formatPesewas(data.monthProgress.currentRevenuePesewas) : "GH₵ 0.00"}
              </span>
            </div>
            <div className="flex justify-between text-[#71717A]">
              <span>Target Achievement:</span>
              <span className="font-bold text-emerald-600">
                {data ? `${data.monthProgress.percentOfTarget}%` : "0%"}
              </span>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button
              variant="outlinePill"
              size="sm"
              onClick={() => setReportModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="blackPill"
              size="sm"
              disabled={isExporting}
              onClick={handleDownloadReport}
              className="gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? "Generating..." : "Download Export"}</span>
            </Button>
          </div>
        </div>
      </Dialog>
    </AppShell>
  );
}
