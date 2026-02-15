# LaundryEase — Product Requirements Document

## 1. Executive Summary

LaundryEase turns a local laundry job into a verifiable contract.

It does that by splitting the transaction into two moments:

- a **handshake** (booking) where slot intent is created and a booking-fee payment gate controls provider acceptance, and
- a **commitment** (paid invoice) where the seeker locks order funds in escrow and the provider begins work.

From commitment to delivery, the system advances through explicit states and releases escrow only after OTP-confirmed handoff.

## 2. Goals & Non-Goals

### Goals

- **Remove payment ambiguity**
  Providers should never wonder whether they’ll get paid after they’ve consumed time, utilities, and labor.

- **Replace status guessing with recorded facts**
  Seekers should see the job as a timeline of states, not a chat thread.

- **Prevent unviable matches at the source**
  The search experience should surface only providers who deliberately cover the seeker’s location.

- **Create an auditable transaction trail**
  The platform must record state transitions and payment events so support can resolve edge cases with evidence.

### Non-Goals

- **We do not set prices**
  Providers control their rate cards and fees.

- **We do not promise instant pickup**
  The system optimizes for scheduled reliability, not 10-minute availability.

- **We do not run logistics**
  Providers handle pickup and delivery themselves.

## 3. Users & Roles

### Seeker

Definition: an individual requesting laundry services.

Primary responsibilities:

- choose a provider based on location coverage
- request a booking slot
- pay an invoice to activate escrow
- confirm delivery via OTP

### Provider

Definition: an independent operator or laundry business.

Primary responsibilities:

- define service radius and availability constraints (including capacity)
- accept or reject booking requests
- inspect items and issue invoices
- advance orders through the lifecycle states
- complete delivery and collect OTP

### Admin

Definition: the platform operator.

Primary responsibilities:

- resolve disputes and complaints through structured workflow
- enforce abuse policy (e.g., bans, freezes)
- decide escrow outcomes when the normal path breaks
- manage complaint lifecycle (accept, add provider, resolve)
- set response deadlines for provider engagement

### User Registration & Authentication

All users (Seeker and Provider) must complete a verified registration:

**Required Information:**

- Name, email, phone number
- Password with confirmation
- Role-specific details (address for seekers, business info for providers)

**Verification Requirements:**

- Email OTP verification
- Phone SMS OTP verification
- Both must be verified before account creation

**Password Policy:**

- Minimum 8 characters
- At least one uppercase letter
- At least one number
- At least one special character
- Password confirmation must match
- Real-time validation feedback during entry

**Email Format:**

- Valid email format required
- Client-side validation with error feedback

## 4. Core User Flows

### A. Discovery & Booking (Handshake)

1. **Search**
   Seeker provides a location. The system returns providers whose service radius covers that coordinate.

2. **Request**
   Seeker requests a slot from a chosen provider.

3. **Booking fee payment**
   Seeker must pay the booking fee before the provider can accept or act on the request.

4. **Accept / Reject**
   Provider accepts to proceed or rejects to end the attempt.

5. **Arrival and booking-fee release**
   After a booking is confirmed, provider marks arrival (geofence-checked when seeker coordinates exist). This initiates provider payout for booking fee.

Outcome: booking intent is validated and gated; commitment still begins only at paid invoice.

### B. Pickup, Invoice, and Escrow (Commitment)

1. **Pickup and inspection**
   Provider verifies the actual items.

2. **Invoice creation**
   Provider issues an invoice based on the inspected items.

3. **Invoice review**
   Seeker can view the invoice details including:
   - Itemized list with quantities and prices
   - Item photos (if uploaded by provider)
   - Subtotal, discounts, and total
   - Provider notes

4. **Invoice decision**
   Seeker reviews and either:
   - **Approves & Pays**: Proceeds to payment
   - **Rejects**: Returns items to provider with a required reason

5. **Payment capture**
   On approval, seeker pays. Payment is captured and linked to the order (`payment_status = paid`) to fund the commitment.

