# LaundryEase Operations Runbook

**Version:** 2026-03-02
**Scope:** Payment, escrow, complaint, payout, alerting, and reliability-critical operational response

---

## 1. Purpose

This runbook defines how to detect, triage, and resolve production incidents for LaundryEase critical paths:

- Payment capture and verification
- Escrow hold/release with complaint gating
- Payout and refund execution (including split settlements)
- Complaint lifecycle and resolution
- Operational health monitoring and alert delivery
- Email outbox processing
- Data integrity and reconciliation
- Cron job health

---

## 2. Ownership Model

### Primary Owners

| Owner | Responsibilities |
| --- | --- |
| **Platform Admin On-Call** (`platform_admin_oncall`) | Complaint operations, manual case actions, user communication, alert acknowledgement |
| **Backend On-Call** (`backend_oncall`) | API/cron/webhook failures, payout/refund orchestration, database consistency, index failures |

### Escalation Owners

| Owner | Responsibilities |
| --- | --- |
| **Tech Lead** (`tech_lead`) | Sev-1 coordination, architectural decisions, hotfix approval, persistent alert escalation target |
| **Product Owner** | User-impact decisions, incident communication alignment |

### Automatic Owner Routing

The `/api/cron/notify-system-alerts` cron automatically routes unacknowledged alerts:

- **Critical alerts** (SLA breached after 15 min): auto-assigned to `backend_oncall`
- **High alerts** (SLA breached after 60 min): load-balanced between `platform_admin_oncall` and `backend_oncall`
- **Persistent critical** (unacknowledged 60+ min): escalated to `tech_lead`
- **Persistent high** (unacknowledged 4+ hours): escalated to `tech_lead`

---

## 3. Severity Definitions

| Severity | Definition | Examples | Response Target |
| --- | --- | --- | --- |
| `SEV-1` | Core money or availability path broken for many users | Failed global payment verification, stuck payout pipeline, complaint resolution blocked system-wide, critical DB index failure | Acknowledge in 15 min, mitigate in 60 min |
| `SEV-2` | High-impact partial outage or financial inconsistency risk | Repeated payout failures for subset of orders, webhook lag causing delayed state sync, email outbox backlog growing, overdue complaint deadline breaches | Acknowledge in 30 min, mitigate in 4 hrs |
| `SEV-3` | Degraded but non-critical behavior | Elevated retry noise, delayed non-critical cron jobs, UI metric inconsistencies, CSP violation spikes | Acknowledge in 1 business day |

---

## 4. Core Alerts and Triggers

### 4.1 Automated System Alerts

The `/api/cron/monitor-operational-health` cron (hourly) evaluates three operational signals and creates/updates `system_alerts` documents:

| Signal Key | Severity | Threshold | Description |
| --- | --- | --- | --- |
| `overdue_held_orders` | `critical` | ≥ 3 | Orders in `payment_status=held` past `escrow_release_at` + 1h grace, without active complaints blocking release |
| `payout_failures_spike` | `high` | ≥ 3 | Payout failures (`payout_failure_at` set) within the last 24 hours |
| `overdue_complaints` | `high` | ≥ 2 | Complaints in `accepted`/`in_review` status past their `response_deadline` |

Thresholds are defined in `lib/constants.ts` and can be adjusted:

- `OVERDUE_HELD_ORDERS_ALERT_THRESHOLD` (default: 3)
- `PAYOUT_FAILURE_ALERT_THRESHOLD` (default: 3)
- `OVERDUE_COMPLAINTS_ALERT_THRESHOLD` (default: 2)

### 4.2 Index Failure Alerts

During startup, `lib/db-indexes.ts` creates 30+ indexes. If a critical index fails (e.g., due to pre-existing duplicate data), a `system_alert` is created with key `index_failure_{collection}_{indexName}`.

In production, critical index failures cause the application to refuse startup unless `ALLOW_START_WITH_INDEX_ERRORS=1` is set.

### 4.3 Payment and Escrow Alerts

Watch for:

- Spike in `payment verification failed` API responses
- Growth in orders stuck in `payment_status=held` beyond expected release window (`ESCROW_RELEASE_WINDOW_MS` = 24h)
- Repeated payout statuses with failure reasons (`payout_failure_reason` populated)
- Refunds requested but missing `razorpay_refund_id` after processing window
- Refund lock contention (`refund_in_progress_at` not being cleared, stale locks past `REFUND_LOCK_TIMEOUT_MS` = 5 min)

