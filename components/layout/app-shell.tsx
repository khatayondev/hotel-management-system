"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  LayoutDashboard,
  Scissors,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  Bell,
  Search,
  Plus,
  Menu,
  Crown,
  ShieldCheck,
  Palette,
  ChevronDown,
  ShoppingBag,
  Send,
  CalendarPlus,
  Phone,
  UserCheck,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Drawer, Dialog } from "@/components/ui/dialog-and-drawer";
import { Input, Label } from "@/components/ui/controls";
import { StatusChip } from "@/components/ui/status-chip";
import { InstallPwaButton } from "@/components/pwa/install-pwa-button";
import { useAuth } from "@/components/auth/auth-context";
import { useSmartPolling } from "@/hooks/use-smart-polling";
import { ROLES, UserRole, PERMISSION_KEYS } from "@/lib/rbac";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredPermission?: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

interface SearchResult {
  id: string;
  reference: string;
  title: string;
  subtitle: string;
  phone: string;
  status: string;
  staffName: string;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
}

export function AppShell({
  children,
  activePath = "/dashboard",
  userName = "Akosua",
}: {
  children: React.ReactNode;
  activePath?: string;
  userName?: string;
}) {
  const { user, isOwner, isManager, isStaff, hasPermission, hasRole } = useAuth();
  const router = useRouter();
  const [mobileDrawerOpen, setMobileDrawerOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [focusMode, setFocusMode] = React.useState(false);
  const [createDropdownOpen, setCreateDropdownOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [searchModalOpen, setSearchModalOpen] = React.useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  React.useEffect(() => {
    try {
      const savedFocus = localStorage.getItem("beccas_focus_mode");
      if (savedFocus === "true") {
        setFocusMode(true);
        setSidebarCollapsed(true);
        return;
      }
      const saved = localStorage.getItem("beccas_sidebar_collapsed");
      if (saved !== null) {
        setSidebarCollapsed(saved === "true");
      }
    } catch {
      // quiet
    }
  }, []);

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("beccas_sidebar_collapsed", String(next));
      } catch {
        // quiet
      }
      return next;
    });
  };

  const toggleFocusMode = () => {
    setFocusMode((prev) => {
      const next = !prev;
      if (next) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
      try {
        localStorage.setItem("beccas_focus_mode", String(next));
        localStorage.setItem("beccas_sidebar_collapsed", String(next));
      } catch {
        // quiet
      }
      return next;
    });
  };

  const displayName = user?.name
    ? user.name.split(" ")[0]
    : userName && userName !== "Akosua"
    ? userName
    : "Studio";

  const fullName = user?.name || (userName !== "Akosua" ? userName : "Studio Member");

  const roleTitle =
    user?.role === ROLES.FRONT_DESK
      ? "Front Desk Tablet"
      : user?.role === ROLES.STAFF_RECEPTIONIST
      ? "Front Desk • Receptionist"
      : user?.role === ROLES.MANAGER
      ? "Studio Manager"
      : user?.role === ROLES.OWNER_ADMIN
      ? "Studio Owner & Admin"
      : "Studio Member";

  const roleSubtitle =
    user?.role === ROLES.FRONT_DESK
      ? "Front Desk Tablet • At-A-Glance Operations"
      : user?.role === ROLES.STAFF_RECEPTIONIST
      ? "Front Desk Operations • Today's Schedule"
      : user?.role === ROLES.MANAGER
      ? "Studio Management & Operations"
      : user?.role === ROLES.OWNER_ADMIN
      ? "Studio Overview • Executive Access"
      : "Welcome to your studio overview for today.";

  const canAccessSettings =
    isOwner || isManager || (user ? hasPermission(PERMISSION_KEYS.SETTINGS_MANAGE) : false);

  // Search state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  // Notifications state
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);

  const loadNotifications = React.useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/notifications");
      if (res.ok) {
        const json = await res.json();
        if (json?.data?.notifications) {
          setNotifications(json.data.notifications);
        }
      }
    } catch {
      // quiet
    }
  }, []);

  React.useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Smart SWR Polling: 30s interval, pauses when hidden, revalidates on focus
  useSmartPolling(loadNotifications, {
    intervalMs: 30000,
    syncTopic: "notifications",
  });

  const handleMarkAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
    try {
      await fetch("/api/dashboard/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
    } catch {
      // quiet
    }
  };

  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    try {
      await fetch("/api/dashboard/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllAsRead: true }),
      });
    } catch {
      // quiet
    }
  };

  // Modal actions
  const [newBookingModalOpen, setNewBookingModalOpen] = React.useState(false);
  const [paymentRequestModalOpen, setPaymentRequestModalOpen] = React.useState(false);

  // Form states for modals
  const [reqPhone, setReqPhone] = React.useState("");
  const [reqAmount, setReqAmount] = React.useState("");
  const [reqNotes, setReqNotes] = React.useState("");
  const [reqSubmitted, setReqSubmitted] = React.useState(false);

  // Search handler
  React.useEffect(() => {
    let ignore = false;
    const timer = setTimeout(async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const res = await fetch(`/api/dashboard/search?q=${encodeURIComponent(searchQuery)}`);
        if (!ignore && res.ok) {
          const json = await res.json();
          setSearchResults(json.data.results);
        }
      } catch {
        // quiet error
      } finally {
        if (!ignore) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Handle Escape key to dismiss popovers & modals
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCreateDropdownOpen(false);
        setNotificationsOpen(false);
        setSearchModalOpen(false);
        setMobileDrawerOpen(false);
        setProfileDropdownOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await fetch("/api/auth/logout", {
        method: "POST",
      });
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  };

  const navSections: NavSection[] = [
    {
      title: "Core",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: "Bookings", href: "/bookings", icon: <Calendar className="w-4 h-4" /> },
        { label: "POS Checkout", href: "/pos", icon: <CreditCard className="w-4 h-4" /> },
        { label: "Customers", href: "/customers", icon: <UserCheck className="w-4 h-4" /> },
      ],
    },
    {
      title: "Management",
      items: [
        {
          label: "Users & Roles",
          href: "/dashboard/users",
          icon: <ShieldCheck className="w-4 h-4" />,
          allowedRoles: [ROLES.OWNER_ADMIN],
          requiredPermission: PERMISSION_KEYS.USERS_MANAGE,
        },
        {
          label: "Services & Pricing",
          href: "/services",
          icon: <Scissors className="w-4 h-4" />,
          allowedRoles: [ROLES.OWNER_ADMIN, ROLES.MANAGER],
          requiredPermission: PERMISSION_KEYS.SERVICES_MANAGE,
        },
        {
          label: "Staff & Shifts",
          href: "/staff",
          icon: <Users className="w-4 h-4" />,
          allowedRoles: [ROLES.OWNER_ADMIN, ROLES.MANAGER],
          requiredPermission: PERMISSION_KEYS.STAFF_MANAGE,
        },
        {
          label: "Design System",
          href: "/design",
          icon: <Palette className="w-4 h-4" />,
          allowedRoles: [ROLES.OWNER_ADMIN],
        },
      ],
    },
    {
      title: "Business",
      items: [
        {
          label: "Sales & Reports",
          href: "/reports",
          icon: <BarChart3 className="w-4 h-4" />,
          allowedRoles: [ROLES.OWNER_ADMIN, ROLES.MANAGER],
          requiredPermission: PERMISSION_KEYS.REPORTS_VIEW,
        },
        {
          label: "Audit Logs",
          href: "/audit",
          icon: <ShieldCheck className="w-4 h-4" />,
          allowedRoles: [ROLES.OWNER_ADMIN],
          requiredPermission: PERMISSION_KEYS.AUDIT_VIEW,
        },
      ],
    },
  ];

  const isItemVisible = (item: NavItem) => {
    // If unrestricted, anyone authenticated can view
    if (!item.allowedRoles && !item.requiredPermission) return true;
    if (!user) return false;
    if (user.role === ROLES.OWNER_ADMIN) return true;
    if (item.allowedRoles && !hasRole(item.allowedRoles)) return false;
    if (item.requiredPermission && !hasPermission(item.requiredPermission)) return false;
    return true;
  };

  const visibleNavSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(isItemVisible),
    }))
    .filter((section) => section.items.length > 0);

  const renderSidebarContent = (isCollapsed: boolean) => (
    <div className="flex flex-col h-full justify-between select-none overflow-hidden">
      <div>
        {/* Brand & Collapse Toggle */}
        {!isCollapsed ? (
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={toggleFocusMode}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-2xl hover:bg-white/10 transition-all group min-w-0 text-left cursor-pointer"
              title="Click logo to collapse sidebar & hide topbar for maximum calendar room"
            >
              <div className="w-9 h-9 rounded-2xl bg-zinc-900 border border-white/15 text-white flex items-center justify-center font-bold text-sm shadow-md shrink-0 group-hover:border-amber-400/50 group-hover:scale-105 transition-all">
                <Crown className="w-4 h-4 text-amber-300" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-extrabold text-white tracking-tight leading-tight uppercase truncate">
                  BECCA&apos;S CROWN
                </h1>
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold truncate">
                  Beauty Vault • Accra
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={toggleSidebarCollapse}
              className="hidden lg:flex w-8 h-8 rounded-full items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2.5 mb-4">
            <button
              type="button"
              onClick={toggleFocusMode}
              className={cn(
                "w-10 h-10 rounded-2xl bg-zinc-900 border border-white/15 text-white flex items-center justify-center font-bold text-sm shadow-md hover:border-amber-400/70 hover:scale-105 transition-all cursor-pointer relative",
                focusMode && "border-amber-400/80 shadow-amber-400/20"
              )}
              title={focusMode ? "Click logo to restore topbar and sidebar" : "Click logo to collapse sidebar & hide topbar"}
            >
              <Crown className="w-4 h-4 text-amber-300" />
              {focusMode && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-black animate-pulse" />
              )}
            </button>
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              className="hidden lg:flex w-8 h-8 rounded-full items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Nav Sections */}
        <div className={cn("space-y-4", isCollapsed && "space-y-2")}>
          {visibleNavSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {section.title && (
                !isCollapsed ? (
                  <p className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                    {section.title}
                  </p>
                ) : (
                  idx > 0 && <div className="w-6 h-px bg-white/10 mx-auto my-2" />
                )
              )}
              {section.items.map((item) => {
                const isActive = activePath === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileDrawerOpen(false)}
                    title={item.label}
                    className={cn(
                      "flex items-center transition-all",
                      isCollapsed
                        ? "justify-center w-10 h-10 mx-auto rounded-full text-sm"
                        : "gap-3 px-3.5 py-2 rounded-full text-xs font-semibold",
                      isActive
                        ? "bg-white text-zinc-950 font-bold shadow-md"
                        : "text-zinc-300 hover:text-white hover:bg-white/10"
                    )}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {!isCollapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Settings at Bottom */}
      <div className={cn("pt-3 border-t border-white/10 space-y-2 mt-4 shrink-0", isCollapsed && "space-y-1.5")}>
        <InstallPwaButton variant="sidebar" collapsed={isCollapsed} />
        {canAccessSettings && (
          <Link
            href="/settings"
            onClick={() => setMobileDrawerOpen(false)}
            title="Settings"
            className={cn(
              "flex items-center transition-all",
              isCollapsed
                ? "justify-center w-10 h-10 mx-auto rounded-full text-sm"
                : "gap-3 px-3.5 py-2.5 rounded-full text-xs font-semibold",
              activePath === "/settings"
                ? "bg-white text-zinc-950 font-bold shadow-md"
                : "text-zinc-300 hover:text-white hover:bg-white/10"
            )}
          >
            <Settings className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Settings</span>}
          </Link>
        )}
      </div>
    </div>
  );

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div className="min-h-screen bg-[#F4F4F6] text-[#1E1E1E] flex flex-row antialiased">
      {/* 1. Desktop Fixed Full-Screen Pure Black Sidebar (Collapsible, never scrolls) */}
      <aside
        className={cn(
          "hidden lg:flex fixed inset-y-0 left-0 h-screen bg-black text-white border-r border-white/10 flex-col justify-between overflow-hidden z-40 select-none transition-all duration-300 ease-in-out",
          sidebarCollapsed ? "w-20 p-3.5" : "w-64 p-5"
        )}
      >
        {renderSidebarContent(sidebarCollapsed)}
      </aside>

      {/* 2. Mobile Drawer with matching full black background and white content (Always full view) */}
      <Drawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        title="Becca's Crown Beauty Vault"
        side="left"
        className="bg-black text-white border-r border-white/10"
      >
        {renderSidebarContent(false)}
      </Drawer>

      {/* 3. Main Dashboard Body (Offset by dynamic sidebar width on desktop with smooth transition) */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 min-h-screen transition-all duration-300 ease-in-out",
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"
        )}
      >
        {/* Top Header (Smoothly collapses out of view in Focus Mode to maximize calendar / table space) */}
        <header
          className={cn(
            "sticky top-0 z-30 bg-white/85 backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 transition-all duration-300 ease-in-out",
            focusMode
              ? "-translate-y-full opacity-0 pointer-events-none max-h-0 py-0 border-b-0 overflow-hidden"
              : "translate-y-0 opacity-100 max-h-28 py-3.5 border-b border-black/5"
          )}
        >
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <Button
              variant="circularIcon"
              size="iconSm"
              className="lg:hidden"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open sidebar menu"
            >
              <Menu className="w-4 h-4" />
            </Button>

            {/* Desktop collapse toggle trigger */}
            <Button
              variant="circularIcon"
              size="iconSm"
              className="hidden lg:flex cursor-pointer text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
              onClick={toggleSidebarCollapse}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </Button>

            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#1E1E1E] tracking-tight">
                Hi, {displayName}!
              </h2>
              <p className="text-xs text-[#71717A] hidden sm:block">
                {roleSubtitle}
              </p>
            </div>
          </div>

          {/* Top Bar Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Install PWA Header Shortcut */}
            <InstallPwaButton variant="header" className="hidden md:inline-flex" />

            {/* Search Trigger Button */}
            <Button
              variant="circularIcon"
              size="iconSm"
              aria-label="Search bookings, customers, phone numbers"
              onClick={() => setSearchModalOpen(true)}
              className="cursor-pointer"
            >
              <Search className="w-4 h-4 text-[#71717A]" />
            </Button>

            {/* Notifications with Live Badge */}
            <div className="relative">
              <Button
                variant="circularIcon"
                size="iconSm"
                aria-label="Notifications"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="cursor-pointer"
              >
                <Bell className="w-4 h-4 text-[#71717A]" />
              </Button>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[#EF4444] text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center px-1 shadow-xs">
                  {unreadCount}
                </span>
              )}

              {/* Notifications Popover */}
              {notificationsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setNotificationsOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-3xl bg-white border border-[#E4E4E7] shadow-2xl p-4 z-40 animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between pb-3 border-b border-[#F4F4F6]">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <h4 className="text-xs font-bold text-[#1E1E1E]">Live Studio Feed</h4>
                      </div>
                      <span className="text-[11px] text-[#71717A]">{unreadCount} unread</span>
                    </div>

                    <div className="divide-y divide-[#F4F4F6] max-h-72 overflow-y-auto my-2">
                      {notifications.map((item) => (
                        <div
                          key={item.id}
                          className="py-3 px-1 hover:bg-[#FAFAFB] rounded-xl transition-colors cursor-pointer"
                          onClick={() => {
                            handleMarkAsRead(item.id);
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h5 className="text-xs font-bold text-[#1E1E1E]">{item.title}</h5>
                            <span className="text-[10px] text-[#A1A1AA]">{item.time}</span>
                          </div>
                          <p className="text-[11px] text-[#71717A] mt-1 leading-snug">
                            {item.message}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-[#F4F4F6] text-center">
                      <button
                        type="button"
                        onClick={() => {
                          handleMarkAllAsRead();
                          setNotificationsOpen(false);
                        }}
                        className="text-[11px] font-semibold text-[#1E1E1E] hover:underline cursor-pointer"
                      >
                        Mark all as read
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Black Pill 'Create' Dropdown Button */}
            <div className="relative">
              <Button
                variant="blackPill"
                size="sm"
                className="gap-1.5 shadow-sm cursor-pointer"
                onClick={() => setCreateDropdownOpen(!createDropdownOpen)}
                aria-expanded={createDropdownOpen}
                aria-haspopup="true"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create</span>
                <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
              </Button>

              {createDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setCreateDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-[#1E1E1E] text-white border border-white/10 shadow-2xl p-1.5 z-40 animate-in fade-in zoom-in-95">
                    <button
                      type="button"
                      onClick={() => {
                        setCreateDropdownOpen(false);
                        setNewBookingModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold rounded-xl text-left hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <CalendarPlus className="w-4 h-4 text-white/80" />
                      <span>New Booking</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCreateDropdownOpen(false);
                        setPaymentRequestModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold rounded-xl text-left hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <Send className="w-4 h-4 text-white/80" />
                      <span>Payment Request</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCreateDropdownOpen(false);
                        router.push("/pos");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold rounded-xl text-left hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <ShoppingBag className="w-4 h-4 text-white/80" />
                      <span>Walk-in Sale (POS)</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Profile Avatar & Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                aria-expanded={profileDropdownOpen}
                aria-haspopup="true"
                aria-label="User profile menu"
                className="w-9 h-9 rounded-full bg-[#1E1E1E] text-white border-2 border-white shadow-xs flex items-center justify-center text-xs font-bold shrink-0 hover:ring-2 hover:ring-black/10 transition-all cursor-pointer select-none"
              >
                {displayName.charAt(0).toUpperCase()}
              </button>

              {profileDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setProfileDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-white border border-[#E4E4E7] shadow-2xl p-2 z-40 animate-in fade-in zoom-in-95 text-[#1E1E1E]">
                    {/* User Info Header */}
                    <div className="px-3 py-2.5 border-b border-[#F4F4F6]">
                      <p className="text-xs font-bold text-[#1E1E1E] truncate">{fullName}</p>
                      <p className="text-[11px] font-semibold text-zinc-600 truncate mt-0.5">{roleTitle}</p>
                      <p className="text-[10px] text-[#71717A] truncate mt-0.5">{user?.email || "Signed In"}</p>
                    </div>

                    {canAccessSettings && (
                      <div className="py-1">
                        <Link
                          href="/settings"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-[#1E1E1E] hover:bg-[#F4F4F6] transition-colors"
                        >
                          <Settings className="w-4 h-4 text-[#71717A]" />
                          <span>Account Settings</span>
                        </Link>
                      </div>
                    )}

                    <div className="pt-1 border-t border-[#F4F4F6]">
                      <button
                        type="button"
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-red-600 hover:bg-red-50 transition-colors cursor-pointer text-left disabled:opacity-60"
                      >
                        <LogOut className="w-4 h-4 text-red-500" />
                        <span>{loggingOut ? "Signing out..." : "Log Out"}</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Floating Focus Mode Banner / Restore Trigger */}
        {focusMode && (
          <div className="fixed top-2.5 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-top-2">
            <button
              type="button"
              onClick={toggleFocusMode}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-semibold bg-zinc-950/90 hover:bg-black text-white backdrop-blur-md shadow-lg border border-white/20 transition-all hover:scale-105 cursor-pointer"
              title="Click to restore top header and sidebar"
            >
              <Crown className="w-3 h-3 text-amber-300" />
              <span>Full View Active</span>
              <span className="text-[10px] text-zinc-400 font-normal">• Click logo or here to restore</span>
            </button>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto min-w-0">
          {children}
        </main>
      </div>

      {/* GLOBAL SEARCH DIALOG MODAL */}
      <Dialog
        isOpen={searchModalOpen}
        onClose={() => {
          setSearchModalOpen(false);
          setSearchQuery("");
          setSearchResults([]);
        }}
        title="Global Search"
        description="Search customers, appointments, Paystack references, and Ghana phone numbers."
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-[#71717A] absolute left-3.5 top-3.5 pointer-events-none" />
            <Input
              autoFocus
              placeholder="Type customer name, +233 phone, or BK-..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 text-xs rounded-2xl"
            />
          </div>

          <div className="min-h-[160px] max-h-80 overflow-y-auto divide-y divide-[#F4F4F6]">
            {isSearching ? (
              <p className="text-center py-8 text-xs text-[#71717A]">Searching database...</p>
            ) : searchResults.length > 0 ? (
              searchResults.map((res) => (
                <div
                  key={res.id}
                  onClick={() => setSearchModalOpen(false)}
                  className="py-3 px-2 hover:bg-[#FAFAFB] rounded-xl transition-colors cursor-pointer flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-[#1E1E1E]">{res.title}</h4>
                      <span className="text-[10px] font-mono text-[#71717A]">{res.reference}</span>
                    </div>
                    <p className="text-[11px] text-[#71717A] mt-0.5">{res.subtitle}</p>
                    <p className="text-[10px] text-[#A1A1AA] flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />
                      <span>{res.phone}</span>
                    </p>
                  </div>
                  <StatusChip
                    status={res.status === "CONFIRMED" || res.status === "COMPLETED" ? "green" : "amber"}
                    label={res.status}
                  />
                </div>
              ))
            ) : searchQuery.length >= 2 ? (
              <p className="text-center py-8 text-xs text-[#71717A]">
                No matching customers or bookings found for &quot;{searchQuery}&quot;.
              </p>
            ) : (
              <p className="text-center py-8 text-xs text-[#A1A1AA]">
                Type at least 2 characters to search studio records.
              </p>
            )}
          </div>
        </div>
      </Dialog>

      {/* NEW BOOKING MODAL */}
      <Dialog
        isOpen={newBookingModalOpen}
        onClose={() => setNewBookingModalOpen(false)}
        title="Schedule New Appointment"
        description="Book a client session with automatic duration and station buffer checking."
      >
        <div className="space-y-4">
          <div>
            <Label>Client Name</Label>
            <Input placeholder="e.g. Efua Mansa" />
          </div>
          <div>
            <Label>Ghana Mobile Phone (+233 or 0XX)</Label>
            <Input placeholder="024 123 4567" />
          </div>
          <div>
            <Label>Service Category</Label>
            <select className="w-full h-11 px-4 text-xs bg-white border border-[#E4E4E7] rounded-2xl text-[#1E1E1E] focus:outline-none focus:border-[#1E1E1E]">
              <option>Bridal Soft Glam (GH₵ 550.00)</option>
              <option>Hybrid Volume Lash Full Set (GH₵ 280.00)</option>
              <option>Goddess Knotless Braids (GH₵ 350.00)</option>
              <option>Luxury Evening Gown Rental (GH₵ 450.00)</option>
            </select>
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <Button
              variant="outlinePill"
              size="sm"
              onClick={() => setNewBookingModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="blackPill"
              size="sm"
              onClick={() => {
                setNewBookingModalOpen(false);
                router.push("/pos");
              }}
            >
              Proceed to Slot Selection
            </Button>
          </div>
        </div>
      </Dialog>

      {/* PAYMENT REQUEST MODAL */}
      <Dialog
        isOpen={paymentRequestModalOpen}
        onClose={() => {
          setPaymentRequestModalOpen(false);
          setReqSubmitted(false);
        }}
        title="Send Mobile Money Payment Request"
        description="Dispatch Paystack MoMo or Card prompt via SMS to the customer."
      >
        {reqSubmitted ? (
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 text-xs space-y-2">
            <p className="font-bold">Payment Request Dispatched</p>
            <p>
              SMS with payment link sent to {reqPhone}. Status will update automatically when the customer authorizes their MoMo prompt.
            </p>
            <Button
              variant="blackPill"
              size="sm"
              className="mt-3 w-full"
              onClick={() => {
                setPaymentRequestModalOpen(false);
                setReqSubmitted(false);
              }}
            >
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Customer Mobile Money Phone</Label>
              <Input
                placeholder="e.g. 024 555 1234 (MTN / Telecel / AT)"
                value={reqPhone}
                onChange={(e) => setReqPhone(e.target.value)}
              />
            </div>
            <div>
              <Label>Amount (GH₵)</Label>
              <Input
                placeholder="e.g. 250.00"
                value={reqAmount}
                onChange={(e) => setReqAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Purpose / Service Note</Label>
              <Input
                placeholder="e.g. Bridal makeup deposit"
                value={reqNotes}
                onChange={(e) => setReqNotes(e.target.value)}
              />
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="outlinePill"
                size="sm"
                onClick={() => setPaymentRequestModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="blackPill"
                size="sm"
                onClick={() => setReqSubmitted(true)}
              >
                Send Request
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
