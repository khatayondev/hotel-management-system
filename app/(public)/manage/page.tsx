"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Shield, ArrowRight, Smartphone, AlertCircle, Crown } from "lucide-react";

export default function ManageLookupPage() {
  const router = useRouter();
  const [reference, setReference] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [useOtp, setUseOtp] = React.useState(false);
  const [otpCode, setOtpCode] = React.useState("");
  const [otpSent, setOtpSent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  const handleSendOtp = async () => {
    if (!reference.trim() || !phone.trim()) {
      setError("Please provide both your booking reference and phone number.");
      return;
    }
    setError(null);
    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/manage/lookup/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: reference.trim().toUpperCase(),
          phone: phone.trim(),
          action: "send",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to send verification SMS.");
      }

      setOtpSent(true);
      setStatusMessage("A 6-digit verification code has been sent to your phone via SMS.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send code.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference.trim() || !phone.trim()) {
      setError("Please enter both your booking reference and phone number.");
      return;
    }

    if (useOtp && !otpCode.trim()) {
      setError("Please enter the 6-digit verification code sent to your phone.");
      return;
    }

    setError(null);
    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/manage/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: reference.trim().toUpperCase(),
          phone: phone.trim(),
          otp: useOtp ? otpCode.trim() : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Booking not found.");
      }

      if (json.data?.manageUrl) {
        router.push(json.data.manageUrl);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to locate booking.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 py-16 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full space-y-8 relative z-10">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold tracking-wider uppercase mb-2">
            <Shield className="w-3.5 h-3.5" /> Guest Self-Service Portal
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight text-white">
            Manage Your Stay
          </h1>
          <p className="text-sm text-neutral-400">
            Enter your reservation reference and phone number to view stay details, settle balances, adjust dates, or cancel.
          </p>
        </div>

        <div className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs sm:text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
              <div>{error}</div>
            </div>
          )}

          {statusMessage && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs sm:text-sm flex items-start gap-3">
              <Shield className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
              <div>{statusMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                Reservation Reference
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-neutral-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. RES-2026-X7Y9 or BK-..."
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 uppercase font-mono tracking-wider transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                Phone Number (Ghana / International)
              </label>
              <div className="relative">
                <Smartphone className="w-4 h-4 absolute left-3.5 top-3.5 text-neutral-500" />
                <input
                  type="tel"
                  required
                  placeholder="e.g. 0241234567 or +233..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition"
                />
              </div>
            </div>

            {/* Optional OTP toggle */}
            <div className="pt-2 border-t border-neutral-800/60">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">Require SMS OTP security</span>
                <button
                  type="button"
                  onClick={() => {
                    setUseOtp(!useOtp);
                    setOtpSent(false);
                    setOtpCode("");
                  }}
                  className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition ${
                    useOtp
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                      : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {useOtp ? "Enabled" : "Optional"}
                </button>
              </div>

              {useOtp && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="6-digit code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-white text-center font-mono tracking-widest focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      disabled={loading || !reference || !phone}
                      onClick={handleSendOtp}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 disabled:opacity-50 shrink-0 transition"
                    >
                      {otpSent ? "Resend" : "Send Code"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-neutral-950 font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer transition"
            >
              {loading ? (
                <span>Locating Booking...</span>
              ) : (
                <>
                  <span>Access Booking Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="text-center text-xs text-neutral-500 pt-2 border-t border-neutral-800/80">
            Received a private link via SMS or Email? You can click it directly to manage without logging in.
          </div>
        </div>
      </div>
    </div>
  );
}
