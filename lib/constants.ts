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

/** Extra grace window after escrow release time before flagging held orders (ms). */
export const HELD_ORDER_ALERT_GRACE_MS = 60 * 60 * 1000; // 1 hour

/** Lookback window for payout failure alert counting (ms). */
export const PAYOUT_FAILURE_ALERT_LOOKBACK_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Minimum spacing between repeated alert notifications for the same alert (ms). */
export const ALERT_NOTIFICATION_DEDUPE_MS = 60 * 60 * 1000; // 1 hour

/** Minimum spacing between repeated escalations for the same alert (ms). */
export const ALERT_ESCALATION_REPEAT_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Time an open critical alert can remain unresolved before escalation (ms). */
export const CRITICAL_ALERT_ESCALATION_MS = 30 * 60 * 1000; // 30 minutes

/** Time an open high alert can remain unresolved before escalation (ms). */
export const HIGH_ALERT_ESCALATION_MS = 2 * 60 * 60 * 1000; // 2 hours

/** Time an open critical alert can remain unacknowledged before SLA breach (ms). */
export const CRITICAL_ALERT_ACK_SLA_MS = 15 * 60 * 1000; // 15 minutes

/** Time an open high alert can remain unacknowledged before SLA breach (ms). */
export const HIGH_ALERT_ACK_SLA_MS = 60 * 60 * 1000; // 60 minutes

/** Persistent critical unacknowledged duration before owner escalates to tech lead (ms). */
export const CRITICAL_ALERT_PERSISTENT_ROUTE_MS = 60 * 60 * 1000; // 60 minutes

/** Persistent high unacknowledged duration before owner escalates to tech lead (ms). */
export const HIGH_ALERT_PERSISTENT_ROUTE_MS = 4 * 60 * 60 * 1000; // 4 hours

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

// ─── Operational Alert Thresholds ───────────────────────────────────────────

/** Alert when overdue held orders (without active complaints) reach this count. */
export const OVERDUE_HELD_ORDERS_ALERT_THRESHOLD = 3;

/** Alert when payout failures in lookback window reach this count. */
export const PAYOUT_FAILURE_ALERT_THRESHOLD = 3;

/** Alert when accepted/in-review complaints past deadline reach this count. */
export const OVERDUE_COMPLAINTS_ALERT_THRESHOLD = 2;

// ─── Cron Job Tracking ──────────────────────────────────────────────────────

/** Names of all registered cron jobs — used for health checks. */
export const CRON_JOB_NAMES = [
  "auto-reject-bookings",
  "process-payouts",
  "release-payouts",
  "no-show",
  "monitor-abuse",
  "audit-integrity",
  "monitor-operational-health",
  "notify-system-alerts",
] as const;

export type CronJobName = (typeof CRON_JOB_NAMES)[number];
