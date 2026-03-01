# LaundryEase — Honest Assessment (2026-03-01, rev 2)

> This is a strict, evidence-based assessment of the current working tree.
> Focus: breakage, partial implementations, unwanted code, test reality, and documentation accuracy.
> **Rev 2** reflects all P0/P1/P2 fixes applied on 2026-03-01.

---

## 1. Executive Verdict

**Current branch readiness: `B+` (deploy-ready with minor caveats).**

All release-blocking issues from the original assessment have been resolved:

1. ~~`next build` fails~~ → **Fixed.** `extend-complaint` route now uses Next.js 16 async params.
2. ~~Startup deadlock risk~~ → **Fixed.** Index-failure alert path uses `triggerSystemAlertWithDb(db, ...)` bypassing `getDb()`.
3. ~~Field-name mismatches in cron jobs~~ → **Fixed.** Reconciliation and webhook-cleanup now use canonical field names.

Remaining caveats are documentation drift (P2-3) and two skipped E2E specs that need architectural rewrites to match the actual UI.

---

## 2. Ground-Truth Results (What Was Actually Run)

| Check | Result | Status |
|---|---|---|
| `npm run typecheck` | passed | ✅ |
| `npm run lint` | passed | ✅ |
| `npm test` | `104` files, `506` tests passed | ✅ |
| `npm run build` | passed | ✅ |
| Smoke E2E (gated 3 specs) | `7/7` passed | ✅ |
| New E2E specs (`booking-lifecycle`, `booking-negative`) | skipped (see P2-1) | ⏭️ |
| API route/test parity | `85` route tests for `85` route files | ✅ |
| Placeholder scan (`TODO/FIXME/HACK/XXX`) | none in app code | ✅ |
| Type suppression scan (`@ts-ignore/@ts-nocheck/as any`) | none found; one `@ts-expect-error` in reconciliation | ⚠️ |

---

## 3. Critical Findings (P0) — ✅ RESOLVED

### P0-1: Build was broken → Fixed

- **File:** `app/api/admin/orders/[id]/extend-complaint/route.ts`
- **Fix:** Changed params type from `{ params: { id: string } }` to `{ params: Promise<{ id: string }> }` and added `await params`.
- **Verified:** `npm run build` passes.

### P0-2: Index failure alert path could deadlock startup → Fixed

- **Files:** `lib/db-indexes.ts`, `lib/services/system-alerts.ts`
- **Fix:** Added `triggerSystemAlertWithDb(db, opts)` that accepts an existing `Db` handle directly, avoiding re-entering `getDb()` during index initialization. `db-indexes.ts` now imports and uses this variant.
- **Verified:** No circular dependency in the call chain.

---

## 4. High Findings (P1) — ✅ RESOLVED

### P1-1: `webhook-cleanup` cron was purging nothing → Fixed

- **Fix:** Changed cleanup query from `createdAt` to `received_at` to match the field stored by the Razorpay webhook handler.
- **File:** `app/api/cron/webhook-cleanup/route.ts`

### P1-2: Reconciliation had mixed timestamp field names and incorrect booking mutation → Fixed

- **Timestamp fix:** Changed `created_at` → `createdAt` and `updated_at` → `updatedAt` throughout `app/api/cron/reconciliation/route.ts` to match the canonical order schema.
- **Booking mutation fix:** Removed `bookingFeeStatus: "paid"` write and `pending_payment` → `requested` status transition from order payment reconciliation. Order reconciliation now only links the `razorpay_payment_id` to the booking without mutating booking-fee domain state.
- **Test updated:** Reconciliation test now asserts `bookingFeeStatus` is NOT set during order reconciliation.

### P1-3: New API routes were not test-covered → Fixed

- Added `app/api/admin/orders/[id]/extend-complaint/route.test.ts` (5 tests: invalid ID, invalid date, not found, success, no-op update).
- Added `app/api/cron/webhook-cleanup/route.test.ts` (4 tests: missing auth, wrong auth, success purge, DB error).
- Route test parity is now `85/85`.

---

## 5. Medium Findings (P2) — Partially Resolved

### P2-1: New E2E specs were failing → Skipped with explanation

- **Root cause:** Tests navigate to `/provider/bookings/{id}` and `/seeker/bookings/{id}` which are not valid pages. Booking management uses list pages with card components, not individual detail routes.
- **Action:** Both specs marked `test.skip` with TODO explaining the architectural mismatch. These need a full rewrite to interact with the card-based list UI.
- **Gating gap remains:** `scripts/verify-gates.mjs` still only runs 3 smoke specs. Skipped tests don't affect CI.

### P2-2: E2E data seeding used non-canonical states → Fixed

- Changed `"pending"` → `"requested"` (valid `BookingStatus`)
- Changed `"in_progress"` → `"processing"` (valid `OrderProcessStatus`)

### P2-3: Documentation drift — Still outstanding

Current docs contain statements that are now inaccurate:

- `CODEBASE_UNDERSTANDING.md` claims 9 cron jobs (now 10 including `webhook-cleanup`)
- `PRD.md` claims complaint-window extension is only a future opportunity (route now exists)
- Various docs may not reflect the reconciliation semantics changes

**This is the primary remaining gap.**

---

## 6. Clean Areas (What Is Actually Good)

1. Typecheck/lint/unit tests are strong and stable (`506` passing tests, `104` test files).
2. Build passes cleanly with no warnings.
3. Existing smoke E2E core flows are passing (`7/7`).
4. Full route test parity (`85/85`).
5. No obvious placeholder debris (`TODO/FIXME/HACK/XXX`) in app code.
6. Architecture remains modular and test-friendly across `lib/`, `app/api/`, and `ops` domains.
7. Index-failure alert path no longer has a deadlock risk.
8. All cron jobs query the correct field names matching their write paths.

---

## 7. Brutal But Fair Score

Two scores are more honest than one:

1. **Foundation quality (architecture + test depth): `A-`**
2. **Current branch deploy readiness: `B+`**

The `B+` (not `A`) reflects the documentation drift and skipped E2E specs that still need rewrites. No release-blocking issues remain.

---

## 8. Remaining Work (Nice-to-Have, Not Blocking)

1. **Sync docs** (`CODEBASE_UNDERSTANDING.md`, `PRD.md`, runbook sections) to reflect current implemented behavior (10 cron jobs, complaint-window extension route exists, reconciliation semantics).
2. **Rewrite skipped E2E specs** to work with the card-based list-page UI architecture instead of nonexistent individual booking detail routes.
3. **Add skipped E2E specs to gate list** in `scripts/verify-gates.mjs` once they are rewritten and passing.

---

## 9. Final Assessment

All P0 and P1 issues from the original assessment are resolved and verified. The branch now builds, passes all quality gates (typecheck, lint, 506 unit tests), and has full route test parity.

The remaining gaps are documentation accuracy and two E2E specs that need architectural rewrites — neither blocks deployment.

**Go/no-go: Go**, with a follow-up task to sync documentation.