### 4.4 Complaint Alerts

Watch for:

- Unresolved complaints crossing `response_deadline`
- Complaint resolution API failures (`/api/admin/complaints/[id]/resolve`)
- Provider access grant errors (`/api/admin/complaints/[id]/add-provider`)
- Split settlement with one financial leg failing (payout succeeded, refund failed or vice versa)

### 4.5 Email Outbox Alerts

Watch for:

- Growing `pendingReady` count in `/api/cron/process-email-outbox` responses
- Failed emails (`status=failed`) accumulating — indicates permanent delivery issues
- Stale locks (`lockedAt` older than 5 min) — indicates worker crashes

### 4.6 Integration Alerts

Watch for:

- Webhook processing failures (`/api/webhooks/razorpay`)
- Cron endpoint failures (all 10 cron jobs)
- Rate limit spikes (`api_rate_limits` collection showing high counts)

---

## 5. Alert Acknowledgement & SLA

### SLA Windows

| Alert Severity | Acknowledgement SLA | Escalation After |
| --- | --- | --- |
| `critical` | 15 minutes | 30 min (notify), 60 min (owner → `tech_lead`) |
| `high` | 60 minutes | 2 hours (notify), 4 hours (owner → `tech_lead`) |

### How to Acknowledge

1. **Admin dashboard**: Navigate to System Alerts section, click Acknowledge on the alert
2. **API**: `PATCH /api/admin/system-alerts/[id]/acknowledge` with optional `note` and `owner` assignment

### Alert Notification Channels

Configured via environment variables (all optional — if unset, notifications are skipped):

| Channel | Env Var | Format |
| --- | --- | --- |
| Email digest | `OPS_ALERT_EMAIL_TO` | Comma-separated email addresses |
| Webhook (Slack/generic) | `OPS_ALERT_WEBHOOK_URL` + `OPS_ALERT_WEBHOOK_BEARER` | JSON POST |
| PagerDuty | `OPS_PAGERDUTY_ROUTING_KEY` | PagerDuty events API v2 |

### Delivery Behavior

- **Dedup**: Minimum 1 hour between repeat notifications for the same alert (`ALERT_NOTIFICATION_DEDUPE_MS`)
- **Escalation repeat**: Minimum 6 hours between escalation notifications (`ALERT_ESCALATION_REPEAT_MS`)
- **Escalation triggers**: Critical alerts older than 30 min (`CRITICAL_ALERT_ESCALATION_MS`), high alerts older than 2 hours (`HIGH_ALERT_ESCALATION_MS`)

---

## 6. Incident Triage Checklist

1. Confirm severity (`SEV-1`, `SEV-2`, `SEV-3`) and declare incident channel
2. Capture time window and impacted flows (payment, complaint, payout, refund, email)
3. Acknowledge ownership of active `critical`/`high` system alert in admin dashboard or API
4. Record owner (`platform_admin_oncall` / `backend_oncall` / `tech_lead`) and optional note
5. Validate current deploy/commit and recent config changes
6. Check API logs for first-failure timestamp and error concentration (Pino logs, Datadog APM if enabled)
7. Check MongoDB state for stuck records and failure markers
8. Check `cron_runs` collection for latest cron run status and duration
9. Choose mitigation path:
   - Stop further damage (freeze automation if needed)
   - Apply safe manual resolution
   - Ship fix and verify
10. Record every manual action in `audit_logs` and incident notes

---

## 7. Playbooks

### 7.1 Orders Stuck in `held` Beyond Release Window

**Symptoms:**

- Increasing count of `payment_status=held` with `escrow_release_at < now`
- `overdue_held_orders` system alert triggered

**Investigation:**

```javascript
// Find stuck held orders
db.orders.find({
  payment_status: "held",
  escrow_release_at: { $lt: new Date() }
}).sort({ escrow_release_at: 1 })
```

**Actions:**

1. Verify no active complaint exists for impacted orders:
   ```javascript
   db.complaints.find({
     order_id: ObjectId("..."),
     status: { $nin: ["resolved", "rejected"] }
   })
   ```