6. **Order activation**
   The job becomes an active order. Work begins.

7. **Invoice history**
   Seekers can view past invoices in read-only mode from payment history.

### C. Execution, Delivery, and Settlement

1. **Lifecycle progression**
   Provider advances the order through explicit states (e.g., washing → ironing → ready → out for delivery).

2. **Delivery**
   Provider delivers to the seeker.

3. **OTP confirmation**
   Seeker shares a one-time code to confirm handoff.

4. **Escrow hold and release**
   OTP confirmation marks delivery, starts the escrow cooling window (`payment_status = held`, `escrow_release_at`), and background payout processing releases/initiates payout when due.

### D. Complaint & Dispute Resolution

1. **Complaint raised**
   Seeker raises a complaint against an order within the allowed window (24 hours post-delivery). Escrow is immediately frozen.

2. **Admin review**
   Admin reviews the complaint and accepts it, setting a 7-day response deadline for the provider.
   During `accepted`, the conversation is Admin + Seeker only.

3. **Provider engagement**
   Admin adds the provider to the complaint chat (from `accepted`; idempotent if already added).
   The complaint moves to `in_review` and becomes a 3-party conversation.

4. **Resolution**
   Admin decides the outcome:
   - **Release payout** (`release_payout`): Provider receives full distributable amount
   - **Split settlement** (`refund_partial`): Admin sets seeker refund amount between `0` and distributable amount; remaining distributable goes to provider
   - **Seeker full distributable award** (`refund_full`): Seeker receives full distributable amount (provider gets `0`)
   - **Reject** (`reject`): Complaint is invalid; provider receives full distributable amount through the same payout rail as `release_payout`. Case is hidden from ongoing lists.

   Settlement math is commission-aware: commission is retained first, and the slider applies only on the distributable amount (`invoice_total - platform_commission`).
   With default commission at 5%, successful/no-complaint or rejected-complaint outcomes pay provider 95% of invoice value (plus delivery charge handling per order math).

## 5. System Requirements

### Functional Requirements

- **Geospatial discovery**
  The system must support radius-based matching with practical precision.

- **Capacity enforcement**
  Providers must define a maximum number of concurrent active jobs. The system must block acceptance beyond that capacity.

- **Booking-fee gating**
  Provider acceptance must be blocked until booking fee status is `paid`.

- **Invoice immutability after payment**
  Once the seeker pays, invoice line items must not change.

- **Invoice viewing**
  Seekers must be able to view invoice details at any time:
  - Pending invoices: Viewable with payment/rejection actions
  - Completed invoices: Viewable in read-only mode from payment history

- **Payment-before-work gating**
  Work must start only after invoice payment is captured and verified.

- **Cancellation and booking-fee policy**
  Provider rejection/cancellation must refund paid booking fee; seeker cancellation before slot-time is refundable except same-day cancellations (forfeiture rule).

- **Unified payout orchestration**
  Escrow release, payout initiation, complaint gating, and admin-triggered manual release must use a shared idempotent payout processor.

- **OTP delivery authentication**
  Delivery must require a one-time code.

- **Complaint window enforcement**
  Seekers must raise complaints within 24 hours of delivery. After this window, escrow may auto-release.

- **Complaint chat audit trail**
  All messages in a complaint thread must be recorded with sender role and timestamp for dispute evidence.

- **Role-scoped complaint visibility**
  Seeker/provider complaint menus and list pages must show only ongoing complaints (`open`, `accepted`, `in_review`).
  Provider visibility additionally requires admin-granted provider access.

- **Account security**
  User registration must enforce:
  - Password confirmation (matching passwords required)
  - Password strength requirements (8+ chars, uppercase, number, special character)
  - Email format validation
  - Real-time client-side validation feedback

### Non-Functional Requirements

- **Consistency**
  Order state and payment state must not drift.

- **Data minimization**
  The system should reveal personal details only when needed to complete the job.

