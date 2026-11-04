"use client";

import * as React from "react";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveSyncIndicatorProps {
  isRefreshing: boolean;
  lastRefreshedAt: Date | null;
  onRefresh: () => void;
  className?: string;
  variant?: "badge" | "minimal" | "button";
}

export function LiveSyncIndicator({
  isRefreshing,
  lastRefreshedAt,
  onRefresh,
  className,
  variant = "badge",
}: LiveSyncIndicatorProps) {
  const [relativeTime, setRelativeTime] = React.useState<string>("Live");
  const [isOnline, setIsOnline] = React.useState(true);

  // Monitor online status
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Update relative time every 5 seconds
  React.useEffect(() => {
    const updateTime = () => {
      if (!lastRefreshedAt) {
        setRelativeTime("Live");
        return;
      }

      const diffSec = Math.floor((Date.now() - lastRefreshedAt.getTime()) / 1000);
      if (diffSec < 5) {
        setRelativeTime("Just now");
      } else if (diffSec < 60) {
        setRelativeTime(`${diffSec}s ago`);
      } else {
        const diffMin = Math.floor(diffSec / 60);
        setRelativeTime(`${diffMin}m ago`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 5000);
    return () => clearInterval(interval);
  }, [lastRefreshedAt]);

  if (!isOnline) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 select-none",
          className
        )}
        title="Device is offline. Will automatically reconnect when internet is restored."
      >
        <WifiOff className="w-3 h-3 text-red-500 animate-pulse" />
        <span>Offline</span>
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        title={`Auto-synced: ${relativeTime}. Click to refresh now.`}
        className={cn(
          "inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer",
          className
        )}
      >
        <RefreshCw className={cn("w-3 h-3", isRefreshing && "animate-spin text-amber-500")} />
        <span>{isRefreshing ? "Syncing..." : relativeTime}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={isRefreshing}
      title={`Auto-refresh active (30s interval + on focus). Last synced: ${relativeTime}. Click to refresh immediately.`}
      className={cn(
        "inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer select-none",
        isRefreshing
          ? "bg-amber-50 text-amber-800 border-amber-200/80 shadow-xs"
          : "bg-white/80 hover:bg-white text-zinc-700 border-zinc-200/80 hover:border-zinc-300 shadow-xs hover:shadow-sm",
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        {isRefreshing ? (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        ) : (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
        )}
        <span
          className={cn(
            "relative inline-flex rounded-full h-2 w-2",
            isRefreshing ? "bg-amber-500" : "bg-emerald-500"
          )}
        />
      </span>

      <span className="text-zinc-600 font-medium">
        {isRefreshing ? "Syncing..." : relativeTime}
      </span>

      <RefreshCw
        className={cn(
          "w-3 h-3 text-zinc-400 hover:text-zinc-700 transition-all ml-0.5",
          isRefreshing && "animate-spin text-amber-600"
        )}
      />
    </button>
  );
}

