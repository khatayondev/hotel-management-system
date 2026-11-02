"use client";

import * as React from "react";

export interface SmartPollingOptions {
  /**
   * Periodic polling interval in milliseconds while tab is active and visible.
   * Default: 30000 (30 seconds)
   */
  intervalMs?: number;

  /**
   * Whether auto-refresh is active.
   * Default: true
   */
  enabled?: boolean;

  /**
   * Revalidate immediately when the browser tab gains focus or screen turns on.
   * Default: true
   */
  revalidateOnFocus?: boolean;

  /**
   * Revalidate when device recovers internet connectivity.
   * Default: true
   */
  revalidateOnReconnect?: boolean;

  /**
   * Minimum time in ms between focus-triggered refreshes to avoid spamming on rapid alt-tab.
   * Default: 5000 (5 seconds)
   */
  minFocusThrottleMs?: number;

  /**
   * Optional custom sync topic tag (e.g. "bookings", "overview").
   * Default: "all"
   */
  syncTopic?: string;
}

/**
 * Triggers a real-time instant revalidation across all active tabs, windows, and components.
 * Call this whenever a local mutation happens (e.g., booking created, status updated, checked in).
 */
export function triggerGlobalDataSync(topic: string = "all") {
  if (typeof window === "undefined") return;

  // 1. Same-window custom event
  try {
    window.dispatchEvent(
      new CustomEvent("beccas_data_sync", {
        detail: { topic, timestamp: Date.now() },
      })
    );
  } catch {}

  // 2. Cross-tab BroadcastChannel
  try {
    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel("beccas_sync_channel");
      bc.postMessage({ topic, timestamp: Date.now() });
      bc.close();
    }
  } catch {}
}

/**
 * Smart SWR Polling Hook:
 * - 0 unnecessary cloud costs: pauses completely when tab is hidden or backgrounded.
 * - Revalidates on window focus / device wake-up.
 * - Revalidates on network reconnect.
 * - Listens for local and cross-tab mutations to refresh immediately.
 */
export function useSmartPolling(
  callback: () => void | Promise<void>,
  options: SmartPollingOptions = {}
) {
  const {
    intervalMs = 30000,
    enabled = true,
    revalidateOnFocus = true,
    revalidateOnReconnect = true,
    minFocusThrottleMs = 5000,
    syncTopic = "all",
  } = options;

  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = React.useState<Date | null>(null);

  // Stable callback ref to prevent interval resets when callback identity changes
  const callbackRef = React.useRef(callback);
  React.useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Track timestamps
  const lastRunRef = React.useRef<number>(0);
  const isRunningRef = React.useRef<boolean>(false);

  const executeRefresh = React.useCallback(async () => {
    if (!enabled || isRunningRef.current) return;

    isRunningRef.current = true;
    setIsRefreshing(true);
    try {
      await callbackRef.current();
      const now = Date.now();
      lastRunRef.current = now;
      setLastRefreshedAt(new Date(now));
    } catch (err) {
      console.debug("Smart polling refresh error:", err);
    } finally {
      isRunningRef.current = false;
      setIsRefreshing(false);
    }
  }, [enabled]);

  // 1. Timer-based interval polling (only runs when document is visible)
  React.useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    let timer: NodeJS.Timeout | null = null;

    const startTimer = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          executeRefresh();
        }
      }, intervalMs);
    };

    if (typeof document === "undefined" || document.visibilityState === "visible") {
      startTimer();
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [enabled, intervalMs, executeRefresh]);

  // 2. Visibility change listener (pause when hidden, resume & catch-up when visible)
  React.useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - lastRunRef.current;
        // If more than the interval has elapsed since last refresh, revalidate immediately
        if (elapsed >= intervalMs) {
          executeRefresh();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, intervalMs, executeRefresh]);

  // 3. Window Focus listener (revalidate immediately when staff clicks into app)
  React.useEffect(() => {
    if (!enabled || !revalidateOnFocus || typeof window === "undefined") return;

    const handleFocus = () => {
      const elapsed = Date.now() - lastRunRef.current;
      if (elapsed >= minFocusThrottleMs) {
        executeRefresh();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [enabled, revalidateOnFocus, minFocusThrottleMs, executeRefresh]);

  // 4. Online/Reconnect listener
  React.useEffect(() => {
    if (!enabled || !revalidateOnReconnect || typeof window === "undefined") return;

    const handleOnline = () => {
      executeRefresh();
    };

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [enabled, revalidateOnReconnect, executeRefresh]);

  // 5. Cross-tab & local sync listener
  React.useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const handleCustomSync = (e: Event) => {
      const detail = (e as CustomEvent<{ topic?: string }>).detail;
      if (!detail?.topic || detail.topic === "all" || detail.topic === syncTopic) {
        executeRefresh();
      }
    };

    window.addEventListener("beccas_data_sync", handleCustomSync);

    let bc: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      try {
        bc = new BroadcastChannel("beccas_sync_channel");
        bc.onmessage = (msgEvent) => {
          const topic = msgEvent.data?.topic;
          if (!topic || topic === "all" || topic === syncTopic) {
            executeRefresh();
          }
        };
      } catch {}
    }

    return () => {
      window.removeEventListener("beccas_data_sync", handleCustomSync);
      if (bc) {
        try {
          bc.close();
        } catch {}
      }
    };
  }, [enabled, syncTopic, executeRefresh]);

  return {
    isRefreshing,
    lastRefreshedAt,
    refresh: executeRefresh,
  };
}