2. If no complaint, check for payout lock issues:
   ```javascript
   db.orders.find({
     _id: ObjectId("..."),
     payout_lock_at: { $exists: true }
   })
   ```
3. If stale payout lock (older than `PAYOUT_LOCK_TTL_MS` = 5 min), clear it:
   ```javascript
   db.orders.updateOne(
     { _id: ObjectId("...") },
     { $unset: { payout_lock_at: "" } }
   )
   ```
4. Trigger payout processing by calling the cron endpoint with `CRON_SECRET` auth
5. If still stuck, check `payout_failure_reason` and `razorpay_fund_account_id` on the provider

**Validation:**

- Affected orders move to `payout_status: processing` → `paid`
- No duplicate payouts produced (`payout_id` uniqueness enforced by index)
- `cron_runs` shows successful `process-payouts` run

### 7.2 Complaint Resolution Failing

**Symptoms:**

- Admin resolve action returns 5xx
- Complaint remains in non-terminal state with partial financial action
- `pending_manual` payout or refund state on order

**Investigation:**

1. Check complaint + linked order state:
   ```javascript
   db.complaints.findOne({ _id: ObjectId("...") })
   db.orders.findOne({ _id: ObjectId("...order_id...") })
   ```
2. Check logs from `/api/admin/complaints/[id]/resolve`
3. Look for `resolution_breakdown` on complaint and `payout_status`/`payment_status` on order

**Actions:**

1. Determine whether payout/refund was partially applied:
   - `payoutApplied=true, refundPendingManual=true` → Refund leg failed, need manual refund
   - `payoutPendingManual=true, refundApplied=true` → Payout leg failed, need manual payout
2. If one leg failed, the complaint was still resolved/rejected in DB with `manual_transfer_details` in the response. Use those details for manual transfer.
3. If no financial leg applied, fix root cause and retry resolve
4. After manual intervention, verify complaint is in terminal state and order financials match `resolution_breakdown`

**Revert logic:** If resolution fails mid-way, `buildComplaintRevertUpdate()` in `lib/services/complaint-resolution.ts` restores the complaint to its previous state.

**Validation:**

- Complaint reaches terminal state (`resolved`/`rejected`)
- `resolution_breakdown` matches order financial fields
- No orphaned locks or intermediate states

### 7.3 Webhook Failure or Delay

**Symptoms:**

- Webhook error spikes in logs
- Payment states lag behind Razorpay dashboard reality
- `webhook_events` collection showing unprocessed events

**Investigation:**

```javascript
// Check recent webhook events
db.webhook_events.find({}).sort({ receivedAt: -1 }).limit(20)

// Check for failed processing
db.webhook_events.find({ processed: false }).count()
```

**Actions:**

1. Validate webhook signature path and env key configuration (`RAZORPAY_KEY_SECRET`)
2. Identify failed event IDs from `webhook_events`
3. Check if events are being deduplicated correctly (unique `event_id` index)
4. Replay or reconcile affected records with idempotency safeguards (the webhook handler is replay-safe)
5. Monitor for duplicate-event resistance (same event should no-op on replay)

**Validation:**

- Queue/backlog returns to baseline
- No duplicate financial side-effects
- `webhook_events` shows events as processed

### 7.4 Email Outbox Backlog

**Symptoms:**

- Growing `pendingReady` count in cron results
- Users not receiving OTP, delivery OTP, or password reset emails
- `email_outbox` collection has many `status=pending` documents

**Investigation:**

```javascript
// Check pending count
db.email_outbox.countDocuments({ status: "pending", nextAttemptAt: { $lte: new Date() } })

// Check failed count
db.email_outbox.countDocuments({ status: "failed" })

// Check stale locks
db.email_outbox.countDocuments({
  status: "processing",
  lockedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) }
})
```

**Actions:**

1. **Stale locks**: Unlock stale processing jobs:
   ```javascript
   db.email_outbox.updateMany(
     { status: "processing", lockedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } },
     { $set: { status: "pending", lockedAt: null, lockedBy: null, updatedAt: new Date() } }
   )
   ```
