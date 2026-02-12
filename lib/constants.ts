/**
 * Centralized business rules and configuration constants.
 *
 * All magic numbers that govern platform behavior live here so they are
 * visible in one place and easy to adjust without hunting through route
 * handlers and utility files.
 */

// ─── Financial ──────────────────────────────────────────────────────────────

/** Default platform commission rate applied when no explicit value is stored. */
export const DEFAULT_PLATFORM_COMMISSION_RATE = 0.05; // 5%

/** Booking fee amount in INR (charged upfront to seekers). */
export const BOOKING_FEE_INR = 149;

// ─── Escrow & Payouts ───────────────────────────────────────────────────────

/** Time after delivery confirmation before escrow funds are released (ms). */
export const ESCROW_RELEASE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Stale payout processing threshold — payouts older than this are flagged (ms). */
export const STALE_PAYOUT_CUTOFF_MS = 15 * 60 * 1000; // 15 minutes

// ─── Booking & Scheduling ───────────────────────────────────────────────────

/** Minimum advance notice for pickup scheduling (ms). */
export const MIN_PICKUP_ADVANCE_MS = 48 * 60 * 60 * 1000; // 48 hours

// ─── Complaints ─────────────────────────────────────────────────────────────

/** Window after delivery in which a seeker can file a complaint (ms). */
export const COMPLAINT_FILING_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Auth & Sessions ────────────────────────────────────────────────────────

/** Maximum session duration (seconds). */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

// ─── Abuse Monitoring ───────────────────────────────────────────────────────

/** Lookback window for counting cancellations (days). */
export const ABUSE_LOOKBACK_DAYS = 30;

/** Number of cancellations within the lookback window that triggers a flag. */
export const EXCESSIVE_CANCELLATION_THRESHOLD = 3;

// ─── Cron Job Tracking ──────────────────────────────────────────────────────

/** Names of all registered cron jobs — used for health checks. */
export const CRON_JOB_NAMES = [
  "auto-reject-bookings",
  "process-payouts",
  "release-payouts",
  "no-show",
  "monitor-abuse",
  "audit-integrity",
] as const;

export type CronJobName = (typeof CRON_JOB_NAMES)[number];
