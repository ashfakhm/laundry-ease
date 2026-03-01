/**
 * Centralized business rules and configuration constants.
 *
 * All magic numbers that govern platform behavior live here so they are
 * visible in one place and easy to adjust without hunting through route
 * handlers and utility files.
 */

// ─── Financials ─────────────────────────────────────────────────────────────

export const PLATFORM_COMMISSION_RATE = 0.05; // 5%

// ─── Telemetry & Geography ──────────────────────────────────────────────────

export const MAX_ARRIVAL_DISTANCE_METERS = 200;

// ─── Security ───────────────────────────────────────────────────────────────

export const BCRYPT_SALT_ROUNDS = 10;

/** Booking fee amount in INR (charged upfront to seekers). */
export const BOOKING_FEE_INR = 50;

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
export const MIN_PICKUP_ADVANCE_MS = 2 * 60 * 60 * 1000; // 2 hours

/** Duration a seeker is blocked after cancelling a paid order (ms). */
export const SEEKER_CANCELLATION_BLOCK_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Delivery OTP validity window (ms). */
export const DELIVERY_OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─── File Upload Limits ─────────────────────────────────────────────────────

/** Maximum profile image file size (bytes). */
export const MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB

/** Maximum file size for evidence, invoice, and general uploads (bytes). */
export const MAX_UPLOAD_FILE_BYTES = 5 * 1024 * 1024; // 5MB

/** Maximum number of evidence photos per complaint. */
export const MAX_EVIDENCE_FILES = 5;

/** Razorpay checkout script URL. */
export const RAZORPAY_CHECKOUT_SCRIPT_URL =
  "https://checkout.razorpay.com/v1/checkout.js";

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

/** Lookback window for alert analytics on the admin dashboard (ms). */
export const ALERT_ANALYTICS_WINDOW_MS = 8 * 24 * 60 * 60 * 1000; // 8 days

/** Alert when overdue held orders (without active complaints) reach this count. */
export const OVERDUE_HELD_ORDERS_ALERT_THRESHOLD = 3;

/** Alert when payout failures in lookback window reach this count. */
export const PAYOUT_FAILURE_ALERT_THRESHOLD = 3;

/** Alert when accepted/in-review complaints past deadline reach this count. */
export const OVERDUE_COMPLAINTS_ALERT_THRESHOLD = 2;

// ─── Rate Limiting ──────────────────────────────────────────────────────────

/** Default rate limit window — standard API endpoints (ms). */
export const RATE_LIMIT_DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute

/** Strict rate limit window — sensitive operations like accept/reject/cancel (ms). */
export const RATE_LIMIT_STRICT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/** Aggressive rate limit window — auth/OTP endpoints (ms). */
export const RATE_LIMIT_AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// ─── Lock Timeouts ──────────────────────────────────────────────────────────

/** Refund lock timeout — max duration a refund lock is held before considered stale (ms). */
export const REFUND_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/** Payout lock TTL — max duration a payout processing lock is held (ms). */
export const PAYOUT_LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Cron Job Tracking ──────────────────────────────────────────────────────

/** Names of all registered cron jobs — used for health checks. */
export const CRON_JOB_NAMES = [
  "auto-reject-bookings",
  "process-payouts",
  "no-show",
  "monitor-abuse",
  "audit-integrity",
  "monitor-operational-health",
  "notify-system-alerts",
  "process-email-outbox",
  "reconciliation",
] as const;

export type CronJobName = (typeof CRON_JOB_NAMES)[number];