2. **SMTP issues**: Check `EMAIL_USER` / `EMAIL_PASS` credentials and SMTP connectivity
3. **Failed jobs**: Review `lastError` on failed jobs for patterns
4. **Backlog**: Increase batch size temporarily (cron processes up to 25 per run by default, max 200)

**Validation:**

- `pendingReady` count returns to near zero
- New emails are being sent (check `sentAt` on recent jobs)
- No growing `failed` count

### 7.5 Booking Fee Refund Stuck

**Symptoms:**

- Booking cancelled but `bookingFeeStatus` still shows `paid`
- `refund_in_progress_at` is set but refund never completed

**Investigation:**

```javascript
db.bookings.findOne({ _id: ObjectId("...") },
  { bookingFeeStatus: 1, refund_in_progress_at: 1, razorpay_payment_id: 1, booking_fee_refund_id: 1 }
)
```

**Actions:**

1. If `refund_in_progress_at` is stale (older than 5 min), clear the lock:
   ```javascript
   db.bookings.updateOne(
     { _id: ObjectId("...") },
     { $unset: { refund_in_progress_at: "" }, $set: { updatedAt: new Date() } }
   )
   ```
2. If the Razorpay refund was actually processed (check Razorpay dashboard), update booking:
   ```javascript
   db.bookings.updateOne(
     { _id: ObjectId("...") },
     { $set: { bookingFeeStatus: "refunded", refundProcessedAt: new Date(), booking_fee_refund_id: "rfnd_..." } }
   )
   ```
3. If not processed, use admin refund endpoint `POST /api/admin/refund`

### 7.6 Deadline Compensation Issues

**Symptoms:**

- Delivery confirmed but deadline breach not compensated
- Double compensation applied

**Investigation:**

```javascript
db.orders.findOne({ _id: ObjectId("...") },
  { deadline: 1, deadline_breached_at: 1, deadline_compensated_at: 1, deadline_compensation_mode: 1,
    payment_status: 1, razorpay_refund_id: 1, total_price: 1 }
)
```

**Actions:**

- Compensation is idempotent (checks `deadline_compensated_at`, `razorpay_refund_id`, and `payment_status=refunded` before applying)
- If compensation was missed, manually initiate refund via Razorpay and update order fields
- If double-compensation detected (should not happen due to idempotency), investigate and reverse extra refund

### 7.7 Cron Job Health Issues

**Symptoms:**

- Cron job not running on schedule
- `cron_runs` shows `error` status or missing entries

**Investigation:**

```javascript
// Check latest runs for each job
db.cron_runs.find({ job: "process-payouts" }).sort({ startedAt: -1 }).limit(5)

// Check for any errors in last 24h
db.cron_runs.find({
  status: "error",
  startedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
}).sort({ startedAt: -1 })
```

**Actions:**

