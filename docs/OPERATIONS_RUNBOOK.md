# LaundryEase Operations Runbook

**Version:** 2026-02-15  
**Scope:** Payment, escrow, complaint, and reliability-critical operational response

---

## 1. Purpose

This runbook defines how to detect, triage, and resolve production incidents for LaundryEase critical paths:

- payment capture and verification
- escrow hold/release
- payout and refund execution
- complaint lifecycle flow

---

## 2. Ownership Model

### Primary owners

- **Platform Admin On-Call**: complaint operations, manual case actions, user communication
- **Backend On-Call**: API/cron/webhook failures, payout/refund orchestration, database consistency

### Escalation owners

- **Tech Lead**: Sev-1 coordination, architectural decisions, hotfix approval
- **Product Owner**: user-impact decisions, incident communication alignment

---

## 3. Severity Definitions

| Severity | Definition | Examples | Response Target |
| --- | --- | --- | --- |
| `SEV-1` | Core money or availability path broken for many users | failed global payment verification, stuck payout pipeline, complaint resolution blocked system-wide | acknowledge in 15 min, mitigate in 60 min |
| `SEV-2` | High-impact partial outage or financial inconsistency risk | repeated payout failures for subset of orders, webhook lag causing delayed state sync | acknowledge in 30 min, mitigate in 4 hrs |
| `SEV-3` | Degraded but non-critical behavior | elevated retry noise, delayed non-critical jobs, UI metric inconsistencies | acknowledge in 1 business day |

---

## 4. Core Alerts and Triggers

### Payment and escrow alerts

- spike in `payment verification failed` API responses
- growth in orders stuck in `payment_status = held` beyond expected release window
- repeated payout statuses with failure reasons (`payout_failure_reason` populated)
- refunds requested but missing `razorpay_refund_id` after processing window

### Complaint alerts

- unresolved complaints crossing `response_deadline`
- complaint resolution API failures (`/api/admin/complaints/[id]/resolve`)
- provider access grant errors (`/api/admin/complaints/[id]/add-provider`)

### Integration alerts

- webhook processing failures (`/api/webhooks/razorpay`)
- cron endpoint failures:
  - `/api/cron/process-payouts`
  - `/api/cron/release-payouts`
  - `/api/cron/no-show`
  - `/api/cron/monitor-operational-health`
  - `/api/cron/notify-system-alerts`

---

## 5. Incident Triage Checklist

1. Confirm severity (`SEV-1`, `SEV-2`, `SEV-3`) and declare incident channel.
2. Capture time window and impacted flows (payment, complaint, payout, refund).
3. Validate current deploy/commit and recent config changes.
4. Check API logs for first-failure timestamp and error concentration.
5. Check MongoDB state for stuck records and failure markers.
6. Choose mitigation path:
   - stop further damage (freeze automation if needed),
   - apply safe manual resolution,
   - ship fix and verify.
7. Record every manual action in `admin_logs` and incident notes.

---

## 6. Playbooks

## 6.1 Orders Stuck in `held` Beyond Release Window

Symptoms:

- increasing count of `payment_status = held` with `escrow_release_at < now`

Actions:

1. Verify complaint is not open/in-review for impacted orders.
2. Trigger payout processing endpoint with `CRON_SECRET` auth.
3. If still stuck, inspect payout lock/failure fields in `orders`.
4. Use admin/manual payout path only after verifying complaint state and idempotency guard.

Validation:

- affected orders move to payout initiated/released path
- no duplicate payouts are produced (`reference_id` idempotency preserved)

## 6.2 Complaint Resolution Failing

Symptoms:

- admin resolve action returns 5xx
- complaint remains in non-terminal state with partial financial action

Actions:

1. Check complaint + linked order state.
2. Inspect logs from `/api/admin/complaints/[id]/resolve`.
3. Determine whether payout/refund was partially applied.
4. If partial, perform controlled follow-up on missing leg and append system/admin message for audit.
5. If no financial leg applied, retry resolve after root-cause correction.

Validation:

- complaint reaches terminal state (`resolved`/`rejected`)
- `resolution_breakdown` matches order financial fields
- seeker/provider access is revoked for finalized complaint

## 6.3 Webhook Failure or Delay

Symptoms:

- webhook error spikes
- payment states lag behind provider dashboard reality

Actions:

1. Validate webhook signature path and env key configuration.
2. Identify failed event IDs from `webhook_events`.
3. Replay or reconcile affected records with idempotency safeguards.
4. Monitor for duplicate-event resistance (same event should no-op on replay).

Validation:

- queue/backlog returns to baseline
- no duplicate financial side-effects

---

## 7. Safe Manual Action Rules

- Never run destructive DB resets in production.
- Never alter paid invoice totals retroactively.
- For complaint-linked money moves, always verify:
  - complaint terminal intent
  - order payment state
  - existing payout/refund identifiers
- Every manual intervention requires:
  - actor identity
  - reason
  - timestamp
  - affected IDs

## 7.1 Alert Channel Configuration

- Optional alert fan-out env vars:
  - `OPS_ALERT_EMAIL_TO` (comma-separated recipients)
  - `OPS_ALERT_WEBHOOK_URL` (Slack/incident webhook)
  - `OPS_ALERT_WEBHOOK_BEARER` (optional auth token)
- If channels are unset, `/api/cron/notify-system-alerts` safely skips delivery and only records cron run results.

---

## 8. Post-Incident Review Template

For every `SEV-1`/`SEV-2`:

1. Timeline (detect -> acknowledge -> mitigate -> resolve)
2. User impact and financial risk summary
3. Root cause (technical + process)
4. What worked / what failed in runbook execution
5. Preventive actions with owner + due date

---

## 9. Operational Hygiene Backlog

- Add automated alert dashboards for payout failure rate, held-order age, and overdue complaints
- Add staging scheduled smoke for real gateway interaction paths
- Add archival policy for old webhook payloads