- **Search latency target**
  Provider discovery should feel immediate under normal load.

- **Form validation UX**
  - Real-time validation feedback for input fields
  - Password strength indicators during entry
  - Clear error messages displayed inline
  - Validation on blur to avoid premature errors

## 6. State Management & Lifecycle

### Booking (Handshake) States

| State                  | Meaning                                                      | Allowed Next States                                                 |
| ---------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| `requested`            | Seeker requested a slot                                      | `accepted`, `rejected`                                              |
| `accepted`             | Provider accepted the request                                | `pickup_proposed`, `confirmed`, `cancelled`, `reschedule_requested` |
| `rejected`             | Provider rejected the request (or auto-rejected after 2h)    | terminal                                                            |
| `pickup_proposed`      | Provider proposed a pickup slot                              | `confirmed`, `reschedule_requested`, `cancelled`                    |
| `confirmed`            | Parties agreed on pickup/slot                                | `invoice_created`, `reschedule_requested`, `cancelled`              |
| `reschedule_requested` | Either side requested a new pickup time (not a cancellation) | `pickup_proposed`, `confirmed`, `cancelled`                         |
| `invoice_created`      | Provider generated invoice after pickup                      | `completed`, `cancelled`                                            |
| `cancelled`            | Booking cancelled by either party                            | terminal                                                            |
| `completed`            | Order created and booking lifecycle ended                    | terminal                                                            |

State vector notes:

- Booking status and booking-fee status are separate concerns.
- `bookingFeeStatus` transitions: `pending` -> `paid` -> (`refunded`, `forfeited`, or `applied` based on downstream outcomes).
- Provider acceptance is allowed only when `bookingFeeStatus = paid`.

### Order (Commitment → Settlement) States

| State              | Meaning                            |
| ------------------ | ---------------------------------- |
| `invoiced`         | invoice paid; funds held in escrow |
| `processing`       | provider has started work          |
| `washing`          | cleaning in progress               |
| `ironing`          | finishing in progress              |
| `ready`            | ready for delivery or pickup       |
| `out_for_delivery` | provider is actively delivering    |
| `delivered`        | OTP verified; service complete     |

Rules:

- The system must enforce valid transitions.
- The system must time-stamp every transition and record the actor.
- Payment status lifecycle is tracked separately from process status: `unpaid` -> `paid` -> (`held` after OTP confirmation) -> `released` -> payout completion, with `refunded` as a terminal financial branch when applicable.

Reschedule rules:

- Rescheduling is a **booking-level** action and is explicitly **not** cancellation.
- Either seeker or provider may request reschedule while pickup is still being negotiated.
- When a reschedule is requested, the system must clear any pickup confirmation timestamp (e.g., `pickupSlot.confirmedAt`) and return the booking to the propose/confirm flow.
- The system should record metadata for repeatability and audit (who requested, when, reason, count, previous slot snapshot).

### Complaint (Dispute Resolution) States

| State       | Meaning                                              | Allowed Next States                 |
| ----------- | ---------------------------------------------------- | ----------------------------------- |
| `open`      | Seeker raised a complaint; escrow frozen             | `accepted`                          |
| `accepted`  | Admin acknowledged; 7-day response deadline set      | `in_review`, `resolved`, `rejected` |
| `in_review` | Provider added to chat; active mediation in progress | `resolved`, `rejected`              |
| `resolved`  | Admin decided; escrow action executed                | terminal                            |
| `rejected`  | Invalid complaint; escrow released to provider       | terminal                            |

Complaint workflow rules:

