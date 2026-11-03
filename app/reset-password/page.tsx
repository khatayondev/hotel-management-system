"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Crown, Lock, KeyRound, Eye, EyeOff, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label, Input } from "@/components/ui/controls";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Password reset token is missing. Please request a new link from your studio administrator.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please ensure both fields are identical.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.trim(),
          newPassword,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json?.error?.message || "Password reset failed or link has expired.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Network error occurred while resetting password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F4F6] flex items-center justify-center p-4 antialiased">
      <div className="w-full max-w-md">
        {/* Brand Banner */}
        <div className="text-center mb-6 space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-2xl bg-black border border-white/10 text-white flex items-center justify-center font-bold text-sm shadow-md group-hover:scale-105 transition-transform">
              <Crown className="w-5 h-5 text-amber-300" />
            </div>
            <div className="text-left">
              <span className="text-xs font-black tracking-wider uppercase block text-[#1E1E1E]">
                BECCA&apos;S CROWN
              </span>
              <span className="text-[10px] text-[#71717A] uppercase tracking-widest block font-semibold">
                Beauty Vault • Studio Access
              </span>
            </div>
          </Link>
        </div>

        <Card className="p-6 sm:p-8 bg-white rounded-3xl border border-black/5 shadow-xl">
          {success ? (
            <div className="text-center space-y-4 py-2">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-black text-[#1E1E1E]">Password Reset Successful!</h2>
                <p className="text-xs text-[#71717A] max-w-xs mx-auto">
                  Your studio account password has been updated. You can now log in with your new credentials.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  variant="blackPill"
                  size="md"
                  className="w-full gap-2 text-xs font-bold"
                  onClick={() => router.push("/login")}
                >
                  <span>Go to Staff Login</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-6 space-y-1">
                <h2 className="text-xl font-black text-[#1E1E1E] tracking-tight">Set New Password</h2>
                <p className="text-xs text-[#71717A]">
                  Enter a new strong password below to regain access to the studio portal.
                </p>
              </div>

              {!token && (
                <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Missing Reset Token</strong>
                    This link is missing a security token. Please ask your studio administrator to send or generate a new reset link.
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="newPassword">New Password (8+ characters) *</Label>
                  <div className="relative mt-1">
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#1E1E1E] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password *</Label>
                  <div className="relative mt-1">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#1E1E1E] cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="blackPill"
                  size="md"
                  className="w-full mt-2 font-bold text-xs"
                  disabled={loading || !token}
                >
                  <Lock className="w-3.5 h-3.5 mr-1.5" />
                  {loading ? "Updating Password..." : "Update Password & Continue"}
                </Button>
              </form>
            </div>
          )}

          <div className="pt-5 mt-6 border-t border-black/5 flex items-center justify-between text-xs text-[#71717A]">
            <Link href="/login" className="hover:text-[#1E1E1E] underline font-medium">
              Return to Staff Login
            </Link>
            <Link href="/" className="hover:text-[#1E1E1E] font-medium">
              Home
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#F4F4F6] flex items-center justify-center text-xs text-[#71717A]">
          Loading password reset...
        </div>
      }
    >
      <ResetPasswordForm />
    </React.Suspense>
  );
}

