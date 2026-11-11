"use client";

import * as React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { RoleGuard } from "@/components/auth/role-guard";
import { ROLES, PERMISSION_KEYS } from "@/lib/rbac";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/controls";
import {
  Building2,
  Clock,
  Calendar,
  Sliders,
  FileText,
  KeyRound,
  MessageSquare,
  Globe2,
  CheckCircle2,
  AlertCircle,
  Lock,
  Plus,
  Trash2,
  Save,
  ShieldAlert,
  Bell,
  Hotel,
  Percent,
} from "lucide-react";
import { NotificationTemplateEditor } from "@/components/notifications/template-editor";
import {
  BusinessSettings,
  DEFAULT_BUSINESS_SETTINGS,
  DaySchedule,
  Holiday,
  SlotIntervalMinutes,
  DepositRefundPolicy,
  TaxSetting,
} from "@/lib/settings-types";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [settings, setSettings] = React.useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [userRole, setUserRole] = React.useState<string>("STAFF_RECEPTIONIST");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [notification, setNotification] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Active section tab
  const [activeTab, setActiveTab] = React.useState<
    "hotel" | "taxes" | "profile" | "hours" | "holidays" | "rules" | "policy" | "payments" | "sms" | "notifications"
  >("hotel");

  // Form states
  const [businessName, setBusinessName] = React.useState("");
  const [businessLogo, setBusinessLogo] = React.useState("");
  const [businessPhone, setBusinessPhone] = React.useState("");
  const [businessAddress, setBusinessAddress] = React.useState("");
  const [businessMapLink, setBusinessMapLink] = React.useState("");

  // HMS Extensions Form States
  const [hotelName, setHotelName] = React.useState("");
  const [standardCheckInTime, setStandardCheckInTime] = React.useState("14:00");
  const [standardCheckOutTime, setStandardCheckOutTime] = React.useState("11:00");
  const [freeCancelHoursBeforeCheckIn, setFreeCancelHoursBeforeCheckIn] = React.useState("24");
  const [cancellationPenaltyPercent, setCancellationPenaltyPercent] = React.useState("50");
  const [taxes, setTaxes] = React.useState<TaxSetting[]>([]);
  const [restaurantOpenTime, setRestaurantOpenTime] = React.useState("07:00");
  const [restaurantCloseTime, setRestaurantCloseTime] = React.useState("22:00");
  const [kdsAmberMinutes, setKdsAmberMinutes] = React.useState("10");
  const [kdsRedMinutes, setKdsRedMinutes] = React.useState("20");

  const [openingHours, setOpeningHours] = React.useState<DaySchedule[]>([]);
  const [holidays, setHolidays] = React.useState<Holiday[]>([]);

  const [minimumNoticeHours, setMinimumNoticeHours] = React.useState("2");
  const [maxDaysAhead, setMaxDaysAhead] = React.useState("60");
  const [slotIntervalMinutes, setSlotIntervalMinutes] = React.useState<SlotIntervalMinutes>(30);
  const [slotHoldMinutes, setSlotHoldMinutes] = React.useState("10");

  const [cancellationNoticeHours, setCancellationNoticeHours] = React.useState("24");
  const [depositRefundPolicy, setDepositRefundPolicy] =
    React.useState<DepositRefundPolicy>("FULL_REFUND_BEFORE_CUTOFF");
  const [cancellationPolicyText, setCancellationPolicyText] = React.useState("");

  const [paystackPublicKey, setPaystackPublicKey] = React.useState("");
  const [paystackSecretKey, setPaystackSecretKey] = React.useState("");
  const [smsSenderId, setSmsSenderId] = React.useState("");

  // New holiday inputs
  const [newHolidayDate, setNewHolidayDate] = React.useState("");
  const [newHolidayName, setNewHolidayName] = React.useState("");

  const isOwner = userRole === "OWNER_ADMIN";
  const isReadOnly = userRole === "STAFF_RECEPTIONIST";

  React.useEffect(() => {
    let ignore = false;
    const run = async () => {
      try {
        const res = await fetch("/api/admin/settings");
        if (res.ok && !ignore) {
          const json = await res.json();
          const data: BusinessSettings = json.data;
          setSettings(data);

          setBusinessName(data.businessName || "");
          setBusinessLogo(data.businessLogo || "");
          setBusinessPhone(data.businessPhone || "");
          setBusinessAddress(data.businessAddress || "");
          setBusinessMapLink(data.businessMapLink || "");

          // HMS Extensions
          setHotelName(data.hotelName || data.businessName || "");
          setStandardCheckInTime(data.standardCheckInTime || "14:00");
          setStandardCheckOutTime(data.standardCheckOutTime || "11:00");
          setFreeCancelHoursBeforeCheckIn((data.freeCancelHoursBeforeCheckIn ?? 24).toString());
          setCancellationPenaltyPercent((data.cancellationPenaltyPercent ?? 50).toString());
          setTaxes(data.taxes || []);
          setRestaurantOpenTime(data.restaurantOpenTime || "07:00");
          setRestaurantCloseTime(data.restaurantCloseTime || "22:00");
          setKdsAmberMinutes((data.kdsAmberMinutes ?? 10).toString());
          setKdsRedMinutes((data.kdsRedMinutes ?? 20).toString());

          setOpeningHours(data.openingHours || []);
          setHolidays(data.holidays || []);

          setMinimumNoticeHours(data.minimumNoticeHours.toString());
          setMaxDaysAhead(data.maxDaysAhead.toString());
          setSlotIntervalMinutes(data.slotIntervalMinutes);
          setSlotHoldMinutes(data.slotHoldMinutes.toString());

          setCancellationNoticeHours(data.cancellationNoticeHours.toString());
          setDepositRefundPolicy(data.depositRefundPolicy);
          setCancellationPolicyText(data.cancellationPolicyText || "");

          setPaystackPublicKey(data.paystackPublicKey || "");
          setPaystackSecretKey(data.paystackSecretKey || "");
          setSmsSenderId(data.smsSenderId || "");
        }

        const userRes = await fetch("/api/admin/catalog");
        if (userRes.ok && !ignore) {
          const userJson = await userRes.json();
          setUserRole(userJson.data.userRole || "STAFF_RECEPTIONIST");
        }
      } catch {
        if (!ignore) {
          setNotification({ type: "error", message: "Failed to load studio settings." });
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };
    run();
    return () => {
      ignore = true;
    };
  }, []);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    try {
      setSaving(true);

      const payload: Record<string, unknown> = {
        businessName: businessName.trim(),
        businessLogo: businessLogo.trim(),
        businessPhone: businessPhone.trim(),
        businessAddress: businessAddress.trim(),
        businessMapLink: businessMapLink.trim(),
        openingHours,
        holidays,
        minimumNoticeHours: Number.parseInt(minimumNoticeHours || "2", 10),
        maxDaysAhead: Number.parseInt(maxDaysAhead || "60", 10),
        slotIntervalMinutes,
        slotHoldMinutes: Number.parseInt(slotHoldMinutes || "10", 10),
        cancellationNoticeHours: Number.parseInt(cancellationNoticeHours || "24", 10),
        depositRefundPolicy,
        cancellationPolicyText: cancellationPolicyText.trim(),
        smsSenderId: smsSenderId.trim(),
        // HMS extensions
        hotelName: hotelName.trim(),
        standardCheckInTime: standardCheckInTime.trim(),
        standardCheckOutTime: standardCheckOutTime.trim(),
        freeCancelHoursBeforeCheckIn: Number.parseInt(freeCancelHoursBeforeCheckIn || "24", 10),
        cancellationPenaltyPercent: Number.parseFloat(cancellationPenaltyPercent || "50"),
        taxes,
        restaurantOpenTime: restaurantOpenTime.trim(),
        restaurantCloseTime: restaurantCloseTime.trim(),
        kdsAmberMinutes: Number.parseInt(kdsAmberMinutes || "10", 10),
        kdsRedMinutes: Number.parseInt(kdsRedMinutes || "20", 10),
      };

      // Only include payment keys if Owner and not masked
      if (isOwner) {
        if (paystackPublicKey && !paystackPublicKey.includes("•")) {
          payload.paystackPublicKey = paystackPublicKey.trim();
        }
        if (paystackSecretKey && !paystackSecretKey.includes("•")) {
          payload.paystackSecretKey = paystackSecretKey.trim();
        }
      }

      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || "Failed to update settings");
      }

      const updated = await res.json();
      setSettings(updated.data);
      showNotification("success", "Business settings saved and audit-logged successfully.");
    } catch (err: unknown) {
      showNotification("error", (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Add holiday handler
  const handleAddHoliday = () => {
    if (!newHolidayDate || !newHolidayName.trim()) {
      showNotification("error", "Please provide a valid holiday date and name.");
      return;
    }
    const newHol: Holiday = {
      id: `hol-${Date.now()}`,
      date: newHolidayDate,
      name: newHolidayName.trim(),
    };
    setHolidays((prev) => [...prev, newHol]);
    setNewHolidayDate("");
    setNewHolidayName("");
  };

  const handleRemoveHoliday = (id: string) => {
    setHolidays((prev) => prev.filter((h) => h.id !== id));
  };

  // Tax configuration handlers
  const handleAddTax = () => {
    setTaxes((prev) => [
      ...prev,
      {
        id: `tax-${Date.now()}`,
        name: "",
        percentage: 0,
        enabled: true,
      },
    ]);
  };

  const handleUpdateTax = (
    id: string,
    field: "name" | "percentage" | "enabled",
    value: string | number | boolean
  ) => {
    setTaxes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const handleRemoveTax = (id: string) => {
    setTaxes((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <RoleGuard
      allowedRoles={[ROLES.OWNER_ADMIN, ROLES.MANAGER]}
      requiredPermission={PERMISSION_KEYS.SETTINGS_MANAGE}
      pageTitle="Studio Business Settings"
      activePath="/settings"
    >
      <AppShell activePath="/settings">
      <div className="space-y-6 pb-20">
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

        {/* Read-Only Notice for Staff */}
        {isReadOnly && (
          <div className="p-4 rounded-2xl bg-[#F4F4F6] border border-[#E4E4E7] flex items-center gap-3 text-xs text-[#71717A]">
            <ShieldAlert className="w-4 h-4 text-[#1E1E1E] shrink-0" />
            <div>
              <span className="font-bold text-[#1E1E1E]">Read-Only Mode: </span>
              Staff accounts can view operating rules and business policies. Settings can only be
              updated by Studio Managers or the Owner.
            </div>
          </div>
        )}

        {/* Header Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#1E1E1E] tracking-tight">
              Business & Operating Settings
            </h1>
            <p className="text-xs text-[#71717A] mt-1">
              Configure studio branding, opening hours, booking intervals, policies, and payment keys.
            </p>
          </div>

          {!isReadOnly && (
            <Button
              type="button"
              variant="blackPill"
              size="sm"
              disabled={saving}
              onClick={handleSaveSettings}
              className="gap-1.5 cursor-pointer text-xs shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? "Saving Changes..." : "Save All Changes"}</span>
            </Button>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {[
            { id: "hotel", label: "Hotel & Check-In", icon: <Hotel className="w-3.5 h-3.5" /> },
            { id: "taxes", label: "Tax Configuration", icon: <Percent className="w-3.5 h-3.5" /> },
            { id: "profile", label: "Studio Profile", icon: <Building2 className="w-3.5 h-3.5" /> },
            { id: "hours", label: "Opening Hours", icon: <Clock className="w-3.5 h-3.5" /> },
            { id: "holidays", label: "Holidays & Closures", icon: <Calendar className="w-3.5 h-3.5" /> },
            { id: "rules", label: "Booking Rules", icon: <Sliders className="w-3.5 h-3.5" /> },
            { id: "policy", label: "Cancellation Policy", icon: <FileText className="w-3.5 h-3.5" /> },
            { id: "payments", label: "Payment Keys (Owner)", icon: <KeyRound className="w-3.5 h-3.5" /> },
            { id: "sms", label: "SMS Sender ID", icon: <MessageSquare className="w-3.5 h-3.5" /> },
            { id: "notifications", label: "Notification Templates", icon: <Bell className="w-3.5 h-3.5" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2",
                activeTab === tab.id
                  ? "bg-[#1E1E1E] text-white shadow-xs"
                  : "bg-white text-[#71717A] border border-[#E4E4E7] hover:border-[#1E1E1E]"
              )}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Card by Section */}
        {loading ? (
          <Card variant="white" className="p-8 h-96 animate-pulse bg-white/60" />
        ) : (
          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* HOTEL & CHECK-IN SETTINGS */}
            {activeTab === "hotel" && (
              <Card variant="white" className="p-6 sm:p-8 space-y-6">
                <div>
                  <h3 className="text-base font-bold text-[#1E1E1E]">Hotel Identity & Stay Policies</h3>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    Configure standard check-in/check-out hours, hotel property naming, and stay cancellation policies.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <Label>Hotel Property Name *</Label>
                    <Input
                      disabled={isReadOnly}
                      required
                      value={hotelName}
                      onChange={(e) => setHotelName(e.target.value)}
                      placeholder="e.g. Aura Royal Hotel & Restaurant"
                    />
                    <p className="text-[10px] text-[#A1A1AA] mt-1">
                      Official hotel name displayed on guest reservations, folios, and invoices.
                    </p>
                  </div>

                  <div>
                    <Label>Standard Check-In Time (HH:MM) *</Label>
                    <Input
                      type="time"
                      disabled={isReadOnly}
                      required
                      value={standardCheckInTime}
                      onChange={(e) => setStandardCheckInTime(e.target.value)}
                    />
                    <p className="text-[10px] text-[#A1A1AA] mt-1">
                      Default guest check-in arrival time (24-hour format).
                    </p>
                  </div>

                  <div>
                    <Label>Standard Check-Out Time (HH:MM) *</Label>
                    <Input
                      type="time"
                      disabled={isReadOnly}
                      required
                      value={standardCheckOutTime}
                      onChange={(e) => setStandardCheckOutTime(e.target.value)}
                    />
                    <p className="text-[10px] text-[#A1A1AA] mt-1">
                      Default guest check-out departure time (24-hour format).
                    </p>
                  </div>

                  <div>
                    <Label>Free Cancellation Window (Hours before check-in) *</Label>
                    <Input
                      type="number"
                      min="0"
                      max="720"
                      disabled={isReadOnly}
                      required
                      value={freeCancelHoursBeforeCheckIn}
                      onChange={(e) => setFreeCancelHoursBeforeCheckIn(e.target.value)}
                    />
                    <p className="text-[10px] text-[#A1A1AA] mt-1">
                      Guests can cancel free of charge until {freeCancelHoursBeforeCheckIn} hours before check-in.
                    </p>
                  </div>

                  <div>
                    <Label>Late Cancellation Penalty (%) *</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      disabled={isReadOnly}
                      required
                      value={cancellationPenaltyPercent}
                      onChange={(e) => setCancellationPenaltyPercent(e.target.value)}
                    />
                    <p className="text-[10px] text-[#A1A1AA] mt-1">
                      Percentage of the stay charged as penalty if cancelled after the free cutoff ({cancellationPenaltyPercent}%).
                    </p>
                  </div>

                  <div>
                    <Label>Restaurant Open Time (HH:MM) *</Label>
                    <Input
                      type="text"
                      disabled={isReadOnly}
                      required
                      placeholder="07:00"
                      value={restaurantOpenTime}
                      onChange={(e) => setRestaurantOpenTime(e.target.value)}
                    />
                    <p className="text-[10px] text-[#A1A1AA] mt-1">
                      Public orders outside these hours are rejected.
                    </p>
                  </div>

                  <div>
                    <Label>Restaurant Close Time (HH:MM) *</Label>
                    <Input
                      type="text"
                      disabled={isReadOnly}
                      required
                      placeholder="22:00"
                      value={restaurantCloseTime}
                      onChange={(e) => setRestaurantCloseTime(e.target.value)}
                    />
                    <p className="text-[10px] text-[#A1A1AA] mt-1">
                      Supports overnight hours (e.g. 18:00 - 02:00).
                    </p>
                  </div>

                  <div>
                    <Label>KDS Warning Timer (Minutes) *</Label>
                    <Input
                      type="number"
                      min="1"
                      max="120"
                      disabled={isReadOnly}
                      required
                      value={kdsAmberMinutes}
                      onChange={(e) => setKdsAmberMinutes(e.target.value)}
                    />
                    <p className="text-[10px] text-[#A1A1AA] mt-1">
                      KDS ticket timer turns amber/orange.
                    </p>
                  </div>

                  <div>
                    <Label>KDS Critical Timer (Minutes) *</Label>
                    <Input
                      type="number"
                      min="1"
                      max="240"
                      disabled={isReadOnly}
                      required
                      value={kdsRedMinutes}
                      onChange={(e) => setKdsRedMinutes(e.target.value)}
                    />
                    <p className="text-[10px] text-[#A1A1AA] mt-1">
                      KDS ticket timer turns critical red.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* TAX CONFIGURATION */}
            {activeTab === "taxes" && (
              <Card variant="white" className="p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-[#1E1E1E]">Tax Configuration</h3>
                    <p className="text-xs text-[#71717A] mt-0.5">
                      Configure named percentage taxes (e.g., VAT, NHIL, Tourism Levy). Each tax can be toggled without deleting. Rates are not hardcoded.
                    </p>
                  </div>
                  {!isReadOnly && (
                    <Button
                      type="button"
                      variant="blackPill"
                      size="sm"
                      onClick={handleAddTax}
                      className="gap-1.5 cursor-pointer text-xs shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Tax</span>
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {taxes.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl border border-dashed border-[#E4E4E7] bg-[#FAFAFB] text-[#71717A] text-xs">
                      <p className="font-semibold">No taxes configured (default empty).</p>
                      <p className="text-[11px] text-[#A1A1AA] mt-1">
                        Click &ldquo;Add Tax&rdquo; above to set up named percentage taxes applicable to rooms and restaurant orders.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#F4F4F6] border border-[#E4E4E7] rounded-2xl overflow-hidden bg-white">
                      {taxes.map((tax, idx) => (
                        <div
                          key={tax.id || idx}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAFAFB] transition-colors"
                        >
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-[11px]">Tax Name *</Label>
                              <Input
                                disabled={isReadOnly}
                                required
                                placeholder="e.g. VAT or Tourism Levy"
                                value={tax.name}
                                onChange={(e) => handleUpdateTax(tax.id, "name", e.target.value)}
                              />
                            </div>
                            <div>
                              <Label className="text-[11px]">Rate Percentage (%) *</Label>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                disabled={isReadOnly}
                                required
                                placeholder="e.g. 15.0 or 2.5"
                                value={tax.percentage}
                                onChange={(e) =>
                                  handleUpdateTax(
                                    tax.id,
                                    "percentage",
                                    Number.parseFloat(e.target.value) || 0
                                  )
                                }
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-4 sm:pt-4">
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#1E1E1E]">
                              <input
                                type="checkbox"
                                disabled={isReadOnly}
                                checked={tax.enabled}
                                onChange={(e) =>
                                  handleUpdateTax(tax.id, "enabled", e.target.checked)
                                }
                                className="w-4 h-4 rounded text-black focus:ring-black accent-black cursor-pointer"
                              />
                              <span>{tax.enabled ? "Active" : "Disabled"}</span>
                            </label>

                            {!isReadOnly && (
                              <Button
                                type="button"
                                variant="circularIcon"
                                size="iconSm"
                                onClick={() => handleRemoveTax(tax.id)}
                                className="w-8 h-8 text-[#71717A] hover:text-[#EF4444]"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* 1. STUDIO PROFILE */}
            {activeTab === "profile" && (
              <Card variant="white" className="p-6 sm:p-8 space-y-6">
                <div>
                  <h3 className="text-base font-bold text-[#1E1E1E]">Studio Identity & Location</h3>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    Customer-facing contact information and branding shown on bookings and receipts.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <Label>Studio Trade Name *</Label>
                    <Input
                      disabled={isReadOnly}
                      required
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Becca's Crown Beauty Vault"
                    />
                  </div>

                  <div>
                    <Label>Official Customer Phone (Ghana format) *</Label>
                    <Input
                      disabled={isReadOnly}
                      required
                      value={businessPhone}
                      onChange={(e) => setBusinessPhone(e.target.value)}
                      placeholder="e.g. +233 24 111 2233"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label>Studio Physical Address *</Label>
                    <Input
                      disabled={isReadOnly}
                      required
                      value={businessAddress}
                      onChange={(e) => setBusinessAddress(e.target.value)}
                      placeholder="e.g. 14 Senchi Street, Airport Residential Area, Accra, Ghana"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label>Google Maps Location Link</Label>
                    <Input
                      disabled={isReadOnly}
                      type="url"
                      value={businessMapLink}
                      onChange={(e) => setBusinessMapLink(e.target.value)}
                      placeholder="https://maps.google.com/?q=..."
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label>Studio Logo URL</Label>
                    <Input
                      disabled={isReadOnly}
                      value={businessLogo}
                      onChange={(e) => setBusinessLogo(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                {/* Fixed Regional Standards Callout */}
                <div className="p-4 rounded-2xl bg-[#F4F4F6] border border-[#E4E4E7] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Globe2 className="w-5 h-5 text-[#1E1E1E] shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-[#1E1E1E]">Regional Operating Standard</h4>
                      <p className="text-[11px] text-[#71717A]">
                        Operating currency and display timezone are fixed to Ghanaian statutory regulations.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-white border border-[#E4E4E7] text-xs font-bold text-[#1E1E1E]">
                      Currency: {settings.currency} (GH₵)
                    </span>
                    <span className="px-3 py-1 rounded-full bg-white border border-[#E4E4E7] text-xs font-bold text-[#1E1E1E]">
                      Timezone: {settings.timezone} (GMT)
                    </span>
                  </div>
                </div>
              </Card>
            )}

            {/* 2. OPENING HOURS */}
            {activeTab === "hours" && (
              <Card variant="white" className="p-6 sm:p-8 space-y-6">
                <div>
                  <h3 className="text-base font-bold text-[#1E1E1E]">Weekly Operating Hours</h3>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    Define studio open days and working shifts (Africa/Accra GMT timezone).
                  </p>
                </div>

                <div className="divide-y divide-[#F4F4F6]">
                  {openingHours.map((schedule, idx) => (
                    <div
                      key={schedule.day}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 w-40">
                        <input
                          type="checkbox"
                          disabled={isReadOnly}
                          checked={schedule.isOpen}
                          onChange={(e) => {
                            const updated = [...openingHours];
                            updated[idx].isOpen = e.target.checked;
                            setOpeningHours(updated);
                          }}
                          className="w-4 h-4 rounded-sm text-black cursor-pointer"
                        />
                        <span className="text-xs font-bold text-[#1E1E1E]">{schedule.day}</span>
                      </div>

                      {schedule.isOpen ? (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-[#71717A]">Open:</span>
                            <input
                              type="time"
                              disabled={isReadOnly}
                              value={schedule.openTime}
                              onChange={(e) => {
                                const updated = [...openingHours];
                                updated[idx].openTime = e.target.value;
                                setOpeningHours(updated);
                              }}
                              className="px-2.5 py-1.5 text-xs rounded-xl border border-[#E4E4E7] bg-white font-mono"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-[#71717A]">Close:</span>
                            <input
                              type="time"
                              disabled={isReadOnly}
                              value={schedule.closeTime}
                              onChange={(e) => {
                                const updated = [...openingHours];
                                updated[idx].closeTime = e.target.value;
                                setOpeningHours(updated);
                              }}
                              className="px-2.5 py-1.5 text-xs rounded-xl border border-[#E4E4E7] bg-white font-mono"
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-[#A1A1AA] font-semibold italic">
                          Closed all day
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* 3. HOLIDAYS & CLOSURES */}
            {activeTab === "holidays" && (
              <Card variant="white" className="p-6 sm:p-8 space-y-6">
                <div>
                  <h3 className="text-base font-bold text-[#1E1E1E]">Holidays & Scheduled Studio Closures</h3>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    Customers will not be able to book appointment slots on these specified dates.
                  </p>
                </div>

                {!isReadOnly && (
                  <div className="p-4 rounded-2xl bg-[#FAFAFB] border border-[#E4E4E7] space-y-3">
                    <h4 className="text-xs font-bold text-[#1E1E1E]">Add Closed Date / Holiday</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label>Date</Label>
                        <Input
                          type="date"
                          value={newHolidayDate}
                          onChange={(e) => setNewHolidayDate(e.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Holiday Name / Reason</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="e.g. Independence Day / Studio Deep Clean"
                            value={newHolidayName}
                            onChange={(e) => setNewHolidayName(e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="blackPill"
                            size="sm"
                            onClick={handleAddHoliday}
                            className="shrink-0 gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="divide-y divide-[#F4F4F6]">
                  {holidays.length === 0 ? (
                    <p className="py-6 text-xs text-[#A1A1AA] italic text-center">
                      No studio holidays recorded.
                    </p>
                  ) : (
                    holidays.map((h) => (
                      <div key={h.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <span className="font-bold text-[#1E1E1E]">{h.name}</span>
                          <span className="text-[#71717A] ml-2 font-mono">({h.date})</span>
                        </div>
                        {!isReadOnly && (
                          <Button
                            type="button"
                            variant="circularIcon"
                            size="iconSm"
                            onClick={() => handleRemoveHoliday(h.id)}
                            className="w-7 h-7 text-[#71717A] hover:text-[#EF4444]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </Card>
            )}

            {/* 4. BOOKING RULES */}
            {activeTab === "rules" && (
              <Card variant="white" className="p-6 sm:p-8 space-y-6">
                <div>
                  <h3 className="text-base font-bold text-[#1E1E1E]">Booking Engine Rules</h3>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    Controls slot intervals, notice requirements, and maximum future booking horizons.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Slot Interval */}
                  <div className="md:col-span-2 space-y-2">
                    <Label>Slot Interval (Grid Granularity) *</Label>
                    <p className="text-[11px] text-[#71717A]">
                      Determines how start times are divided in the calendar and guest booking widget.
                    </p>
                    <div className="grid grid-cols-3 gap-3 max-w-md pt-1">
                      {[15, 30, 60].map((interval) => (
                        <button
                          key={interval}
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => setSlotIntervalMinutes(interval as SlotIntervalMinutes)}
                          className={cn(
                            "py-2.5 px-3 rounded-2xl text-xs font-bold border transition-all text-center cursor-pointer",
                            slotIntervalMinutes === interval
                              ? "bg-[#1E1E1E] text-white border-[#1E1E1E] shadow-xs"
                              : "bg-white text-[#71717A] border-[#E4E4E7] hover:border-[#1E1E1E]"
                          )}
                        >
                          {interval} Minutes
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Minimum Booking Notice (Hours) *</Label>
                    <Input
                      type="number"
                      min="1"
                      max="72"
                      disabled={isReadOnly}
                      required
                      value={minimumNoticeHours}
                      onChange={(e) => setMinimumNoticeHours(e.target.value)}
                    />
                    <p className="text-[10px] text-[#A1A1AA] mt-1">
                      Customers cannot book appointments with less than {minimumNoticeHours}h advance notice.
                    </p>
                  </div>

                  <div>
                    <Label>Maximum Booking Advance (Days) *</Label>
                    <Input
                      type="number"
                      min="7"
                      max="365"
                      disabled={isReadOnly}
                      required
                      value={maxDaysAhead}
                      onChange={(e) => setMaxDaysAhead(e.target.value)}
                    />
                    <p className="text-[10px] text-[#A1A1AA] mt-1">
                      Calendar availability extends up to {maxDaysAhead} days into the future.
                    </p>
                  </div>

                  <div>
                    <Label>Temporary Slot Hold Duration (Minutes) *</Label>
                    <Input
                      type="number"
                      min="5"
                      max="60"
                      disabled={isReadOnly}
                      required
                      value={slotHoldMinutes}
                      onChange={(e) => setSlotHoldMinutes(e.target.value)}
                    />
                    <p className="text-[10px] text-[#A1A1AA] mt-1">
                      Locks selected slot during Paystack checkout before releasing it if unpaid.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* 5. CANCELLATION POLICY */}
            {activeTab === "policy" && (
              <Card variant="white" className="p-6 sm:p-8 space-y-6">
                <div>
                  <h3 className="text-base font-bold text-[#1E1E1E]">Cancellation & Reschedule Policy</h3>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    Define cutoffs and deposit refund rules for guest cancellations.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <Label>Free Cancellation Cutoff (Hours before appointment) *</Label>
                    <Input
                      type="number"
                      min="1"
                      max="168"
                      disabled={isReadOnly}
                      required
                      value={cancellationNoticeHours}
                      onChange={(e) => setCancellationNoticeHours(e.target.value)}
                    />
                    <p className="text-[10px] text-[#A1A1AA] mt-1">
                      Free cancellation permitted until {cancellationNoticeHours} hours before start time.
                    </p>
                  </div>

                  <div>
                    <Label>Deposit Refund Policy *</Label>
                    <select
                      disabled={isReadOnly}
                      value={depositRefundPolicy}
                      onChange={(e) => setDepositRefundPolicy(e.target.value as DepositRefundPolicy)}
                      className="w-full h-10 px-3 text-xs rounded-2xl bg-white border border-[#E4E4E7] focus:outline-hidden focus:border-[#1E1E1E]"
                    >
                      <option value="FULL_REFUND_BEFORE_CUTOFF">
                        Full Refund before cutoff; Non-refundable after
                      </option>
                      <option value="PARTIAL_50">
                        50% Refund before cutoff; Non-refundable after
                      </option>
                      <option value="NON_REFUNDABLE">
                        Strictly Non-Refundable (Credit voucher only)
                      </option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <Label>Public Policy Statement *</Label>
                    <textarea
                      rows={4}
                      disabled={isReadOnly}
                      required
                      value={cancellationPolicyText}
                      onChange={(e) => setCancellationPolicyText(e.target.value)}
                      className="w-full p-3 text-xs rounded-2xl bg-white border border-[#E4E4E7] focus:outline-hidden focus:border-[#1E1E1E]"
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* 6. PAYMENT KEYS (OWNER ONLY) */}
            {activeTab === "payments" && (
              <Card variant="white" className="p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[#1E1E1E]">Paystack Gateway Credentials</h3>
                    <p className="text-xs text-[#71717A] mt-0.5">
                      Ghana Mobile Money and Card processing keys. Stored encrypted with AES-256-GCM.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-600" />
                    <span>Owner Access Only</span>
                  </span>
                </div>

                {!isOwner ? (
                  <div className="p-6 rounded-2xl bg-[#F4F4F6] border border-[#E4E4E7] text-center space-y-2">
                    <Lock className="w-6 h-6 text-[#71717A] mx-auto" />
                    <h4 className="text-xs font-bold text-[#1E1E1E]">Credentials Restricted</h4>
                    <p className="text-xs text-[#71717A] max-w-md mx-auto">
                      Payment gateway secrets are locked to Owner / Administrator accounts for security
                      compliance. Contact the Studio Owner to update Paystack keys.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Payment keys are authenticated and stored encrypted on the server. Values below are masked for security.
                      </span>
                    </div>

                    <div>
                      <Label>Paystack Public Key (Client-Safe)</Label>
                      <Input
                        value={paystackPublicKey}
                        onChange={(e) => setPaystackPublicKey(e.target.value)}
                        placeholder="pk_live_..."
                      />
                    </div>

                    <div>
                      <Label>Paystack Secret Key (Server-Only)</Label>
                      <Input
                        type="password"
                        value={paystackSecretKey}
                        onChange={(e) => setPaystackSecretKey(e.target.value)}
                        placeholder="sk_live_..."
                      />
                      <p className="text-[10px] text-[#A1A1AA] mt-1">
                        To keep existing encrypted key, leave masked value intact. Enter a new key only when rotating credentials.
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* 7. SMS CONFIGURATION */}
            {activeTab === "sms" && (
              <Card variant="white" className="p-6 sm:p-8 space-y-6">
                <div>
                  <h3 className="text-base font-bold text-[#1E1E1E]">Ghana SMS Sender ID</h3>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    Sender title that appears on client appointment confirmations and reminder texts.
                  </p>
                </div>

                <div className="max-w-md space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="mb-0">Alphanumeric Sender ID *</Label>
                    <span className="text-[11px] font-mono text-[#71717A]">
                      {smsSenderId.length} / 11 chars
                    </span>
                  </div>
                  <Input
                    disabled={isReadOnly}
                    maxLength={11}
                    required
                    value={smsSenderId}
                    onChange={(e) => setSmsSenderId(e.target.value.toUpperCase())}
                    placeholder="e.g. GhanaAndBeyond"
                    className="font-mono tracking-wider"
                  />
                  <p className="text-[10px] text-[#A1A1AA]">
                    Ghana National Communications Authority (NCA) standard: maximum 11 characters, no special symbols.
                  </p>
                </div>
              </Card>
            )}

            {/* 8. NOTIFICATION TEMPLATES */}
            {activeTab === "notifications" && (
              <NotificationTemplateEditor isManagerOrAbove={!isReadOnly} />
            )}

            {/* Bottom Save Button Bar */}
            {!isReadOnly && (
              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  variant="blackPill"
                  size="md"
                  disabled={saving}
                  className="gap-2 cursor-pointer shadow-md"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? "Saving Changes..." : "Save All Changes"}</span>
                </Button>
              </div>
            )}
          </form>
        )}
      </div>
    </AppShell>
    </RoleGuard>
  );
}
