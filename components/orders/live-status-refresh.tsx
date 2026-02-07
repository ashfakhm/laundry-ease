"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_INTERVAL_MS = 20000;

export function LiveStatusRefresh({
  enabled,
  intervalMs = DEFAULT_INTERVAL_MS,
}: {
  enabled: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const timer = window.setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, router]);

  if (!enabled) return null;

  return (
    <p className="text-xs font-medium text-muted-foreground mt-1">
      Live updates are on. Refreshing every 20 seconds.
    </p>
  );
}