1. Verify `CRON_SECRET` is correctly configured in Vercel environment
2. Check Vercel cron logs for delivery failures
3. Manually trigger the cron endpoint with bearer token to test:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron/process-payouts
   ```
4. Check if the cron endpoint is returning errors (look at `cron_runs.error` field)

**All registered cron jobs** (`lib/constants.ts` → `CRON_JOB_NAMES`):

- `auto-reject-bookings` (every 5 min)
- `no-show` (every 5 min)
- `process-payouts` (every 15 min)
- `notify-system-alerts` (every 15 min)
- `process-email-outbox` (every 2 min)
- `audit-integrity` (every 30 min)
- `reconciliation` (every 30 min)
- `monitor-operational-health` (hourly)
- `monitor-abuse` (daily 2 AM)
- `webhook-cleanup` (daily 1 AM)

### 7.8 Rate Limiting False Positives

**Symptoms:**

- Legitimate users getting 429 responses
- Admin actions being blocked

**Investigation:**

```javascript
// Check rate limit entries
db.api_rate_limits.find({ key: /admin/ }).sort({ updatedAt: -1 }).limit(20)
```

**Actions:**

1. Rate limit documents have TTL auto-cleanup, so they'll expire naturally
2. For immediate relief, delete the specific rate limit entry:
   ```javascript
   db.api_rate_limits.deleteMany({ key: "admin_action:1.2.3.4" })
   ```
3. Review if `TRUST_PROXY` is correctly set — if behind a reverse proxy without `TRUST_PROXY=true`, all requests appear as `127.0.0.1`

**Rate limit tiers** (defined in `lib/constants.ts`):

- Default: 60s window (`RATE_LIMIT_DEFAULT_WINDOW_MS`)
- Strict: 5 min window (`RATE_LIMIT_STRICT_WINDOW_MS`)
- Auth: 15 min window (`RATE_LIMIT_AUTH_WINDOW_MS`)

---

## 8. Safe Manual Action Rules

- **Never** run destructive DB resets in production
- **Never** alter paid invoice totals retroactively
- **Never** manually set `payment_status` without corresponding Razorpay action
- For complaint-linked money moves, always verify:
  - Complaint terminal intent (what outcome was intended)
  - Order `payment_status` and `payout_status`
  - Existing `payout_id`, `razorpay_refund_id`, and `booking_fee_refund_id` identifiers
- Every manual intervention requires:
  - Actor identity
  - Reason
  - Timestamp
  - Affected IDs
  - Entry in `audit_logs` collection

### 8.1 Admin Refund Safety

The `POST /api/admin/refund` endpoint enforces:

- Payment ID must match the booking or order record
- Cannot refund an already-refunded payment
- Cannot refund if payout has already been initiated
- Partial refund amounts are validated against original payment
- All refunds create audit log entries

### 8.2 Manual Payout After Settlement Failure

When complaint resolution marks payout as `pending_manual`:

1. Admin UI shows provider bank details (account number, IFSC, UPI, holder name)
2. Perform manual bank transfer outside the platform
3. Update order record:
   ```javascript
   db.orders.updateOne(
     { _id: ObjectId("...") },
     { $set: {
       payout_status: "paid",
       payout_id: "manual_transfer_<reference>",
       payout_updated_at: new Date()
     }}
   )
   ```
4. Create audit log entry for the manual transfer

---

## 9. Key Business Constants Reference

| Constant | Value | Purpose |
| --- | --- | --- |
| `PLATFORM_COMMISSION_RATE` | 5% | Platform commission on all orders |
| `BOOKING_FEE_INR` | ₹50 | Upfront booking fee |
| `ESCROW_RELEASE_WINDOW_MS` | 24 hours | Hold period after delivery before auto-release |
| `DELIVERY_OTP_TTL_MS` | 10 minutes | OTP validity window |
| `COMPLAINT_FILING_WINDOW_MS` | 24 hours | Window after delivery for filing complaints |
| `SEEKER_CANCELLATION_BLOCK_MS` | 30 days | Block duration after cancelling a paid order |
| `MAX_ARRIVAL_DISTANCE_METERS` | 200m | Geofence radius for provider arrival check |
| `MIN_PICKUP_ADVANCE_MS` | 2 hours | Minimum advance notice for pickup scheduling |
| `REFUND_LOCK_TIMEOUT_MS` | 5 minutes | Stale refund lock timeout |
| `PAYOUT_LOCK_TTL_MS` | 5 minutes | Stale payout lock timeout |
| `ABUSE_LOOKBACK_DAYS` | 30 | Window for counting cancellations |
| `EXCESSIVE_CANCELLATION_THRESHOLD` | 3 | Cancellations to trigger abuse flag |
| `SESSION_MAX_AGE_SECONDS` | 7 days | Maximum session duration |

---

## 10. APM & Telemetry

### Datadog APM

- **Tracer**: `dd-trace` initialized via `instrumentation.ts` (service name: `laundryease-web`)
- **Activation**: Set `DATADOG_API_KEY` or `DD_API_KEY` environment variable
- **Runtime**: Only initializes on Node.js runtime (not Edge)

### StatsD Metrics

- **Client**: `hot-shots` DogStatsD in `lib/telemetry.ts` (prefix: `laundryease.`)
- **Methods**: `telemetry.increment(metric, value, tags)`, `telemetry.gauge(metric, value, tags)`
- **Fallback**: If `hot-shots` is unavailable, metrics are logged via Pino

### Structured Logging

- **Logger**: Pino with native secret redaction in `lib/logger.ts`
- **Redacted fields**: `password`, `passwordHash`, `token`, `secret`, `apiKey`, `otp`, `code`, `codeHash`, `authToken`, `accessToken`
- **Dev mode**: Pretty-printing with colors via `pino-pretty`
- **Production**: JSON output for log aggregation
- **Debug**: Set `DEBUG_LOGGING=true` for debug-level output in production

---

## 11. Database Collections Reference

| Collection | Purpose | Key Indexes |
| --- | --- | --- |
| `seekers` | Seeker profiles | `email` (unique) |
| `providers` | Provider profiles | `email` (unique), `locationGeoJSON` (2dsphere) |
| `admins` | Admin accounts | `email` (unique) |
| `bookings` | Booking records | `razorpay_order_id` (unique), `razorpay_payment_id` (unique), `provider_id+status+createdAt`, `seeker_id+createdAt` |
| `orders` | Order records | `booking_id` (unique), `razorpay_order_id` (unique), `razorpay_payment_id` (unique), `payout_id` (unique), `payment_status+escrow_release_at`, `provider_id+process_status+createdAt`, `seeker_id+createdAt` |
| `complaints` | Complaint records | `order_id` (unique), `status`, `status+response_deadline` |
| `complaint_messages` | Chat messages | — |
| `reviews` | Seeker reviews | — |
| `audit_logs` | State change audit trail | `timestamp` (TTL: 30 days) |
| `system_alerts` | Operational alerts | `status+severity`, `status+severity+firstSeenAt` |
| `cron_runs` | Cron job tracking | `startedAt` (TTL: 7 days) |
| `email_outbox` | Queued emails | `status+nextAttemptAt+createdAt`, `status+lockedAt` |
| `api_rate_limits` | Rate limit counters | `key+windowStart` (unique), `expiresAt` (TTL) |
| `otp_codes` | OTP tokens | `expiresAt` (TTL) |
| `password_reset_tokens` | Reset tokens | `tokenHash` (unique), `expiresAt` (TTL) |
| `webhook_events` | Razorpay webhooks | `event_id` (unique) |
| `payments` | Payment records | `razorpay_payment_id` (unique) |
| `refunds` | Refund records | `razorpay_refund_id` (unique) |

---

## 12. Post-Incident Review Template

For every `SEV-1`/`SEV-2`:

1. **Timeline**: detect → acknowledge → mitigate → resolve (with timestamps)
2. **User impact and financial risk summary**: How many users/orders affected, monetary exposure
3. **Root cause**: Technical + process breakdown
4. **What worked / what failed in runbook execution**: Which playbook was used, was it sufficient
5. **Preventive actions with owner + due date**: Concrete follow-ups

---

## 13. Release Gate Checklist

Before shipping production-impacting changes:

1. Run `npm run verify:gates` locally (typecheck + lint + test + build)
2. If high-impact code changed (`app/api`, `lib`, `types`, or config files), run `npm run check:docs-sync` and update impacted docs
3. Confirm smoke journeys pass in serial mode:
   ```bash
   npm run test:e2e -- --workers=1 \
     e2e/smoke-role-journeys.spec.ts \
     e2e/complaint-chat-journey.spec.ts \
     e2e/settlement-chain-journey.spec.ts \
     e2e/booking-lifecycle-journey.spec.ts \
     e2e/booking-negative-journeys.spec.ts
   ```
   The runner will reuse a local server only if `/api/e2e/runtime` confirms smoke-safe fake-payments mode. If not, it will start the managed Playwright server instead. A reachable but unsafe `E2E_BASE_URL` is treated as a configuration error and the run stops immediately.
4. Verify CI `Quality Gates` workflow passes on the PR
5. For payment/payout changes: run `Real Gateway Smoke` workflow manually

---

## 14. Operational Hygiene Backlog

- [ ] Add automated alert dashboards for payout failure rate, held-order age, and overdue complaints
- [ ] Add staging scheduled smoke for real gateway interaction paths
- [ ] Add archival policy for old webhook payloads
- [ ] Promote CSP from report-only to enforce mode after violation cleanup
- [ ] Add password-recovery anti-abuse hardening (captcha strategy)
- [ ] Integrate real team calendar/on-call system for dynamic owner pool routing
- [ ] Add split-settlement reconciliation tooling for rare one-leg failure cases
- [ ] Add reschedule abuse prevention (caps, cooldowns, or admin escalation)
- [ ] Add index creation failure dashboards for duplicate data detection
