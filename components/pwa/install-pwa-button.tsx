"use client";

import * as React from "react";
import { Download, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [isInstalling, setIsInstalling] = React.useState(false);
  const [installedSuccess, setInstalledSuccess] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    // 1. Check if already running as installed standalone app
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsStandalone(isStandaloneMode);

    // 2. Check early global capture variable
    const earlyPrompt = (window as unknown as { __pwaInstallPrompt?: BeforeInstallPromptEvent }).__pwaInstallPrompt;
    if (earlyPrompt) {
      setDeferredPrompt(earlyPrompt);
    }

    // 3. Listen for browser install prompt & custom early capture event
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
      (window as unknown as { __pwaInstallPrompt?: null }).__pwaInstallPrompt = null;
      setIsStandalone(true);
      setInstalledSuccess(true);
      setIsInstalling(false);
      setTimeout(() => setInstalledSuccess(false), 8000);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePromptEvent);
      window.removeEventListener("pwa-prompt-available", handleCustomPromptEvent);
    };
  }, []);

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isInstalling || installedSuccess) return;

    setIsInstalling(true);
    setNotice(null);

    // 1. Check current state or window global
    let prompt: BeforeInstallPromptEvent | null | undefined =
      deferredPrompt ||
      (window as unknown as { __pwaInstallPrompt?: BeforeInstallPromptEvent | null }).__pwaInstallPrompt;

    // 2. If prompt is not ready yet, wait up to 1.5 seconds for it to fire
    if (!prompt) {
      prompt = await new Promise<BeforeInstallPromptEvent | null>((resolve) => {
        let finished = false;

        const onEvent = (ev: Event) => {
          if (finished) return;
          finished = true;
          window.removeEventListener("beforeinstallprompt", onEvent);
          window.removeEventListener("pwa-prompt-available", onCustomEvent);
          const p = (ev as CustomEvent).detail || ev;
          resolve(p as BeforeInstallPromptEvent);
        };

        const onCustomEvent = (ev: Event) => onEvent(ev);

        window.addEventListener("beforeinstallprompt", onEvent);
        window.addEventListener("pwa-prompt-available", onCustomEvent);

        setTimeout(() => {
          if (!finished) {
            finished = true;
            window.removeEventListener("beforeinstallprompt", onEvent);
            window.removeEventListener("pwa-prompt-available", onCustomEvent);
            const fallback = (window as unknown as { __pwaInstallPrompt?: BeforeInstallPromptEvent }).__pwaInstallPrompt || null;
            resolve(fallback);
          }
        }, 1200);
      });
    }

    // 3. If prompt is available, trigger native browser install automatically
    if (prompt) {
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === "accepted") {
          setInstalledSuccess(true);
          setDeferredPrompt(null);
          (window as unknown as { __pwaInstallPrompt?: null }).__pwaInstallPrompt = null;
        }
      } catch (err) {
        console.error("Install prompt error:", err);
      } finally {
        setIsInstalling(false);
      }
      return;
    }

    // 4. If browser doesn't expose programmatic install (e.g. Safari on Mac/iOS or Firefox)
    setIsInstalling(false);
    const ua = window.navigator.userAgent.toLowerCase();
    const isSafari = /safari/.test(ua) && !/chrome|chromium|edg/.test(ua);
    const isIos = /iphone|ipad|ipod/.test(ua);

    if (isIos) {
      setNotice("On iPad/iPhone Safari: Tap Share (box with arrow) > 'Add to Home Screen'");
    } else if (isSafari) {
      setNotice("On Mac Safari: Select File > 'Add to Dock' to install");
    } else {
      setNotice("Click the Install icon at the right edge of your browser URL bar");
    }

    setTimeout(() => setNotice(null), 6000);
  };

  // If already installed and running inside standalone window, hide
  if (isStandalone && !installedSuccess) {
    return null;
  }

  // Login page variant
  if (variant === "login") {
    return (
      <div className="w-full flex flex-col items-center">
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={isInstalling}
          className={cn(
            "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm cursor-pointer",
            "bg-zinc-900 text-white hover:bg-black border border-white/10 hover:scale-[1.02] active:scale-[0.98]",
            isInstalling && "opacity-80 cursor-wait",
            className
          )}
          title="Automatically install Becca's Crown Dashboard as a dedicated tablet or desktop app"
        >
          {installedSuccess ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Dashboard App Installed!</span>
            </>
          ) : isInstalling ? (
            <>
              <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
              <span>Opening Installer...</span>
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

        {notice && (
          <p className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-xl mt-2 text-center animate-in fade-in">
            {notice}
          </p>
        )}
      </div>
    );
  }

  // Header variant
  if (variant === "header") {
    return (
      <div className="relative inline-flex items-center">
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={isInstalling}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#1E1E1E] text-white hover:bg-black transition-all shadow-xs border border-white/10 cursor-pointer",
            isInstalling && "opacity-80 cursor-wait",
            className
          )}
          title="Install Crown Dashboard on tablet or computer"
        >
          {installedSuccess ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Installed</span>
            </>
          ) : isInstalling ? (
            <>
              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span>Installing...</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Install App</span>
            </>
          )}
        </button>

        {notice && (
          <div className="absolute top-full right-0 mt-1.5 w-64 p-2 rounded-xl bg-black text-white text-[11px] leading-tight shadow-xl border border-white/10 z-50 animate-in fade-in">
            {notice}
          </div>
        )}
      </div>
    );
  }

  // Sidebar variant (Default)
  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleInstallClick}
        disabled={isInstalling}
        title="Install Becca's Crown Dashboard (PWA)"
        className={cn(
          "transition-all text-white bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 shadow-xs cursor-pointer flex items-center justify-center",
          collapsed
            ? "w-10 h-10 mx-auto rounded-full"
            : "w-full gap-3 px-3.5 py-2.5 rounded-full text-xs font-semibold",
          isInstalling && "opacity-80 cursor-wait",
          className
        )}
      >
        {installedSuccess ? (
          <Check className="w-4 h-4 shrink-0 text-emerald-400" />
        ) : isInstalling ? (
          <Loader2 className="w-4 h-4 shrink-0 text-amber-400 animate-spin" />
        ) : (
          <Download className="w-4 h-4 shrink-0 text-amber-400" />
        )}

        {!collapsed && (
          <>
            <span className="flex-1 text-left">
              {installedSuccess
                ? "Dashboard Installed"
                : isInstalling
                ? "Opening Installer..."
                : "Install Dashboard App"}
            </span>
            <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md bg-white/10 text-zinc-300">
              PWA
            </span>
          </>
        )}
      </button>

      {notice && !collapsed && (
        <p className="text-[10px] text-zinc-400 px-2 mt-1.5 leading-snug animate-in fade-in">
          {notice}
        </p>
      )}
    </div>
  );
}