- **One order, one complaint**: Each order may have at most one complaint.
- **Escrow freeze on complaint**: When a seeker raises a complaint, the escrow release timer halts immediately.
- **Admin acceptance required**: Complaints begin in `open` state and require admin acceptance before proceeding.
- **Response deadline**: When admin accepts a complaint, a response deadline is set (default 7 days). Provider is notified.
- **Provider access control**: Provider enters the complaint chat only when admin explicitly grants access (moves to `in_review`).
- **3-way chat**: Once provider is added, the complaint becomes a 3-way conversation (Admin, Seeker, Provider).
- **Resolution outcomes**: Admin can resolve with: `release_payout`, `refund_partial` (slider-based split), `refund_full` (full distributable to seeker), or `reject`.
- **Immutable resolution**: Once resolved or rejected, the complaint cannot be reopened.
- **Finalized-thread access**: After `resolved`/`rejected`, seeker/provider chat posting is blocked and UI is archived/read-only; admin retains audit visibility.
- **Finalized visibility/access revocation**: On `resolved`/`rejected`, provider chat access grant is revoked and seeker/provider complaint menus hide the case (ongoing-only listing).

## 7. Data & Integrity Rules

- **Immutable financial record**
  Paid invoices must remain unchanged. Adjustments require a new invoice or an explicit admin action.

- **Capacity is a hard constraint**
  The provider cannot accept a booking that would exceed configured capacity.

- **Location changes during active work require protection**
  Provider location and radius updates must not break active commitments.

## 8. Security & Abuse Prevention

- **Tokenized payments**
  Store payment references, not raw card data.

- **Escrow freeze on dispute**
  Any complaint or dispute must halt settlement timers until the admin decides the outcome.

- **Origin and abuse controls on unsafe actions**
  Unsafe API methods must enforce same-origin checks and endpoint-specific rate limits.

- **CSP staged rollout**
  The platform must run Content Security Policy in report-only mode first, collect violations, then move to enforced mode once violations are cleaned.

- **Complaint access control**
  Provider can only view complaint details after admin explicitly grants access. Seeker and admin have access from creation.

- **Finalized complaint chat protection**
  Resolved/rejected complaint message access is restricted to admin for audit-only handling.

- **Response deadline tracking**
  System tracks provider response deadline (default 7 days from acceptance) and surfaces overdue complaints to admin.

- **Progress requires authorization**
  Only the provider assigned to the order can advance lifecycle states.

- **Selective disclosure of PII**
  The system should hide full address details until a booking reaches a state where fulfillment requires them.

## 9. Observability & Failure Strategy

- **Audit log**
  Capture: entity, previous state, next state, actor, timestamp, and correlated payment identifiers.

- **Expiry and cleanup**
  Automatically expire stale booking requests to avoid orphaned intent.

- **Payment reconciliation**
  Regularly reconcile payment provider records against internal payment state.

## 10. Out of Scope

- IoT integration with machines
- Multi-stop route optimization
- Provider inventory management (supplies)

## 11. Success Metrics

- **Completion reliability**: delivered / invoiced
- **Dispute rate**: complaints per invoiced order
- **Complaint resolution time**: average time from complaint `open` to `resolved`/`rejected`
- **Provider response compliance**: percentage of complaints with provider response within deadline
- **Time-to-clarity**: reduction in seeker-to-provider status calls/messages (proxy via support/contact rates)

## 12. Environment Setup & Configuration

### Required Environment Variables

LaundryEase requires the following environment variables to be configured (see `.env.example` for template):

**Authentication & OAuth:**

- `GOOGLE_ID` - Google OAuth client ID
- `GOOGLE_SECRET` - Google OAuth client secret
- `NEXTAUTH_SECRET` - Secret for NextAuth JWT signing (generate: `openssl rand -base64 32`)
- `NEXTAUTH_URL` - Application base URL (optional, defaults to localhost:3000)

**Database:**

- `MONGODB_URI` - MongoDB connection string
- `MONGODB_DB` - Database name (defaults to "laundryease")

**Email & SMS (OTP Delivery):**

- `EMAIL_USER` - Email address for sending OTP emails
- `EMAIL_PASS` - App-specific password for email service
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio authentication token
- `TWILIO_PHONE_NUMBER` - Twilio phone number (E.164 format)

**Payments (Razorpay):**

