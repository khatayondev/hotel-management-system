"use client";

import * as React from "react";
import { Download, Share2, PlusSquare, Smartphone, Laptop, Check, Sparkles, Monitor, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog-and-drawer";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function InstallPwaButton({
  variant = "sidebar",
  collapsed = false,
  className,
}: {
  variant?: "sidebar" | "header" | "login" | "minimal";
  collapsed?: boolean;
  className?: string;
}) {
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = React.useState(false);
  const [showInstructions, setShowInstructions] = React.useState(false);
  const [installedSuccess, setInstalledSuccess] = React.useState(false);
  const [platform, setPlatform] = React.useState<"ios" | "android" | "mac" | "windows" | "other">("other");

  React.useEffect(() => {
    // 1. Check if already running as installed standalone app
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsStandalone(isStandaloneMode);

    // 2. Platform detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIos =
      /iphone|ipad|ipod/.test(userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /android/.test(userAgent);
    const isMac = /macintosh|mac os x/.test(userAgent) && !isIos;
    const isWindows = /windows/.test(userAgent);

    if (isIos) setPlatform("ios");
    else if (isAndroid) setPlatform("android");
    else if (isMac) setPlatform("mac");
    else if (isWindows) setPlatform("windows");
    else setPlatform("other");

    // 3. Check early global capture variable
    const earlyPrompt = (window as unknown as { __pwaInstallPrompt?: BeforeInstallPromptEvent }).__pwaInstallPrompt;
    if (earlyPrompt) {
      setDeferredPrompt(earlyPrompt);
    }

    // 4. Listen for browser install prompt & custom early capture event
    const handlePromptEvent = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleCustomPromptEvent = (e: Event) => {
      const customEvent = e as CustomEvent<BeforeInstallPromptEvent>;
      if (customEvent.detail) {
        setDeferredPrompt(customEvent.detail);
      }
    };

    window.addEventListener("beforeinstallprompt", handlePromptEvent);
    window.addEventListener("pwa-prompt-available", handleCustomPromptEvent);

    window.addEventListener("appinstalled", () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setInstalledSuccess(true);
      setTimeout(() => setInstalledSuccess(false), 6000);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePromptEvent);
      window.removeEventListener("pwa-prompt-available", handleCustomPromptEvent);
    };
  }, []);

  const handleInstallClick = async () => {
    // Re-check early prompt if state was somehow unset
    const prompt = deferredPrompt || (window as unknown as { __pwaInstallPrompt?: BeforeInstallPromptEvent }).__pwaInstallPrompt;

    if (prompt) {
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === "accepted") {
          setDeferredPrompt(null);
          (window as unknown as { __pwaInstallPrompt?: null }).__pwaInstallPrompt = null;
          setInstalledSuccess(true);
          return;
        }
      } catch (err) {
        console.debug("PWA prompt error:", err);
      }
    }

    // Fall back to dedicated device/browser visual instructions
    setShowInstructions(true);
  };

  // If already installed and running in standalone window, hide
  if (isStandalone && !installedSuccess) {
    return null;
  }

  // Login page variant
  if (variant === "login") {
    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm cursor-pointer",
            "bg-zinc-900 text-white hover:bg-black border border-white/10 hover:scale-[1.02] active:scale-[0.98]",
            className
          )}
          title="Install Becca's Crown Dashboard as a dedicated tablet or desktop app"
        >
          {installedSuccess ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Dashboard App Installed!</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4 text-amber-400" />
              <span>Install Tablet / Desktop App</span>
              <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white/15 text-zinc-200">
                PWA
              </span>
            </>
          )}
        </button>

        <DashboardInstallModal
          open={showInstructions}
          onClose={() => setShowInstructions(false)}
          platform={platform}
          hasPrompt={Boolean(deferredPrompt)}
          onPrompt={handleInstallClick}
        />
      </>
    );
  }

  // Header variant
  if (variant === "header") {
    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#1E1E1E] text-white hover:bg-black transition-all shadow-xs border border-white/10 cursor-pointer",
            className
          )}
          title="Install Becca's Crown Dashboard on tablet or computer"
        >
          {installedSuccess ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Installed</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Install App</span>
            </>
          )}
        </button>

        <DashboardInstallModal
          open={showInstructions}
          onClose={() => setShowInstructions(false)}
          platform={platform}
          hasPrompt={Boolean(deferredPrompt)}
          onPrompt={handleInstallClick}
        />
      </>
    );
  }

  // Sidebar variant (Default)
  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        title="Install Becca's Crown Dashboard (PWA)"
        className={cn(
          "transition-all text-white bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 shadow-xs cursor-pointer flex items-center justify-center",
          collapsed
            ? "w-10 h-10 mx-auto rounded-full"
            : "w-full gap-3 px-3.5 py-2.5 rounded-full text-xs font-semibold",
          className
        )}
      >
        <Download className="w-4 h-4 shrink-0 text-amber-400" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">Install Dashboard App</span>
            <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md bg-white/10 text-zinc-300">
              PWA
            </span>
          </>
        )}
      </button>

      <DashboardInstallModal
        open={showInstructions}
        onClose={() => setShowInstructions(false)}
        platform={platform}
        hasPrompt={Boolean(deferredPrompt)}
        onPrompt={handleInstallClick}
      />
    </>
  );
}

