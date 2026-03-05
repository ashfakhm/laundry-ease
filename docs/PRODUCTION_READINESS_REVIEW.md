# PRODUCTION_READINESS_REVIEW.md

Last reviewed: 2026-03-05 (Rev 10)

## Summary

Production readiness is tracked through:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- Smoke E2E specs in `e2e/`

## Current Quality Gates

| Gate | Command | Status |
| --- | --- | --- |
| TypeScript | `npx tsc --noEmit` | ✅ 0 errors |
| TypeScript strict | `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` | ✅ 0 errors |
| ESLint | `npx eslint . --max-warnings=0` | ✅ 0 warnings |
| Unit tests | `npx vitest run` | ✅ 104 files, 551 tests, 0 failures |
| Production build | `npm run build` | ✅ Passes cleanly |
| E2E smoke | `npm run test:e2e` | ✅ 5 specs passing |
| One-shot gate | `npm run verify:gates` | ✅ All passing |

## Current Focus

- Keep role-based login and dashboard navigation stable.
- Keep payment, complaint, and settlement journeys covered by smoke E2E.
- Keep documentation synced for high-impact changes.
- Keep password management flow (forgot/reset/profile change/session invalidation) tested and secure.

## What Changed in Rev 10

| Area | Change |
| --- | --- |
| **Password reset (forgot)** | Full secure flow: `randomBytes(32)` → SHA-256 hash stored (raw never persisted), 1hr TTL, anti-enumeration generic responses, per-IP + per-email rate limiting, branded HTML + plain text email template, 60s client-side cooldown |
| **Password changed notification** | New `password_changed` email type: branded HTML security notification with timestamp, sent on both reset and profile password change |
| **Session invalidation** | JWT callback re-checks `passwordChangedAt` every 5 min (`JWT_DB_RECHECK_INTERVAL_S`); stale tokens invalidated automatically, forcing re-authentication |
| **Profile password change** | Seeker PUT + Provider PATCH routes now set `passwordChangedAt` + `updatedAt`, enqueue `password_changed` email |
| **Provider password service** | Password change logic extracted to `lib/services/provider-password.ts` (verify current + hash new) |
| **Email outbox** | Expanded from 4 → 5 email types (`password_changed` added); inline dispatch attempt on enqueue (send immediately, fall back to cron on failure) |
| **Reset page** | `/reset-password` page with password + confirm inputs, show/hide toggles, error/success states, auto-redirect to sign-in |
| **BaseUser type** | Added `passwordChangedAt?: Date \| null` to `types/users.ts` |
| **Tests** | +2 tests (549 → 551): `passwordChangedAt` set on profile password change (seeker + provider), password-changed email enqueuing verified |

## What Changed in Rev 9

| Area | Change |
| --- | --- |
| **UI** | All native `alert()`/`confirm()`/`prompt()` replaced with `ConfirmDialog`, `SettlementSummaryModal`, inline `BanUserDialog` |
| **Cancellation policy** | 2-hour free-cancel window from `createdAt` (was: same-day rule); seeker live countdown badge on booking card |
| **Reschedule flow** | Fixed `$set: undefined` → `$unset confirmedAt`; TOCTOU-safe atomic status guards on propose/confirm writes |
| **Seeker UI** | New "Reschedule" tab; reschedule card shows who requested, reason, previous slot, count |
| **Email dev tooling** | `EMAIL_SEND_IMMEDIATE=1` flag for local testing; `POST /api/cron/process-email-outbox` (no auth in non-prod) for manual drain |
| **Tests** | +32 tests (517 → 549): cancellation policy boundary cases, reschedule `$unset`, TOCTOU guards, dialog hook behavior |

## Password Management Security Checklist

| Check | Status |
| --- | --- |
| Reset tokens: only SHA-256 hash stored in DB | ✅ |
| Reset tokens: 1-hour TTL with MongoDB TTL index | ✅ |
| Anti-enumeration: generic response regardless of email existence | ✅ |
| Rate limiting: per-IP (10/15min) + per-email (4/hour) on forgot-password | ✅ |
| Rate limiting: per-IP (15/15min) + per-token (6/hour) on reset-password | ✅ |
| Same-origin enforcement on forgot/reset endpoints | ✅ |
| Zod validation on all inputs | ✅ |
| `passwordChangedAt` set on reset-password | ✅ |
| `passwordChangedAt` set on seeker profile password change | ✅ |
| `passwordChangedAt` set on provider profile password change | ✅ |
| All active reset tokens invalidated on successful reset | ✅ |
| `password_changed` notification email on reset | ✅ |
| `password_changed` notification email on profile change (seeker) | ✅ |
| `password_changed` notification email on profile change (provider) | ✅ |
| JWT session invalidation via 5-min re-check of `passwordChangedAt` | ✅ |
| Password show/hide toggles on reset page | ✅ |
| Client-side 60-second cooldown on forgot-password resend | ✅ |
| Client-side generic error messages (no backend detail leakage) | ✅ |
| CAPTCHA on forgot-password form | ⬜ (recommended for production) |

## Email Outbox Health

5 email types operational:

| Kind | Template | Status |
| --- | --- | --- |
| `delivery_otp` | `lib/delivery-otp-email.ts` | ✅ |
| `password_reset` | `lib/password-reset-email.ts` | ✅ |
| `password_changed` | `lib/password-changed-email.ts` | ✅ (new in Rev 10) |
| `magic_link` | `lib/magic-link-email.ts` | ✅ |
| `otp_email` | `lib/otp-code-email.ts` | ✅ |

All types support inline dispatch attempt on enqueue + cron fallback (`process-email-outbox` every 2 min).

## Remaining Hardening Opportunities

- Add CAPTCHA (reCAPTCHA/hCaptcha) to forgot-password form for production anti-abuse hardening
- Archival policy for old webhook payloads (storage growth)
- Team calendar / on-call integration for dynamic owner pools
- Promote CSP from report-only to enforce mode after violation cleanup
- Split-settlement reconciliation tooling for rare one-leg failure cases
- Reschedule abuse prevention (caps, cooldowns, or admin escalation)
- Real-time push (SSE/WebSocket) to replace SWR polling
- Playwright E2E for password reset flow and reschedule/cancellation boundary behavior
- Consider stateful session management for instant session revocation (current ≤5 min JWT re-check is acceptable)
- Configure production email credentials (SPF, DKIM, DMARC for sending domain)