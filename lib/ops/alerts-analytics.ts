const DAY_MS = 24 * 60 * 60 * 1000;

export type AlertAnalyticsInput = {
  createdAt?: Date | string;
  resolvedAt?: Date | string;
};

export type AlertTrendPoint = {
  date: string; // YYYY-MM-DD (UTC)
  opened: number;
  resolved: number;
};

export type AlertBurnRateTier = "stable" | "watch" | "high" | "critical";

export type AlertAnalytics = {
  trend7d: AlertTrendPoint[];
  openedLast24h: number;
  openedBaseline7d: number;
  baselineOpenedDailyAvg: number;
  burnRate: number;
  burnRateTier: AlertBurnRateTier;
  mttrHours7d: number | null;
  resolvedCount7d: number;
};

function toDate(value: Date | string | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toTwoDecimals(value: number): number {
  return Number(value.toFixed(2));
}

function burnRateTier(value: number): AlertBurnRateTier {
  if (value >= 4) return "critical";
  if (value >= 2) return "high";
  if (value > 1) return "watch";
  return "stable";
}

export function buildAlertAnalytics(
  alerts: AlertAnalyticsInput[],
  now = new Date(),
): AlertAnalytics {
  const nowTs = now.getTime();
  const last24hStart = new Date(nowTs - DAY_MS);
  const baselineStart = new Date(nowTs - 8 * DAY_MS);
  const trendStartDay = startOfUtcDay(new Date(nowTs - 6 * DAY_MS));

  const trendMap = new Map<string, AlertTrendPoint>();
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(trendStartDay.getTime() + i * DAY_MS);
    const key = utcDayKey(day);
    trendMap.set(key, { date: key, opened: 0, resolved: 0 });
  }

  let openedLast24h = 0;
  let openedBaseline7d = 0;
  let resolvedCount7d = 0;
  let totalResolutionMs7d = 0;

  for (const raw of alerts) {
    const createdAt = toDate(raw.createdAt);
    const resolvedAt = toDate(raw.resolvedAt);

    if (createdAt) {
      if (createdAt >= last24hStart) {
        openedLast24h += 1;
      } else if (createdAt >= baselineStart && createdAt < last24hStart) {
        openedBaseline7d += 1;
      }

      if (createdAt >= trendStartDay) {
        const key = utcDayKey(createdAt);
        const bucket = trendMap.get(key);
        if (bucket) {
          bucket.opened += 1;
        }
      }
    }

    if (resolvedAt) {
      if (resolvedAt >= trendStartDay) {
        const key = utcDayKey(resolvedAt);
        const bucket = trendMap.get(key);
        if (bucket) {
          bucket.resolved += 1;
        }
      }

      if (resolvedAt >= trendStartDay && createdAt && resolvedAt >= createdAt) {
        resolvedCount7d += 1;
        totalResolutionMs7d += resolvedAt.getTime() - createdAt.getTime();
      }
    }
  }

  const baselineOpenedDailyAvg = openedBaseline7d / 7;
  const burnRateDenominator = Math.max(baselineOpenedDailyAvg, 1);
  const burnRate = openedLast24h / burnRateDenominator;
  const mttrHours7d =
    resolvedCount7d > 0
      ? toTwoDecimals(totalResolutionMs7d / resolvedCount7d / (60 * 60 * 1000))
      : null;

  return {
    trend7d: Array.from(trendMap.values()),
    openedLast24h,
    openedBaseline7d,
    baselineOpenedDailyAvg: toTwoDecimals(baselineOpenedDailyAvg),
    burnRate: toTwoDecimals(burnRate),
    burnRateTier: burnRateTier(burnRate),
    mttrHours7d,
    resolvedCount7d,
  };
}
