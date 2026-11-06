"use client";

import * as React from "react";
import { Download, Check, Sparkles, Monitor, Smartphone, Tablet, RefreshCw, X, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog-and-drawer";
import { BrandLogo } from "@/components/ui/brand-logo";

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
  const [installedSuccess, setInstalledSuccess] = React.useState(false);
  const [showHelperModal, setShowHelperModal] = React.useState(false);
  const [browserType, setBrowserType] = React.useState<"chrome" | "safari-mac" | "safari-ios" | "edge" | "other">("other");
  const [isRefreshingWorker, setIsRefreshingWorker] = React.useState(false);

  React.useEffect(() => {
    // 1. Detect if running inside standalone installed window
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsStandalone(standalone);

    // 2. Check if installed via getInstalledRelatedApps (Chrome 80+)
    if ("getInstalledRelatedApps" in navigator) {
      (navigator as unknown as { getInstalledRelatedApps: () => Promise<unknown[]> })
        .getInstalledRelatedApps()
        .then((apps) => {
          if (apps && apps.length > 0) {
            setIsStandalone(true);
          }
        })
        .catch(() => {});
    }

    // 3. Detect browser & device platform
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isEdge = /edg/.test(ua);
    const isChrome = /chrome|chromium/.test(ua) && !isEdge;
    const isSafariMac = /safari/.test(ua) && !isChrome && !isEdge && !isIos;

    if (isIos) setBrowserType("safari-ios");
    else if (isSafariMac) setBrowserType("safari-mac");
    else if (isEdge) setBrowserType("edge");
    else if (isChrome) setBrowserType("chrome");
    else setBrowserType("other");

    // 4. Capture early install prompt from window global
    const early = (window as unknown as { __pwaInstallPrompt?: BeforeInstallPromptEvent | null }).__pwaInstallPrompt;
    if (early) {
      setDeferredPrompt(early);
    }

    // 5. Listen for events
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<BeforeInstallPromptEvent>).detail;
      if (detail) {
        setDeferredPrompt(detail);
      }
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("pwa-prompt-available", onCustom);

    window.addEventListener("appinstalled", () => {
      setDeferredPrompt(null);
      (window as unknown as { __pwaInstallPrompt?: null }).__pwaInstallPrompt = null;
      setIsStandalone(true);
      setInstalledSuccess(true);
      setShowHelperModal(false);
      setTimeout(() => setInstalledSuccess(false), 8000);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("pwa-prompt-available", onCustom);
    };
  }, []);

  const handleInstallClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check prompt in state or window global
    const prompt =
      deferredPrompt ||
      (window as unknown as { __pwaInstallPrompt?: BeforeInstallPromptEvent | null }).__pwaInstallPrompt;

    if (prompt) {
      try {
        prompt.prompt().catch((err) => {
          console.error("Install prompt error:", err);
        });

        prompt.userChoice.then((choice) => {
          if (choice.outcome === "accepted") {
            setInstalledSuccess(true);
            setDeferredPrompt(null);
            (window as unknown as { __pwaInstallPrompt?: null }).__pwaInstallPrompt = null;
            setShowHelperModal(false);
          }
        });
        return;
      } catch (err) {
        console.error("Error invoking prompt:", err);
      }
    }

    // If native prompt is not dispatched yet, open the install guide
    setShowHelperModal(true);
  };

  const handleRefreshServiceWorker = async () => {
    setIsRefreshingWorker(true);
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.update();
        }
      }
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch {
      window.location.reload();
    }
  };

  // If already installed and running inside standalone window, hide
  if (isStandalone && !installedSuccess) {
    return null;
  }

  // Login page variant
  if (variant === "login") {
    return (
      <>
        <div className="w-full flex flex-col items-center">
          <button
            type="button"
            onClick={handleInstallClick}
            className={cn(
              "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm cursor-pointer",
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
        </div>

        <InstallHelperModal
          open={showHelperModal}
          onClose={() => setShowHelperModal(false)}
          browserType={browserType}
          onRefresh={handleRefreshServiceWorker}
          isRefreshing={isRefreshingWorker}
        />
      </>
    );
  }

  // Header variant
  if (variant === "header") {
    return (
      <>
        <div className="relative inline-flex items-center">
          <button
            type="button"
            onClick={handleInstallClick}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#1E1E1E] text-white hover:bg-black transition-all shadow-xs border border-white/10 cursor-pointer",
              className
            )}
            title="Install Crown Dashboard on tablet or computer"
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
        </div>

        <InstallHelperModal
          open={showHelperModal}
          onClose={() => setShowHelperModal(false)}
          browserType={browserType}
          onRefresh={handleRefreshServiceWorker}
          isRefreshing={isRefreshingWorker}
        />
      </>
    );
  }

  // Sidebar variant (Default)
  return (
    <>
      <div className="w-full">
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
          {installedSuccess ? (
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <Download className="w-4 h-4 shrink-0 text-amber-400" />
          )}

          {!collapsed && (
            <>
              <span className="flex-1 text-left">
                {installedSuccess ? "Dashboard Installed" : "Install Dashboard App"}
              </span>
              <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md bg-white/10 text-zinc-300">
                PWA
              </span>
            </>
          )}
        </button>
      </div>

      <InstallHelperModal
        open={showHelperModal}
        onClose={() => setShowHelperModal(false)}
        browserType={browserType}
        onRefresh={handleRefreshServiceWorker}
        isRefreshing={isRefreshingWorker}
      />
    </>
  );
}