- `RAZORPAY_KEY_ID` - Razorpay API key ID
- `RAZORPAY_KEY_SECRET` - Razorpay API key secret
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` - Same as RAZORPAY_KEY_ID (exposed to client)
- `RAZORPAYX_ACCOUNT_NUMBER` - RazorpayX account number for escrow

Note: TypeScript type definitions for the Razorpay SDK are maintained in `types/razorpay.d.ts` for type-safe integration with the checkout widget.

**Google Maps:**

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Google Maps API key (requires Maps JavaScript API, Places API, Geocoding API)

**Security:**

- `CRON_SECRET` - Secret for securing cron job endpoints (generate: `openssl rand -base64 32`)

**Optional:**

- `NEXT_PUBLIC_BASE_URL` - Public application URL for email links
- `NEXT_PUBLIC_APP_URL` - Alternative application URL
- `CSP_ENFORCE` - Set to `true` to switch CSP from report-only to enforced header mode
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name (for image uploads)
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret

### Setup Instructions

1. Copy `.env.example` to `.env.local`
2. Fill in all required variables with actual values
3. Ensure all external services (Razorpay, Twilio, Google Cloud) are configured
4. Start the app once so startup index bootstrap can initialize integrity/query/TTL indexes automatically
5. Start the development server: `npm run dev`

See `README.md` for detailed setup instructions.

## 13. Open Questions & Risks

- **Cash payments**
  If providers accept cash outside escrow, the trust contract breaks and the platform loses its enforcement mechanism.

- **No-show policy**
  No-show automation is implemented, but operational policy still needs tuning for false positives (timezone drift, late manual overrides, and retriable refund failures).

- **Post-payout reversals**
  Refund requests after payout initiation are currently blocked for automatic safety and require manual clawback operations.

- **Reschedule abuse / infinite loops**
  The platform needs a policy for excessive reschedule requests (caps, cooldowns, or admin escalation) to prevent griefing.

- **Complaint window extension requests**
  If a seeker misses the 24-hour complaint window due to legitimate reasons (travel, illness), there's no current mechanism to request an extension.

- **Split-settlement reconciliation**
  If one financial leg succeeds (for example payout initiated) and the second leg fails (for example refund failure), admin follow-up tooling is still required to fully reconcile the case.

## 14. Implementation Alignment Matrix (2026-02-15)

| PRD Requirement                 | Expected Behavior                                                                                                                | Current System Status                                                                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Verified signup                 | Email + phone OTP required before account creation                                                                               | Implemented (OTP required in signup APIs; created users now persist as verified)                                                                                         |
| Password policy                 | 8+ chars, uppercase, number, special char                                                                                        | Implemented in signup and reset-password APIs                                                                                                                            |
| Password reset                  | Reset must update real auth credential store                                                                                     | Implemented (reset now updates `passwordHash` in seeker/provider/admin collections)                                                                                      |
| Discovery coverage              | Show only providers whose radius covers seeker coordinate                                                                        | Implemented (strict provider-radius filtering; optional seeker-side radius cap)                                                                                          |
| Booking fee gate                | Provider cannot accept unpaid booking                                                                                            | Implemented                                                                                                                                                              |
| Booking cancellation policy     | Seeker can cancel only before slot time; same-day seeker cancellation forfeits fee; provider cancellation/refusal refunds fee    | Implemented                                                                                                                                                              |
| Booking-fee release control     | Booking-fee payout should trigger only on provider arrival and geofence compliance                                               | Implemented                                                                                                                                                              |
| Capacity limit                  | Provider acceptance blocked when at capacity                                                                                     | Implemented via transactional checks                                                                                                                                     |
| Invoice review                  | Seeker can approve/reject invoice with reason on reject                                                                          | Implemented                                                                                                                                                              |
| Invoice reject outcome          | Booking should terminate with booking fee forfeiture                                                                             | Implemented (`cancelled` + `bookingFeeStatus=forfeited`)                                                                                                                 |
| Order payment auth              | Only order owner can initialize/verify payment                                                                                   | Implemented on canonical payment routes and legacy aliases                                                                                                               |
| Payment integrity               | Verification must bind to server-created Razorpay order                                                                          | Implemented on canonical payment routes and legacy aliases                                                                                                               |
| Payment idempotency             | Re-verification should not create duplicates                                                                                     | Implemented on payment verification paths                                                                                                                                |
| CSP telemetry pipeline          | Security policy should be staged with violation reporting before enforcement                                                     | Implemented (`next.config.ts` CSP Report-Only + `/api/security/csp-report`; enforce mode behind `CSP_ENFORCE`)                                                           |
| Order activation                | Paid invoice should result in active order linkage                                                                               | Implemented (booking linked to order in invoice and pay-invoice paths)                                                                                                   |
| Deadline guarantee              | Booking requires deadline; pickup must respect deadline; late delivery auto-compensates seeker                                   | Implemented (deadline required at booking, enforced in pickup scheduling, propagated to orders, and compensated at OTP delivery confirmation with idempotent safeguards) |
| Delivery scheduling auth        | Provider proposes, seeker confirms                                                                                               | Implemented                                                                                                                                                              |
| Delivery OTP                    | Delivery requires OTP and starts escrow hold window                                                                              | Implemented                                                                                                                                                              |
| Complaint window                | Complaint allowed only within 24h after delivery                                                                                 | Implemented                                                                                                                                                              |
| One order one complaint         | Prevent multiple complaints per order                                                                                            | Implemented                                                                                                                                                              |
| Complaint immutability          | Resolved/rejected complaints are terminal                                                                                        | Implemented                                                                                                                                                              |
| Complaint navigation visibility | Seeker/provider menus show complaints only for ongoing cases; provider only after admin grants access                            | Implemented                                                                                                                                                              |
| Finalized complaint chat lock   | Seeker/provider cannot continue messaging after resolve/reject; UI archived                                                      | Implemented                                                                                                                                                              |
| Complaint split settlement      | Admin can split distributable amount between seeker and provider (`refund_partial`) with commission preserved                    | Implemented                                                                                                                                                              |
| Reject complaint outcome        | Rejecting a complaint pays provider full distributable amount (post-commission) and finalizes case as hidden for seeker/provider | Implemented                                                                                                                                                              |
| Settlement outcome breadth (E2E) | Browser-level coverage should validate split, reject/provider-favor, and full seeker-refund complaint outcomes                  | Implemented (`e2e/settlement-chain-journey.spec.ts`)                                                                                                                    |
| E2E diagnostics hygiene         | End-to-end test output should be readable and low-noise for CI triage                                                            | Implemented (`scripts/run-playwright.mjs` sanitizes `NO_COLOR` conflict in E2E runner env)                                                                             |
| Escrow release gating           | Open complaints must block payout release                                                                                        | Implemented                                                                                                                                                              |
| Escrow payout orchestration     | Cron/manual/admin payout actions must run through one idempotent processor with lock + failure recording                         | Implemented (`lib/payouts.ts`)                                                                                                                                           |
| Admin refund safety             | Admin refunds must enforce payment-state and payout-state guardrails                                                             | Implemented                                                                                                                                                              |
| No-show automation              | Missed confirmed pickup should auto-mark no-show                                                                                 | Implemented                                                                                                                                                              |
| Auditability                    | State transitions and financial events should be traceable                                                                       | Implemented (state/escrow audits + idempotent webhook event tracking/reconciliation)                                                                                     |

### Remaining Hardening Opportunities

1. Add alerting/monitoring dashboards for index creation failures caused by pre-existing duplicate historical data.
2. Add staging smoke coverage for live gateway paths (CI remains deterministic with fake-payments mode for reliability).
3. Add archival policy for old webhook payloads to control long-term storage growth.
4. Add abuse hardening on password-recovery endpoints (rate limits/captcha strategy).
5. Promote CSP from report-only to enforced mode after violation cleanup.
