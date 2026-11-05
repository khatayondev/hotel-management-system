"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar as CalendarIcon,
  List as ListIcon,
  Search,
  ChevronLeft,
  ChevronRight,
  Radio,
  X,
  Clock,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookingCalendarView } from "@/components/bookings/calendar-view";
import { BookingListView } from "@/components/bookings/list-view";
import { BookingDrawer } from "@/components/bookings/booking-drawer";
import { BookingRecord, BookingStaff, BookingFilters } from "@/components/bookings/types";
import { useSmartPolling, triggerGlobalDataSync } from "@/hooks/use-smart-polling";
import { LiveSyncIndicator } from "@/components/ui/live-sync-indicator";

function BookingsContent() {
  const searchParams = useSearchParams();
  const urlStatus = searchParams.get("status");

  const [staffList, setStaffList] = React.useState<BookingStaff[]>([]);
  const [servicesList, setServicesList] = React.useState<Array<{ id: string; name: string }>>([]);

  const [filters, setFilters] = React.useState<BookingFilters>({
    viewMode: "calendar",
    calendarSubView: "day",
    selectedDate: "",
    status: (urlStatus && ["CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELLED", "PENDING_PAYMENT", "NO_SHOW"].includes(urlStatus)) ? (urlStatus as any) : "ALL",
    staffId: "ALL",
    serviceId: "ALL",
    source: "ALL",
    paymentStatus: "ALL",
    search: "",
    page: 1,
    limit: 25,
  });

  React.useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const validStatuses = ["CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELLED", "PENDING_PAYMENT", "NO_SHOW"];
    const targetStatus = urlStatus && validStatuses.includes(urlStatus) ? urlStatus : undefined;

    setFilters((prev) => ({
      ...prev,
      selectedDate: prev.selectedDate || today,
      ...(targetStatus ? { status: targetStatus as any } : {}),
    }));
  }, [urlStatus]);

  const [loading, setLoading] = React.useState(true);
  const [bookings, setBookings] = React.useState<BookingRecord[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [stats, setStats] = React.useState({
    total: 0,
    confirmed: 0,
    checkedIn: 0,
    completed: 0,
    cancelled: 0,
    pendingPayment: 0,
    noShow: 0,
  });

  const [selectedBookingId, setSelectedBookingId] = React.useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  // Smart Search Auto-Suggest State
  const [searchResults, setSearchResults] = React.useState<Array<{
    id: string;
    reference: string;
    title: string;
    subtitle: string;
    phone: string;
    status: string;
    startUtc: string;
    serviceName: string;
  }>>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [showSearchPopover, setShowSearchPopover] = React.useState(false);
  const searchContainerRef = React.useRef<HTMLDivElement>(null);

  // Query smart search as user types
  React.useEffect(() => {
    const q = filters.search.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let active = true;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/dashboard/search?q=${encodeURIComponent(q)}`);
        if (res.ok && active) {
          const json = await res.json();
          if (json.success && json.data) {
            setSearchResults(json.data.results || []);
          }
        }
      } catch {
        // quiet fail
      } finally {
        if (active) setIsSearching(false);
      }
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [filters.search]);

  // Click outside to dismiss popover
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectSearchResult = (result: (typeof searchResults)[0]) => {
    setShowSearchPopover(false);
    setSelectedBookingId(result.id);
    if (result.startUtc) {
      const apptDate = result.startUtc.split("T")[0];
      setFilters((prev) => ({
        ...prev,
        selectedDate: apptDate,
      }));
    }
  };

  // 1. Fetch current staff & services list
  React.useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const staffRes = await fetch("/api/admin/staff").catch(() => null);

        if (!ignore && staffRes && staffRes.ok) {
          const json = await staffRes.json();
          if (json.success && json.data) {
            if (Array.isArray(json.data.staff)) {
              setStaffList(json.data.staff);
            }
            if (Array.isArray(json.data.services)) {
              setServicesList(
                json.data.services.map((s: { id: string; name: string }) => ({
                  id: s.id,
                  name: s.name,
                }))
              );
            }
          }
        }
      } catch {
        // silent
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, []);

  // 2. Fetch Bookings based on current filters
  const loadBookings = React.useCallback(async () => {
    try {
      const params = new URLSearchParams();

      if (filters.viewMode === "calendar") {
        const dateToUse = filters.selectedDate || new Date().toISOString().split("T")[0];
        if (filters.calendarSubView === "day" || filters.calendarSubView === "staff") {
          params.set("startDate", `${dateToUse}T00:00:00.000Z`);
          params.set("endDate", `${dateToUse}T23:59:59.999Z`);
        } else if (filters.calendarSubView === "week") {
          const base = new Date(dateToUse);
          const day = base.getUTCDay();
          const dist = (day + 6) % 7;
          const mon = new Date(base);
          mon.setUTCDate(base.getUTCDate() - dist);
          const sun = new Date(mon);
          sun.setUTCDate(mon.getUTCDate() + 6);
          params.set("startDate", `${mon.toISOString().split("T")[0]}T00:00:00.000Z`);
          params.set("endDate", `${sun.toISOString().split("T")[0]}T23:59:59.999Z`);
        }
        params.set("limit", "100");
      } else {
        // List View: paginated query across bookings
        params.set("page", String(filters.page));
        params.set("limit", String(filters.limit));
      }

      if (filters.status !== "ALL") params.set("status", filters.status);
      if (filters.staffId !== "ALL") params.set("staffId", filters.staffId);
      if (filters.serviceId !== "ALL") params.set("serviceId", filters.serviceId);
      if (filters.source !== "ALL") params.set("source", filters.source);
      if (filters.paymentStatus !== "ALL") params.set("paymentStatus", filters.paymentStatus);
      if (filters.search.trim()) params.set("search", filters.search.trim());

      const res = await fetch(`/api/admin/bookings?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setBookings(json.data.bookings || []);
          setTotal(json.data.total || 0);
          setTotalPages(json.data.totalPages || 1);
          if (json.data.stats) setStats(json.data.stats);
        }
      }
    } catch {
      // quiet error
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Load when filters or manual refreshTrigger changes
  React.useEffect(() => {
    loadBookings();
  }, [loadBookings, refreshTrigger]);

  // Smart SWR Polling (1 min interval + focus revalidation + instant cross-tab sync)
  const { isRefreshing, lastRefreshedAt, refresh: manualRefresh } = useSmartPolling(loadBookings, {
    intervalMs: 60000,
    syncTopic: "bookings",
  });

  // Drag-to-Reschedule handler with Instant Optimistic Snapping & Rollback
  const handleReschedule = async (
    bookingId: string,
    newStartUtc: string,
    newEndUtc: string,
    newStaffId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    // 1. Snapshot previous state for rollback on error
    const prevBookings = bookings;

    // 2. Optimistically move booking immediately (0ms delay)
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id !== bookingId) return b;
        const targetStaff = newStaffId ? staffList.find((s) => s.id === newStaffId) : undefined;
        return {
          ...b,
          startUtc: newStartUtc,
          endUtc: newEndUtc,
          ...(newStaffId && targetStaff
            ? {
                staffId: newStaffId,
                staff: targetStaff,
              }
            : {}),
        };
      })
    );

    // 3. Perform background server sync
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newStartUtc,
          newEndUtc,
          newStaffId,
        }),
      });

      const json = await res.json();
      if (json.success) {
        triggerGlobalDataSync("all");
        return { success: true };
      }

      // Rollback on conflict or server refusal
      setBookings(prevBookings);
      return {
        success: false,
        error: json.error?.message || "Rescheduling conflict or outside operating hours",
      };
    } catch (err) {
      // Rollback on network error
      setBookings(prevBookings);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Network error during reschedule",
      };
    }
  };

  // Date navigation
  const adjustDate = (days: number) => {
    const current = new Date(filters.selectedDate);
    current.setUTCDate(current.getUTCDate() + days);
    setFilters((prev) => ({
      ...prev,
      selectedDate: current.toISOString().split("T")[0],
    }));
  };

  return (
    <AppShell activePath="/bookings" userName="Akosua">
      <div className="max-w-7xl mx-auto space-y-6 pb-16">
        {/* TOP BAR: Title, Live Sync Status, View Toggles */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-[#1E1E1E] tracking-tight">
                Appointments & Bookings
              </h1>
              <LiveSyncIndicator
                isRefreshing={isRefreshing}
                lastRefreshedAt={lastRefreshedAt}
                onRefresh={manualRefresh}
              />
            </div>
            <p className="text-xs text-[#71717A] mt-0.5">
              Manage salon appointments, calendar schedules, client check-ins and studio operations
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher (Calendar vs List) */}
            <div className="p-1 rounded-full bg-zinc-200/80 flex items-center gap-1 border border-black/5">
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, viewMode: "calendar" }))}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  filters.viewMode === "calendar"
                    ? "bg-[#1E1E1E] text-white shadow-xs"
                    : "text-zinc-600 hover:text-black"
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Calendar</span>
              </button>

              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, viewMode: "list" }))}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  filters.viewMode === "list"
                    ? "bg-[#1E1E1E] text-white shadow-xs"
                    : "text-zinc-600 hover:text-black"
                }`}
              >
                <ListIcon className="w-3.5 h-3.5" />
                <span>List View</span>
              </button>
            </div>
          </div>
        </div>

        {/* FILTER BAR & CONTROLS */}
        <Card variant="white" className="p-3 rounded-3xl border border-black/10 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Calendar Controls (if calendar mode) */}
            {filters.viewMode === "calendar" && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* Subview Pills */}
                <div className="p-1 rounded-full bg-zinc-100 flex items-center gap-1 border border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setFilters((p) => ({ ...p, calendarSubView: "day" }))}
                    className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-all ${
                      filters.calendarSubView === "day"
                        ? "bg-[#1E1E1E] text-white shadow-xs"
                        : "text-zinc-600 hover:text-black"
                    }`}
                  >
                    Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilters((p) => ({ ...p, calendarSubView: "week" }))}
                    className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-all ${
                      filters.calendarSubView === "week"
                        ? "bg-[#1E1E1E] text-white shadow-xs"
                        : "text-zinc-600 hover:text-black"
                    }`}
                  >
                    Week
                  </button>
                </div>

                {/* Date Navigator */}
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outlinePill"
                    onClick={() => adjustDate(-1)}
                    className="h-8 w-8 p-0 cursor-pointer bg-white"
                    aria-label="Previous day"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  <input
                    type="date"
                    value={filters.selectedDate}
                    onChange={(e) => setFilters((p) => ({ ...p, selectedDate: e.target.value }))}
                    className="text-xs font-bold p-1.5 px-3 rounded-full border border-zinc-300 bg-white"
                  />

                  <Button
                    size="sm"
                    variant="outlinePill"
                    onClick={() => adjustDate(1)}
                    className="h-8 w-8 p-0 cursor-pointer bg-white"
                    aria-label="Next day"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>

                  <Button
                    size="sm"
                    variant="outlinePill"
                    onClick={() => {
                      const today = new Date().toISOString().split("T")[0];
                      setFilters((p) => ({ ...p, selectedDate: today }));
                    }}
                    className="text-xs font-bold h-8 px-3 cursor-pointer bg-white"
                  >
                    Today
                  </Button>
                </div>
              </div>
            )}

            {/* SMART SEARCH BAR (Always present on the bar) */}
            <div ref={searchContainerRef} className="relative flex-1 min-w-[220px] max-w-md">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Smart search: code, client, phone, service..."
                  value={filters.search}
                  onFocus={() => {
                    if (filters.search.trim().length >= 2) setShowSearchPopover(true);
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilters((p) => ({ ...p, search: val, page: 1 }));
                    if (val.trim().length >= 2) {
                      setShowSearchPopover(true);
                    } else {
                      setShowSearchPopover(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setShowSearchPopover(false);
                    }
                  }}
                  className="w-full text-xs pl-9 pr-8 py-2 rounded-full border border-zinc-300 bg-white shadow-2xs focus:outline-none focus:border-black focus:ring-1 focus:ring-black placeholder:text-zinc-400 transition-all font-medium"
                />
                {filters.search && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilters((p) => ({ ...p, search: "", page: 1 }));
                      setShowSearchPopover(false);
                    }}
                    className="absolute right-2.5 p-1 rounded-full text-zinc-400 hover:text-black hover:bg-zinc-100 transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Floating Smart Suggest Popover */}
              {showSearchPopover && (
                <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-xl border border-zinc-200 overflow-hidden divide-y divide-zinc-100 max-h-80 overflow-y-auto animate-in fade-in-50 duration-150">
                  <div className="px-3.5 py-2 bg-zinc-50 flex items-center justify-between text-[11px] font-semibold text-zinc-500">
                    <span className="flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-zinc-500" />
                      Appointments matching &ldquo;{filters.search}&rdquo;
                    </span>
                    {isSearching ? (
                      <span className="text-zinc-400">Searching...</span>
                    ) : (
                      <span>
                        {searchResults.length} {searchResults.length === 1 ? "match" : "matches"}
                      </span>
                    )}
                  </div>

                  {isSearching && searchResults.length === 0 ? (
                    <div className="p-4 text-center text-xs text-zinc-400">
                      Searching appointments across database...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-4 text-center space-y-1">
                      <p className="text-xs font-semibold text-zinc-700">No appointments found</p>
                      <p className="text-[11px] text-zinc-400">
                        Try searching by client name, reference code (e.g. BK-XXXX), phone, or service.
                      </p>
                    </div>
                  ) : (
                    searchResults.map((result) => {
                      const apptDate = result.startUtc ? new Date(result.startUtc) : null;
                      const formattedDate = apptDate
                        ? apptDate.toLocaleDateString("en-GB", {
                            timeZone: "Africa/Accra",
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          }) +
                          " • " +
                          apptDate.toLocaleTimeString("en-GB", {
                            timeZone: "Africa/Accra",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })
                        : "";

                      return (
                        <button
                          key={result.id}
                          type="button"
                          onClick={() => handleSelectSearchResult(result)}
                          className="w-full text-left p-3 hover:bg-zinc-50/80 transition-colors flex items-center justify-between gap-3 cursor-pointer group"
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-zinc-900 group-hover:text-black truncate">
                                {result.title}
                              </span>
                              <span className="text-[10px] text-zinc-400 font-mono">
                                {result.phone}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-500 truncate flex items-center gap-1.5">
                              <span className="font-medium text-zinc-700">{result.serviceName}</span>
                              {formattedDate && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1 text-zinc-400">
                                    <Clock className="w-3 h-3 inline" />
                                    {formattedDate}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-zinc-100 rounded text-zinc-700 border border-zinc-200">
                              {result.reference}
                            </span>
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                                result.status === "CONFIRMED"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : result.status === "CHECKED_IN"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : result.status === "COMPLETED"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : result.status === "PENDING_PAYMENT"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-zinc-100 text-zinc-600 border-zinc-200"
                              }`}
                            >
                              {result.status.replace("_", " ")}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Common Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filter */}
              <select
                value={filters.status}
                onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value, page: 1 }))}
                className="text-xs p-1.5 px-3 rounded-full border border-zinc-300 bg-white font-medium cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="CHECKED_IN">Checked In</option>
                <option value="COMPLETED">Completed</option>
                <option value="PENDING_PAYMENT">Pending Payment</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="NO_SHOW">No Show</option>
              </select>

              {/* Solo direct shop mode: Stylist filter omitted
              <select
                value={filters.staffId}
                onChange={(e) => setFilters((p) => ({ ...p, staffId: e.target.value, page: 1 }))}
                className="text-xs p-1.5 px-3 rounded-full border border-zinc-300 bg-white font-medium cursor-pointer"
              >
                <option value="ALL">All Stylists</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              */}

              {/* Service Filter */}
              <select
                value={filters.serviceId}
                onChange={(e) => setFilters((p) => ({ ...p, serviceId: e.target.value, page: 1 }))}
                className="text-xs p-1.5 px-3 rounded-full border border-zinc-300 bg-white font-medium cursor-pointer"
              >
                <option value="ALL">All Services</option>
                {servicesList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {/* Reset Filters */}
              {(filters.status !== "ALL" ||
                filters.staffId !== "ALL" ||
                filters.serviceId !== "ALL" ||
                filters.search !== "") && (
                <button
                  type="button"
                  onClick={() =>
                    setFilters((p) => ({
                      ...p,
                      status: "ALL",
                      staffId: "ALL",
                      serviceId: "ALL",
                      source: "ALL",
                      paymentStatus: "ALL",
                      search: "",
                      page: 1,
                    }))
                  }
                  className="text-xs text-zinc-500 hover:text-black font-semibold underline px-2 cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* MAIN VIEW CONTENT */}
        {loading && bookings.length === 0 ? (
          <div className="py-24 text-center space-y-3 bg-white rounded-3xl border border-black/10">
            <div className="w-8 h-8 border-3 border-black border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-zinc-500">Loading appointments and schedules...</p>
          </div>
        ) : filters.viewMode === "calendar" ? (
          <BookingCalendarView
            subView={filters.calendarSubView}
            selectedDate={filters.selectedDate}
            bookings={bookings}
            staffList={staffList}
            onSelectBooking={(id) => setSelectedBookingId(id)}
            onReschedule={handleReschedule}
          />
        ) : (
          <BookingListView
            bookings={bookings}
            total={total}
            page={filters.page}
            totalPages={totalPages}
            onPageChange={(p) => setFilters((prev) => ({ ...prev, page: p }))}
            onSelectBooking={(id) => setSelectedBookingId(id)}
          />
        )}

        {/* BOOKING DETAIL DRAWER */}
        {selectedBookingId && (
          <BookingDrawer
            bookingId={selectedBookingId}
            onClose={() => setSelectedBookingId(null)}
            onRefresh={() => {
              setRefreshTrigger((prev) => prev + 1);
              triggerGlobalDataSync("all");
            }}
            staffList={staffList}
          />
        )}
      </div>
    </AppShell>
  );
}

export default function BookingsPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-sm text-zinc-500">Loading bookings...</div>}>
      <BookingsContent />
    </React.Suspense>
  );
}