function InstallHelperModal({
  open,
  onClose,
  browserType,
  onRefresh,
  isRefreshing,
}: {
  open: boolean;
  onClose: () => void;
  browserType: "chrome" | "safari-mac" | "safari-ios" | "edge" | "other";
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <Dialog isOpen={open} onClose={onClose} title="Install Studio Dashboard">
      <div className="space-y-4 py-2 text-zinc-900">
        {/* Banner */}
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-black text-white border border-white/10 shadow-md">
          <div className="w-11 h-11 rounded-xl bg-zinc-900 border border-amber-400/40 flex items-center justify-center shrink-0 p-1.5">
            <BrandLogo variant="mark" theme="gold" size="xs" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Becca&apos;s Crown Studio Dashboard</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Fast standalone app for iPad, Reception Tablets &amp; Laptops
            </div>
          </div>
        </div>

        {/* Browser Specific Instructions */}
        <div className="space-y-3 text-xs">
          {browserType === "chrome" ? (
            /* Chrome Browser */
            <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/90 space-y-2.5">
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 font-medium text-[11px] leading-relaxed">
                🚀 <strong>App Already Installed?</strong> Look at the right end of your Chrome address bar: if you see the pill <strong>&quot;Open in app&quot;</strong>, Crown Dashboard is already installed on your computer! Click it to launch the standalone window immediately.
              </div>
              <div className="flex items-center gap-2 font-black text-zinc-950 pb-1 border-b border-zinc-200">
                <Monitor className="w-4 h-4 text-amber-500" />
                <span>To Reinstall or Setup Fresh:</span>
              </div>
              <div className="space-y-2 text-zinc-700 leading-relaxed">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-950 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Click the <strong>three vertical dots (⋮)</strong> at the top-right of your Chrome window.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-950 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Hover over <strong>&quot;Save and share&quot;</strong> (or view main menu).
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-950 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Click <strong>&quot;Install Becca&apos;s Crown Studio Dashboard...&quot;</strong> (or <em>&quot;Open in Becca&apos;s Crown...&quot;</em> if already on your Mac).
                  </span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-zinc-200/80 text-[11px] text-zinc-500">
                💡 You can also launch it anytime from your <strong>Mac Applications</strong> folder, <strong>Mac Dock</strong>, or Chrome Apps (<code>chrome://apps</code>).
              </div>
            </div>
          ) : browserType === "edge" ? (
            /* Microsoft Edge */
            <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/90 space-y-2.5">
              <div className="flex items-center gap-2 font-black text-zinc-950 pb-1 border-b border-zinc-200">
                <Monitor className="w-4 h-4 text-blue-500" />
                <span>How to Install in Microsoft Edge:</span>
              </div>
              <div className="space-y-2 text-zinc-700 leading-relaxed">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-950 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>Click the <strong>three horizontal dots (…)</strong> at top-right.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-950 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>Select <strong>&quot;Apps&quot;</strong> &rarr; <strong>&quot;Install this site as an app&quot;</strong>.</span>
                </div>
              </div>
            </div>
          ) : browserType === "safari-mac" ? (
            /* Safari on Mac */
            <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/90 space-y-2.5">
              <div className="flex items-center gap-2 font-black text-zinc-950 pb-1 border-b border-zinc-200">
                <Monitor className="w-4 h-4 text-zinc-700" />
                <span>How to Install in Mac Safari:</span>
              </div>
              <div className="space-y-2 text-zinc-700 leading-relaxed">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-950 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>In your Mac top menu bar, click <strong>File</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-950 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Select <strong>&quot;Add to Dock...&quot;</strong> and click <strong>Add</strong>. The app icon will appear right in your Mac Dock!
                  </span>
                </div>
              </div>
            </div>
          ) : browserType === "safari-ios" ? (
            /* iPad or iPhone */
            <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/90 space-y-2.5">
              <div className="flex items-center gap-2 font-black text-zinc-950 pb-1 border-b border-zinc-200">
                <Tablet className="w-4 h-4 text-zinc-700" />
                <span>How to Install on iPad &amp; Tablet:</span>
              </div>
              <div className="space-y-2 text-zinc-700 leading-relaxed">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-950 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>Tap Safari&apos;s <strong>Share button</strong> (box with upward arrow).</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-950 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong> &rarr; <strong>Add</strong>.</span>
                </div>
              </div>
            </div>
          ) : (
            /* Other Browsers */
            <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/90 text-zinc-700 text-xs">
              Open the browser menu and select <strong>&quot;Install App&quot;</strong> or <strong>&quot;Add to Home Screen&quot;</strong>.
            </div>
          )}
        </div>

        {/* Footer with Refresh/Sync action */}
        <div className="pt-2 flex items-center justify-between border-t border-zinc-200">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="text-[11px] font-semibold text-zinc-600 hover:text-zinc-950 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={cn("w-3 h-3", isRefreshing && "animate-spin")} />
            <span>Sync PWA Cache</span>
          </button>

          <Button variant="blackPill" size="sm" onClick={onClose} className="text-xs font-bold">
            Got It
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
