"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { unwrapApiArray } from "@/lib/client-api";

type PollingOptions<T> = {
  /** API endpoint to fetch from */
  url: string;
  /** Initial data from SSR (avoids flash of empty) */
  initialData: T[];
  /**
   * How often to poll in ms when there are "active" items.
   * Defaults to 8000ms.
   */
  activeIntervalMs?: number;
  /**
   * How often to poll in ms when nothing is actively changing.
   * Defaults to 30000ms.
   */
  idleIntervalMs?: number;
  /**
   * Callback that receives current data and returns true when
   * the data has items that may change soon (triggers activeIntervalMs).
   * If omitted, always uses activeIntervalMs.
   */
  isActive?: (data: T[]) => boolean;
};

type PollingResult<T> = {
  data: T[];
  loading: boolean;
  error: string | null;
  /** Call to force an immediate re-fetch right now */
  refresh: () => void;
};

/**
 * useLiveData — smart client-side polling hook.
 *
 * Features:
 * - Starts with SSR `initialData` so there is no empty flash on mount.
 * - Polls the given `url` on an interval; updates React state in-place
 *   (no full page re-render, no scroll-to-top, no flash).
 * - Pauses polling while the browser tab is hidden; fires an immediate
 *   fetch the moment the tab becomes visible again.
 * - Uses `activeIntervalMs` when `isActive(data)` is true (e.g. bookings
 *   are pending), and `idleIntervalMs` otherwise, to save bandwidth.
 */
export function useLiveData<T>({
  url,
  initialData,
  activeIntervalMs = 8_000,
  idleIntervalMs = 30_000,
  isActive,
}: PollingOptions<T>): PollingResult<T> {
  const [data, setData] = useState<T[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep a stable ref to the latest data so the interval closure never stales.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Stable fetch function — never changes identity.
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return; // silently ignore transient failures
      const payload = await res.json();
      const fresh = unwrapApiArray<T>(payload);
      setData(fresh);
      setError(null);
    } catch {
      // Network error — don't wipe existing data; just note the error.
      setError("Failed to fetch latest data");
    } finally {
      setLoading(false);
    }
  }, [url]);

  // Expose a manual refresh that also shows the loading indicator.
  const refresh = useCallback(() => {
    setLoading(true);
    void fetchData();
  }, [fetchData]);

  // Main polling effect.
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null;

    function scheduleNext() {
      if (timerId) clearTimeout(timerId);
      // Don't poll while the tab is hidden.
      if (document.hidden) return;

      const interval =
        !isActive || isActive(dataRef.current)
          ? activeIntervalMs
          : idleIntervalMs;

      timerId = setTimeout(() => {
        void fetchData().then(scheduleNext);
      }, interval);
    }

    // Initial fetch on mount (replaces the SSR snapshot with fresh data).
    void fetchData().then(scheduleNext);

    // When the tab becomes visible again, re-fetch immediately then resume.
    function handleVisibilityChange() {
      if (!document.hidden) {
        if (timerId) clearTimeout(timerId);
        void fetchData().then(scheduleNext);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timerId) clearTimeout(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, activeIntervalMs, idleIntervalMs]);
  // NOTE: `isActive` is intentionally excluded from deps — it's a stable
  // predicate defined inline by the caller; re-creating the whole interval
  // chain every render is more disruptive than using the ref trick above.

  return { data, loading, error, refresh };
}
