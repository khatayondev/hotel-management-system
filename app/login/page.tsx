"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Crown, Lock, ArrowRight, ShieldCheck, KeyRound, Zap, Eye, EyeOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label, Input } from "@/components/ui/controls";
import { InstallPwaButton } from "@/components/pwa/install-pwa-button";

const DEMO_ACCOUNTS = [
  {
    role: "Owner / Admin",
    name: "Becca Addo",
    email: "owner@beccascrownbeauty.com",
    password: "BeccaCrown2026!Admin",
    badge: "Full Access",
  },
  {
    role: "Front Desk (Tablet)",
    name: "Front Desk Tablet",
    email: "frontdesk@beccascrownbeauty.com",
    password: "FrontDesk2026!Tablet",
    badge: "Salon Tablet",
  },
  {
    role: "Manager",
    name: "Kojo Mensah",
    email: "manager@beccascrownbeauty.com",
    password: "ManagerCrown2026!",
    badge: "Operations",
  },
  {
    role: "Receptionist",
    name: "Abena Serwaa",
    email: "reception@beccascrownbeauty.com",
    password: "ReceptionCrown2026!",
    badge: "Front Desk",
  },
] as const;

function StaffLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect") || "/dashboard";

  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [selectedDemoRole, setSelectedDemoRole] = React.useState<string | null>(null);
  const [totpCode, setTotpCode] = React.useState("");
  const [requiresTotp, setRequiresTotp] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Forced password change modal
  const [mustChangePassword, setMustChangePassword] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordChangeLoading, setPasswordChangeLoading] = React.useState(false);

  function fillDemoCredentials(acc: typeof DEMO_ACCOUNTS[number]) {
    setIdentifier(acc.email);
    setPassword(acc.password);
    setSelectedDemoRole(acc.role);
    setError(null);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
          totpCode: requiresTotp ? totpCode.trim() : undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json?.error?.message || "Invalid credentials. Please verify your details.");
        return;
      }

      if (json.data?.requiresTotp) {
        setRequiresTotp(true);
        setError(null);
        return;
      }

      if (json.data?.requiresPasswordChange) {
        setMustChangePassword(true);
        return;
      }

      router.push(redirectTarget);
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPasswordChangeLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json?.error?.message || "Failed to update password.");
        return;
      }

      router.push(redirectTarget);
      router.refresh();
    } catch {
      setError("An error occurred while updating your password.");
    } finally {
      setPasswordChangeLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-swirl">
      <div className="w-full max-w-md">
        {/* Branding header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#1E1E1E] text-white flex items-center justify-center mx-auto mb-3 shadow-md">
            <Crown className="w-6 h-6 text-amber-300" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#1E1E1E] tracking-tight">
            Staff Portal
          </h1>
          <p className="text-xs text-[#71717A] mt-1">
            Becca&apos;s Crown • Accra, Ghana
          </p>
        </div>

        {/* Login or First-Login Password Change Card */}
        <Card variant="glass" className="p-6 sm:p-8 shadow-xl">
          {/* Quick Auto-Fill Demo Accounts */}
          {!mustChangePassword && !requiresTotp && (
            <div className="mb-6 p-3.5 rounded-2xl bg-neutral-50/80 border border-neutral-200/70 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E1E1E]">
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span>Quick Demo Login (Click to Auto-fill)</span>
                </div>
                <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-neutral-200/70 text-neutral-600">
                  Dev/Test
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {DEMO_ACCOUNTS.map((acc) => {
                  const isSelected = selectedDemoRole === acc.role;
                  return (
                    <button
                      key={acc.role}
                      type="button"
                      onClick={() => fillDemoCredentials(acc)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between group ${
                        isSelected
                          ? "bg-white border-[#1E1E1E] shadow-sm ring-1 ring-[#1E1E1E]"
                          : "bg-white/80 border-neutral-200/80 hover:bg-white hover:border-neutral-300"
                      }`}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[#1E1E1E] truncate">
                            {acc.role}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-100 text-[#71717A] font-medium">
                            {acc.badge}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#71717A] font-mono truncate mt-0.5">
                          {acc.email}
                        </span>
                      </div>

                      <div className="shrink-0 flex items-center">
                        {isSelected ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>Filled</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-neutral-500 group-hover:text-[#1E1E1E] bg-neutral-100/80 group-hover:bg-neutral-100 px-2 py-1 rounded-lg transition-colors">
                            Fill
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3.5 mb-5 rounded-2xl bg-[#FEF2F2] border border-[#FEE2E2] text-xs font-semibold text-[#991B1B]">
              {error}
            </div>
          )}

          {!mustChangePassword ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="identifier">Email or Ghana Phone</Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="owner@beccascrownbeauty.com or 024 111 2233"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setSelectedDemoRole(null);
                  }}
                  required
                  disabled={loading || requiresTotp}
                  autoComplete="username"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="text-[11px] text-[#71717A] hover:text-[#1E1E1E] flex items-center gap-1 transition-colors"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Hide</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Show</span>
                      </>
                    )}
                  </button>
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setSelectedDemoRole(null);
                  }}
                  required
                  disabled={loading || requiresTotp}
                  autoComplete="current-password"
                />
              </div>

              {requiresTotp && (
                <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#1E1E1E]" />
                    <Label htmlFor="totpCode">Two-Factor Authentication Code</Label>
                  </div>
                  <Input
                    id="totpCode"
                    type="text"
                    inputMode="numeric"
                    placeholder="6-digit authenticator code"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    required
                    maxLength={6}
                    autoFocus
                  />
                  <p className="text-[11px] text-[#71717A] mt-1">
                    Enter the code from your Google Authenticator or 1Password app.
                  </p>
                </div>
              )}

              <Button
                type="submit"
                variant="blackPill"
                size="md"
                className="w-full mt-2 gap-2 shadow-sm"
                disabled={loading}
              >
                {loading ? (
                  <span>Authenticating...</span>
                ) : requiresTotp ? (
                  <>
                    <span>Verify Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Sign In</span>
                  </>
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-[#FFFBEB] border border-[#FEF3C7] text-xs font-medium text-[#92400E]">
                <KeyRound className="w-4 h-4 shrink-0" />
                <span>Security Notice: You must set a new password on your first login.</span>
              </div>

              <div>
                <Label htmlFor="newPassword">New Password (8+ characters)</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                />
              </div>

              <Button
                type="submit"
                variant="blackPill"
                size="md"
                className="w-full mt-2"
                disabled={passwordChangeLoading}
              >
                {passwordChangeLoading ? "Updating..." : "Update Password & Continue"}
              </Button>
            </form>
          )}

          <div className="pt-6 mt-6 border-t border-black/5 text-center text-xs text-[#71717A]">
            <p>Customers do not need accounts to book.</p>
            <p className="mt-1">
              Authorized salon personnel only. All access attempts are audit logged.
            </p>
          </div>
        </Card>

        {/* Salon Tablet / Desktop App Installation Button */}
        <div className="mt-4 flex flex-col items-center">
          <InstallPwaButton variant="login" className="w-full justify-center" />
        </div>
      </div>
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-swirl flex items-center justify-center text-xs text-[#71717A]">
          Loading portal...
        </div>
      }
    >
      <StaffLoginForm />
    </React.Suspense>
  );
}