function DashboardInstallModal({
  open,
  onClose,
  platform,
  hasPrompt,
  onPrompt,
}: {
  open: boolean;
  onClose: () => void;
  platform: "ios" | "android" | "mac" | "windows" | "other";
  hasPrompt: boolean;
  onPrompt: () => void;
}) {
  return (
    <Dialog isOpen={open} onClose={onClose} title="Install Becca's Crown Dashboard">
      <div className="space-y-4 py-2">
        {/* Banner */}
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#09090b] text-white border border-white/10 shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-black border border-amber-400/30 flex items-center justify-center shrink-0 shadow-inner">
            <span className="text-sm font-black text-amber-400 tracking-wider">BC</span>
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Becca&apos;s Crown Studio Dashboard</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Dedicated app for iPad, Tablet, Reception Desk &amp; Laptop
            </div>
          </div>
        </div>

        {/* If native prompt is available, surface 1-click install button */}
        {hasPrompt && (
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-between">
            <div className="text-xs text-amber-900 font-semibold">
              Ready to install with 1 click:
            </div>
            <Button
              variant="blackPill"
              size="sm"
              onClick={onPrompt}
              className="gap-1.5 text-xs font-bold shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Install Now</span>
            </Button>
          </div>
        )}

        {/* Platform Specific Step Instructions */}
        <div className="space-y-2.5 text-xs text-[#374151]">
          {platform === "ios" ? (
            /* iPad / iPhone Safari */
            <>
              <div className="flex items-center gap-1.5 text-xs font-black text-zinc-900 pb-1">
                <Tablet className="w-4 h-4 text-zinc-700" />
                <span>Installation for iPad &amp; iPhone (Safari):</span>
              </div>
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/70">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-black text-white font-bold text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <div className="leading-relaxed">
                  Tap the <Share2 className="w-3.5 h-3.5 inline mx-1 text-blue-600" />{" "}
                  <strong>Share button</strong> in Safari (at the top right on iPad, or bottom bar on iPhone).
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/70">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-black text-white font-bold text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <div className="leading-relaxed">
                  Scroll down the share sheet and tap{" "}
                  <strong className="inline-flex items-center gap-1 font-bold text-zinc-950">
                    <PlusSquare className="w-3.5 h-3.5 text-zinc-950" /> Add to Home Screen
                  </strong>
                  .
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/70">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-black text-white font-bold text-[10px] shrink-0 mt-0.5">
                  3
                </span>
                <div className="leading-relaxed">
                  Tap <strong>Add</strong> in the top right. The Crown Dashboard icon will be placed directly onto your home screen!
                </div>
              </div>
            </>
          ) : platform === "android" ? (
            /* Android Tablet or Phone */
            <>
              <div className="flex items-center gap-1.5 text-xs font-black text-zinc-900 pb-1">
                <Smartphone className="w-4 h-4 text-zinc-700" />
                <span>Installation for Android Tablet / Phone:</span>
              </div>
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/70">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-black text-white font-bold text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <div className="leading-relaxed">
                  Tap the <strong>three vertical dots (⋮)</strong> in Chrome at the top right.
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/70">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-black text-white font-bold text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <div className="leading-relaxed">
                  Select <strong>&quot;Install app&quot;</strong> (or <strong>&quot;Add to Home screen&quot;</strong>).
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/70">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-black text-white font-bold text-[10px] shrink-0 mt-0.5">
                  3
                </span>
                <div className="leading-relaxed">
                  Tap <strong>Install</strong> to confirm.
                </div>
              </div>
            </>
          ) : (
            /* Desktop / Laptop / Mac / Windows */
            <>
              <div className="flex items-center gap-1.5 text-xs font-black text-zinc-900 pb-1">
                <Monitor className="w-4 h-4 text-zinc-700" />
                <span>Installation for Computer &amp; Tablet (Chrome / Edge / Safari):</span>
              </div>
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/70">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-black text-white font-bold text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <div className="leading-relaxed">
                  <strong>In Chrome or Edge:</strong> Look at the right side of the address bar at the top of your browser for the{" "}
                  <strong className="inline-flex items-center gap-1 text-zinc-950 font-bold">
                    <Download className="w-3.5 h-3.5 text-amber-600" /> Install Icon
                  </strong>
                  .
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/70">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-black text-white font-bold text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <div className="leading-relaxed">
                  <strong>Or via Menu:</strong> Click the browser menu (<strong>⋮</strong> in Chrome or <strong>…</strong> in Edge) &rarr; select{" "}
                  <strong>&quot;Install Becca&apos;s Crown Studio Dashboard...&quot;</strong>.
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/70">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-black text-white font-bold text-[10px] shrink-0 mt-0.5">
                  3
                </span>
                <div className="leading-relaxed">
                  Click <strong>Install</strong>. The dashboard will open in its own standalone, distraction-free window!
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-between border-t border-zinc-200">
          <span className="text-[11px] text-zinc-500">
            Works offline for calendar &amp; POS
          </span>
          <Button variant="blackPill" size="sm" onClick={onClose} className="text-xs font-bold">
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
