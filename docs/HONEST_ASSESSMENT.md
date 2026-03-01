# LaundryEase — Honest Assessment (2026-03-01)

> This is a strict, evidence-based assessment of the current working tree (including uncommitted refactor changes).
> Focus: breakage, partial implementations, unwanted code, test reality, and documentation accuracy.

---

## 1. Executive Verdict

**Current branch readiness: `D` (do not deploy yet).**

The foundation is still strong, but there are release-blocking regressions right now:

1. **`next build` fails** (new API route uses incompatible Next.js 16 handler signature).
2. **Startup deadlock risk** in index-init failure path due recursive `getDb()` dependency.
3. **New cleanup/reconciliation logic has field-name mismatches** that can silently no-op or behave incorrectly.

This is not a “minor polish” situation. The branch needs fixes before claiming production readiness.

---

## 2. Ground-Truth Results (What Was Actually Run)

| Check | Result | Status |
|---|---|---|
| `npm run typecheck` | passed | ✅ |
| `npm run lint` | passed | ✅ |
| `npm test` | `102` files, `497` tests passed | ✅ |
| `npm run build` | failed (route handler type mismatch) | ❌ |
| `npm run verify:gates -- --skip-e2e` | failed at build step | ❌ |
| Smoke E2E (gated 3 specs) | `7/7` passed | ✅ |
| New E2E specs (`booking-lifecycle`, `booking-negative`) | `3/3` failed | ❌ |
| API route/test parity | `83` route files vs `81` route tests | ⚠️ |
| Placeholder scan (`TODO/FIXME/HACK/XXX`) | none in app code | ✅ |
| Type suppression scan (`@ts-ignore/@ts-nocheck/as any`) | none found; one `@ts-expect-error` in reconciliation | ⚠️ |

---

## 3. Critical Findings (P0)

### P0-1: Build is broken

- **File:** `app/api/admin/orders/[id]/extend-complaint/route.ts:16`
- **Issue:** Next.js 16 expects `context.params` as a `Promise`, but handler uses old sync shape.
- **Impact:** `next build` fails, branch cannot be shipped.

Error seen during build:
- route handler type does not satisfy `RouteHandlerConfig<"/api/admin/orders/[id]/extend-complaint">`

### P0-2: Index failure alert path can deadlock startup

- **Files:**
  - `lib/db-indexes.ts:290` (calls `triggerSystemAlert` inside index-init failure path)
  - `lib/services/system-alerts.ts:14` (calls `getDb()`)
  - `lib/mongodb.ts:31` (`getDb()` awaits global `_mongoIndexInitPromise`)
- **Issue:** On index creation failure, index init awaits alert insertion, alert insertion re-enters `getDb()`, which awaits the same in-flight index-init promise.
- **Impact:** Potential circular wait/hang during startup exactly when index creation fails (the scenario this path is meant to handle).

This is a reliability bug in a critical failure path.

---

## 4. High Findings (P1)

### P1-1: `webhook-cleanup` cron likely purges nothing

- **Cleanup query:** `app/api/cron/webhook-cleanup/route.ts:32` uses `createdAt`.
- **Webhook events write path:** `app/api/webhooks/razorpay/route.ts:90` stores `received_at`.
- **Impact:** cleanup job can silently no-op, allowing indefinite growth of `webhook_events`.

### P1-2: Reconciliation uses mixed timestamp field names and questionable booking mutation

- **Reconciliation filter uses snake_case:**
  - `created_at` at `app/api/cron/reconciliation/route.ts:35`
  - `updated_at` at `app/api/cron/reconciliation/route.ts:151`
- **Canonical order creation uses camelCase:**
  - `createdAt`, `updatedAt` at `app/api/bookings/[id]/pay-invoice/route.ts:252-253`
- **Also mutates booking fee state during order reconciliation:**
  - sets `bookingFeeStatus: "paid"` at `app/api/cron/reconciliation/route.ts:101`

**Impact:** reconciliation can miss intended records and may alter booking fee state in a flow meant to reconcile order payment.

### P1-3: New API routes are not test-covered

Missing `route.test.ts` for:

1. `app/api/admin/orders/[id]/extend-complaint/route.ts`
2. `app/api/cron/webhook-cleanup/route.ts`

With current parity scan: `83` route files vs `81` route tests.

---

## 5. Medium Findings (P2)

### P2-1: New E2E specs are failing and not gated

- **Failing specs:**
  - `e2e/booking-lifecycle-journey.spec.ts`
  - `e2e/booking-negative-journeys.spec.ts`
- **Observed failures:** expected UI controls not found (`Request Booking`, `Decline`, `Cancel Request`).
- **Gating gap:** `scripts/verify-gates.mjs` only runs 3 smoke specs (does not include the 2 new specs).

This means CI can stay green while newly added journeys are red.

### P2-2: New E2E data seeding uses non-canonical states

- `e2e/booking-lifecycle-journey.spec.ts:88` inserts booking status `"pending"`
- `e2e/booking-lifecycle-journey.spec.ts:164` inserts order status `"in_progress"`
- `types/orders.ts:18-25` does not include `"in_progress"`

These tests can validate behavior against states not defined by canonical types.

### P2-3: Documentation drift remains real

Current docs contain statements that are now inaccurate for this branch state, including:

- claims that all quality gates pass,
- claims of 9 cron jobs (now 10 including `webhook-cleanup`),
- claims that complaint-window extension is only a future opportunity while route exists.

---

## 6. Clean Areas (What Is Actually Good)

1. Typecheck/lint/unit tests are strong and stable (`497` passing tests).
2. Existing smoke E2E core flows are passing (`7/7`).
3. No obvious placeholder debris (`TODO/FIXME/HACK/XXX`) in app code.
4. Architecture remains modular and test-friendly across `lib/`, `app/api/`, and `ops` domains.

---

## 7. Brutal But Fair Score

Two scores are more honest than one:

1. **Foundation quality (architecture + test depth): `B+`**
2. **Current branch deploy readiness: `D`**

Reason: release-blocking failures outweigh architectural quality in a go/no-go decision.

---

## 8. Priority Fix Order (Must-Do Sequence)

1. **Fix build blocker** in `extend-complaint` route params signature (Next 16 style).
2. **Break index-init recursion** by removing `getDb()` dependency from index-failure alert path (use existing db handle or out-of-band logging path).
3. **Fix timestamp field mismatches** in reconciliation and webhook-cleanup (`createdAt/updatedAt` vs `received_at/created_at`).
4. **Re-check reconciliation write semantics** so order reconciliation does not mutate booking-fee domain state incorrectly.
5. **Add missing route tests** for both new endpoints.
6. **Either repair or remove failing new E2E specs**; then add them to gate list if intended as required coverage.
7. **Sync docs** (`CODEBASE_UNDERSTANDING.md`, `PRD.md`, runbook sections) to reflect current implemented behavior.

---

## 9. Final Assessment

You did meaningful refactoring and the core system did not collapse. But right now, saying “everything is solid” would be inaccurate.

The branch has **real correctness and release-readiness issues**. Fix the P0/P1 list first, then re-run full gates and reassess.
