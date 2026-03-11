"use client";

import {
  useEffect,
  useEffectEvent,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { unwrapApiArray } from "@/lib/client-api";

async function syncLiveData<T>({
  url,
  setData,
  setError,
  setLoading,
}: {
  url: string;
  setData: Dispatch<SetStateAction<T[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
}) {
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
}

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

  const fetchData = useEffectEvent(async () => {
    await syncLiveData<T>({ url, setData, setError, setLoading });
  });

  const getPollInterval = useEffectEvent(() =>
    !isActive || isActive(data) ? activeIntervalMs : idleIntervalMs,
  );

  const refresh = () => {
    setLoading(true);
    void syncLiveData<T>({ url, setData, setError, setLoading });
  };

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let isDisposed = false;

    const scheduleNext = () => {
      if (isDisposed) return;
      if (timerId) clearTimeout(timerId);
      if (document.hidden) return;

      timerId = setTimeout(() => {
        void fetchData().then(() => {
          if (!isDisposed) {
            scheduleNext();
          }
        });
      }, getPollInterval());
    };

    const refetchAndSchedule = async () => {
      await fetchData();
      if (!isDisposed) {
        scheduleNext();
      }
    };

    void refetchAndSchedule();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (timerId) clearTimeout(timerId);
        return;
      }

      if (timerId) clearTimeout(timerId);
      void refetchAndSchedule();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isDisposed = true;
      if (timerId) clearTimeout(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [url, activeIntervalMs, idleIntervalMs]);

  return { data, loading, error, refresh };
}
