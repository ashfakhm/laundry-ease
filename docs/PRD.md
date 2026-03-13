# LaundryEase — Product Requirements Document (Rev 13)

## 1. Executive Summary

LaundryEase turns a local laundry job into a verifiable contract.

It does that by splitting the transaction into two moments:

- a **handshake** (booking) where slot intent is created and a booking-fee payment gate controls provider acceptance, and
- a **commitment** (paid invoice) where the seeker locks order funds in escrow and the provider begins work.

From commitment to delivery, the system advances through explicit states and releases escrow only after OTP-confirmed handoff.

## 2. Goals & Non-Goals

### Goals

- **Remove payment ambiguity**
  Providers should never wonder whether they'll get paid after they've consumed time, utilities, and labor.

- **Replace status guessing with recorded facts**
  Seekers should see the job as a timeline of states, not a chat thread.

- **Prevent unviable matches at the source**
  The search experience should surface only providers who deliberately cover the seeker's location.

- **Create an auditable transaction trail**
  The platform must record state transitions and payment events so support can resolve edge cases with evidence.

- **Enforce operational health observability**
  The platform must detect overdue payouts, complaint backlogs, and abuse patterns automatically, alerting operators before issues escalate.

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
- acknowledge and own operational system alerts
- monitor platform health via dashboards (alert trends, MTTR, burn-rate)

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

**Authentication Methods:**

- **Email/Password**: Signup with OTP verification → bcrypt password hash → NextAuth credentials provider
- **Google OAuth**: NextAuth Google provider → callback → role selection → profile completion
- **Magic Link**: Email-based passwordless login via JWT token (24-hour expiry)

**Password Policy:**

- Minimum 8 characters
- At least one uppercase letter
- At least one number
- At least one special character
- Password confirmation must match
- Real-time validation feedback during entry
- Enforced on signup, profile update, and password reset

**Password Reset (Forgot Password):**

- Secure token-based reset: `randomBytes(32)` for token, SHA-256 hash stored in DB (raw token never persisted)
- Token expires after 1 hour with MongoDB TTL index auto-cleanup
- Anti-enumeration: generic "If an account exists, a reset link has been sent" response regardless of email existence
- Rate limiting: per-IP (10 requests/15min) and per-email (4 requests/hour) buckets
- Branded HTML + plain text email template with reset link, expiry notice, and security warnings
- Client-side: 60-second cooldown on resend button, generic error messages, special 429 handling
- On successful reset: `passwordChangedAt` timestamp set, all active reset tokens invalidated, "password changed" notification email sent

**In-App Password Change:**

- Both seeker and provider can change password via profile settings
- Requires current password verification (bcrypt compare)
- New password validated against password policy
- Sets `passwordChangedAt` and `updatedAt` atomically
- Enqueues "password changed" security notification email

**Session Invalidation After Password Change:**

- JWT callback periodically re-checks the database (every 5 minutes)
- Compares `passwordChangedAt` against token's `iat` (issued-at timestamp)
- If password was changed after token issuance, token is invalidated
- NextAuth reports `unauthenticated`, forcing re-sign-in on the client
- Applies to both forgot-password reset and in-app profile password changes

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
   Provider issues an invoice based on the inspected items. The provider may optionally apply a **discount** to the invoice. When a discount is applied, the total payable by the seeker is reduced (`total = subtotal - discount`), but the platform commission is still calculated on the **pre-discount subtotal** (see Settlement Math in Section D).

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
   - **Cancels booking (fee forfeited)**: Seeker may also cancel the entire booking at this stage using the **"Cancel & Reject Invoice"** button. This terminates the booking with `bookingFeeStatus = forfeited` — the provider has already physically collected and inspected the items, so the fee is non-refundable regardless of whether the seeker is within the 2-hour free-cancel window.

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

   Settlement math is commission-aware: platform commission is always calculated as **5% of the pre-discount subtotal** (the sum of item prices before any provider-applied discount), not on the discounted total. The distributable amount is `total_price - platform_commission`, where `total_price = subtotal - discount + delivery_charge`. The slider applies only on the distributable amount.

   **Example**: subtotal = ₹1000, discount = ₹200, delivery = ₹50 → total_price = ₹850, platform_commission = ₹50 (5% of ₹1000), distributable = ₹800.

   With this rule, the platform retains the same commission regardless of discounts applied by the provider. Successful/no-complaint or rejected-complaint outcomes pay the provider the full distributable amount.

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
  Provider rejection/cancellation must refund paid booking fee. Seeker cancellation within 2 hours of booking creation is free (full refund); after that window, the booking fee is forfeited. Seeker cannot cancel at or after the scheduled pickup time — **except** at the `invoice_created` stage, where cancellation is always permitted (the pickup slot is already in the past by definition) but the booking fee is **always forfeited** regardless of timing, since the provider has already done physical work collecting and inspecting items.

- **Unified payout orchestration**
  Escrow release, payout initiation, complaint gating, and admin-triggered manual release must use a shared idempotent payout processor.

- **OTP delivery authentication**
  Delivery must require a one-time code.

- **Complaint window enforcement**
  Seekers must raise complaints within 24 hours of delivery. After this window, escrow may auto-release.

- **Real-time order chat**
  Seekers and providers must be able to exchange messages on active orders in real time via Socket.IO (`order:<id>` rooms). Messages are persisted in the `order_chats` collection and pushed live to connected participants. Admins may also access order chat rooms.

- **Rich Media Messaging**
  Order and complaint chats must support voice message recording and photo attachments (up to 5 photos per message in order chat). Voice audio formats and images are securely stored in Cloudinary.

- **Message Deletion**
  Users must be able to delete messages. The system must support WhatsApp-style deletion: `for_me` (hidden locally for the user) and `for_everyone` (within a configurable 1-hour window, clearing content and showing a placeholder). Complaint chat additionally supports `admin_hard_delete` (permanent removal by admins with no trace).

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

- **Rate limiting**
  Sensitive API endpoints (admin actions, signup, password reset, cron) must enforce per-IP or per-actor rate limits to prevent abuse.

- **Email outbox with retry**
  Transactional emails (OTP, password reset, delivery OTP, magic link) must be queued through an outbox pattern with configurable retry, exponential backoff, and dead-letter tracking.

- **Operational health monitoring**
  The system must detect and alert on: overdue held orders (past escrow release window), payout failure spikes, and overdue complaint response deadlines.

- **Alert lifecycle management**
  System alerts must support acknowledgement, SLA tracking (15 min critical, 60 min high), owner assignment, and escalation routing.

- **Abuse monitoring**
  The system must periodically scan for excessive cancellation patterns and flag suspicious accounts.

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
  - Password show/hide toggles on all password inputs (reset page, profile pages)

- **Financial precision**
  All monetary calculations must use paise-level integer arithmetic or `decimal.js` to prevent floating-point drift.

- **Structured logging**
  All backend operations must use structured logging (Pino) with secret redaction to prevent credential leakage in log output.

- **Cron observability**
  Every cron job run must be tracked in `cron_runs` collection with start time, duration, status, and result for operational auditing.

- **Email delivery reliability**
  Transactional emails must be queued through an outbox pattern with retry/backoff. Five email types supported: delivery OTP, password reset, password changed notification, magic link, and email OTP. Inline dispatch attempted on enqueue with cron fallback.

- **Real-time chat**
  Order chat and complaint chat must deliver messages in real time without requiring page refresh. The system must use a persistent Socket.IO connection hosted with the main Next.js server. Every connection must use a signed login token. Room access must be checked against MongoDB so only the right people can join. Per-socket rate limiting must prevent too many room-join requests.

- **Session security after credential changes**
  Password changes (via reset or profile) must write a `passwordChangedAt` timestamp. JWT sessions must be periodically re-validated against this timestamp to ensure stale sessions are invalidated.

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
| `invoice_created`      | Provider generated invoice after pickup                      | `completed`, `cancelled` (seeker cancel: fee always forfeited)      |
| `cancelled`            | Booking cancelled by either party                            | terminal                                                            |
| `completed`            | Order created and booking lifecycle ended                    | terminal                                                            |

State vector notes:

- Booking status and booking-fee status are separate concerns.
- `bookingFeeStatus` transitions: `pending` -> `paid` -> (`refunded`, `forfeited`, or `applied` based on downstream outcomes).
- Seeker cancellation at `invoice_created` always results in `bookingFeeStatus = forfeited` regardless of the 2-hour free-cancel window — the provider has performed physical work.
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

### System Alert Lifecycle

| State          | Meaning                                  |
| -------------- | ---------------------------------------- |
| `open`         | Operational signal detected              |
| `acknowledged` | Admin/oncall acknowledged with ownership |
| `resolved`     | Issue resolved; alert closed             |

Alert rules:

- **SLA enforcement**: Critical alerts must be acknowledged within 15 minutes; high alerts within 60 minutes.
- **Owner routing**: SLA-breached critical alerts auto-route to `backend_oncall`; high alerts load-balance between `platform_admin_oncall` and `backend_oncall`.
- **Persistent escalation**: SLA-breached alerts that remain unacknowledged beyond persistent thresholds (60 min critical, 4h high) escalate to `tech_lead`.
- **Notification dedup**: Alert notifications are deduplicated with a 1-hour minimum spacing to prevent alert fatigue.
- **Escalation cadence**: Escalation notifications repeat at most every 6 hours per alert.

## 7. Data & Integrity Rules

- **Immutable financial record**
  Paid invoices must remain unchanged. Adjustments require a new invoice or an explicit admin action.

- **Capacity is a hard constraint**
  The provider cannot accept a booking that would exceed configured capacity.

- **Location changes during active work require protection**
  Provider location and radius updates must not break active commitments.

- **Webhook idempotency**
  All Razorpay webhook events must be deduplicated via `webhook_events.event_id` unique constraint to prevent double-processing.

- **Audit integrity**
  A periodic cron job (`audit-integrity`) must verify data consistency between orders, payments, and bookings every 30 minutes.

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

#### 5. User Interface Extensions
- **Deadline Visibility**: The expected delivery deadline is exposed to both seekers and providers across the order lifecycle.
  - **Seeker**: Sees deadline on booking history cards, invoice review screen, and order tracking dashboard (next to 'placed on' date).
  - **Provider**: Sees deadline during invoice generation and sorted list of order statuses, flagging orders that are 'overdue'.
  - **Admin**: Sees response deadlines on complaint detail pages with visual 'overdue' indicators.

- **Progress requires authorization**
  Only the provider assigned to the order can advance lifecycle states.

- **Selective disclosure of PII**
  The system should hide full address details until a booking reaches a state where fulfillment requires them.

- **Rate limiting on sensitive endpoints**
  Admin actions, signup, password reset, and OTP endpoints enforce per-IP rate limits via MongoDB-backed counters with automatic TTL cleanup. Forgot-password has per-IP (10/15min) and per-email (4/hour) buckets. Reset-password has per-IP (15/15min) and per-token (6/hour) buckets.

- **Structured log redaction**
  Pino logger natively redacts sensitive fields (password, token, OTP, apiKey, etc.) from all log output before serialization.

- **Proxy trust model**
  IP extraction for rate limiting respects `x-vercel-forwarded-for`, `x-real-ip`, and `cf-connecting-ip` headers with configurable `TRUST_PROXY` flag.

- **Secure password reset tokens**
  Reset tokens use `randomBytes(32)` for generation; only SHA-256 hash is stored in database. Raw token never persisted. Tokens auto-expire after 1 hour via MongoDB TTL index. All active tokens invalidated on successful reset.

- **Anti-enumeration on password reset**
  Forgot-password endpoint returns the same generic success message whether or not the email exists in the system. Timing-attack mitigation ensures consistent response times.

- **Session invalidation on password change**
  `passwordChangedAt` timestamp written on every password change (reset or profile). JWT callback re-checks the database every 5 minutes and invalidates tokens issued before the password change.

- **Password change notifications**
  Branded security email sent to the user on every password change (both forgot-password reset and in-app profile change) with timestamp, account reference, and instructions for unauthorized changes.

## 9. Observability & Failure Strategy

- **Audit log**
  Capture: entity, previous state, next state, actor, timestamp, and correlated payment identifiers.

- **Expiry and cleanup**
  Automatically expire stale booking requests to avoid orphaned intent.

- **Payment reconciliation**
  Regularly reconcile payment provider records against internal payment state via scheduled cron (`/api/cron/reconciliation`).

- **Cron run tracking**
  Every cron job execution is recorded in `cron_runs` collection with job name, start time, completion time, duration, status, result, and error details.

- **Operational health monitoring**
  Hourly cron (`/api/cron/monitor-operational-health`) evaluates overdue held orders, payout failure spikes, and overdue complaints against configurable thresholds, creating/updating `system_alerts`.

- **Alert notification & escalation**
  Every 15 minutes, `/api/cron/notify-system-alerts` builds a delivery plan (notify + escalate lists), sends email digests and/or webhook payloads, and tracks notification timestamps for deduplication.

- **Alert analytics**
  Admin dashboard exposes 7-day opened-vs-resolved trend, burn-rate tier (stable/watch/high/critical), and mean-time-to-resolve (MTTR) for recent alerts.

- **Email delivery reliability**
  Email outbox pattern with claim-and-lock processing, exponential backoff retries (30s base, 30 min cap), and permanent failure tracking after configurable max attempts (default 5).

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
- **Alert acknowledgement SLA**: percentage of critical/high alerts acknowledged within SLA window
- **Payout reliability**: percentage of eligible escrow payouts processed within expected window

## 12. Environment Setup & Configuration

### Required Environment Variables

LaundryEase requires the following environment variables to be configured (see `.env.example` for template):

**Authentication & OAuth:**

- `AUTH_GOOGLE_ID` - Google OAuth client ID
- `AUTH_GOOGLE_SECRET` - Google OAuth client secret
- `AUTH_SECRET` - Secret used to sign login sessions (generate: `openssl rand -base64 32`)
- `AUTH_URL` - Main application URL (optional, defaults to localhost:3000)

Legacy aliases are still accepted: `GOOGLE_ID`, `GOOGLE_SECRET`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL`.

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

**Operational Alerting:**

- `OPS_ALERT_EMAIL_TO` - Comma-separated email recipients for alert digests
- `OPS_ALERT_WEBHOOK_URL` - Webhook URL for alert delivery (e.g., Slack, PagerDuty)
- `OPS_ALERT_WEBHOOK_BEARER` - Bearer token for webhook authentication

**Optional:**

- `NEXT_PUBLIC_BASE_URL` - Public application URL for email links
- `NEXT_PUBLIC_APP_URL` - Alternative application URL
- `CSP_ENFORCE` - Set to `true` to switch CSP from report-only to enforced header mode
- `TRUST_PROXY` - Set to `true` to trust `x-forwarded-for` headers behind a reverse proxy
- `DEBUG_LOGGING` - Set to `true` to enable debug-level Pino logging in production
- `ADMIN_ALLOWLIST_IPS` - Comma-separated IP allowlist for admin API access restriction
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name (for image uploads)
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret
- `DATADOG_API_KEY` - Datadog API key for APM tracing via dd-trace
- `DD_API_KEY` - Alternative Datadog API key
- `OPS_PAGERDUTY_ROUTING_KEY` - PagerDuty routing key for alert integration
- `E2E_FAKE_PAYMENTS` - Set to `1` to bypass real Razorpay in E2E tests
- `CSP_ALLOW_UNSAFE_EVAL` - Set to `true` to allow unsafe-eval in CSP (dev only)

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
  ~~If a seeker misses the 24-hour complaint window due to legitimate reasons (travel, illness), there's no current mechanism to request an extension.~~
  **Implemented**: Admin can extend the complaint filing window via `POST /api/admin/orders/[id]/extend-complaint` with a new deadline date.

- **Split-settlement reconciliation**
  If one financial leg succeeds (for example payout initiated) and the second leg fails (for example refund failure), admin follow-up tooling is still required to fully reconcile the case.

- **Team calendar / on-call integration**
  Alert owner routing currently uses static pools (`backend_oncall`, `platform_admin_oncall`, `tech_lead`). Real dynamic on-call scheduling requires external calendar integration.

## 14. Implementation Alignment Matrix (2026-03-07 — Rev 13)

| PRD Requirement                   | Expected Behavior                                                                                                                                                                                                                                                                               | Current System Status                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified signup                   | Email + phone OTP required before account creation                                                                                                                                                                                                                                              | Implemented (OTP required in signup APIs; created users now persist as verified)                                                                                                                                                                                                                                                                                      |
| Password policy                   | 8+ chars, uppercase, number, special char                                                                                                                                                                                                                                                       | Implemented in signup, reset-password, and profile update APIs                                                                                                                                                                                                                                                                                                        |
| Password reset                    | Reset must update real auth credential store and invalidate sessions                                                                                                                                                                                                                            | Implemented (reset updates `passwordHash` + `passwordChangedAt` in seeker/provider/admin collections; JWT re-check invalidates stale sessions within 5 min)                                                                                                                                                                                                           |
| Password reset security           | Secure token storage, anti-enumeration, rate limiting, branded emails                                                                                                                                                                                                                           | Implemented (SHA-256 token hash, generic responses, per-IP + per-email rate limits, branded HTML templates, 1hr TTL, all tokens invalidated on success)                                                                                                                                                                                                               |
| Password change notification      | User must be notified when password changes                                                                                                                                                                                                                                                     | Implemented (`password_changed` security email enqueued on both reset and profile-driven password changes)                                                                                                                                                                                                                                                            |
| Session invalidation              | Password change must invalidate existing sessions                                                                                                                                                                                                                                               | Implemented (JWT callback re-checks `passwordChangedAt` every 5 min; tokens issued before change are invalidated)                                                                                                                                                                                                                                                     |
| In-app password change            | Users can change password from profile with current password verification                                                                                                                                                                                                                       | Implemented (both seeker PUT and provider PATCH profile routes support `currentPassword` + `newPassword` with bcrypt verification)                                                                                                                                                                                                                                    |
| Discovery coverage                | Show only providers whose radius covers seeker coordinate                                                                                                                                                                                                                                       | Implemented (strict provider-radius filtering; optional seeker-side radius cap)                                                                                                                                                                                                                                                                                       |
| Booking fee gate                  | Provider cannot accept unpaid booking                                                                                                                                                                                                                                                           | Implemented                                                                                                                                                                                                                                                                                                                                                           |
| Booking cancellation policy       | Seeker can cancel only before slot time; seeker cancellation within 2 hours of booking creation gets full refund; after 2-hour window, booking fee forfeited; provider cancellation always refunds fee; seeker can cancel at `invoice_created` (fee always forfeited, slot-time guard bypassed) | Implemented — `evaluateCancellationPolicy()` in `lib/bookings/cancellation-policy.ts` is the single source of truth; `SEEKER_FREE_CANCEL_WINDOW_MS = 2h` in `lib/constants.ts`; cancel route adds `invoice_created` to seeker allowed statuses and bypasses slot-time guard for that stage; UI shows "Cancel & Reject Invoice" button with fee-forfeit confirm dialog |
| Cancel at `invoice_created` stage | Seeker must be able to cancel after provider creates invoice, even though pickup slot has passed; booking fee must always be forfeited at this stage                                                                                                                                            | Implemented — `cancel/route.ts` skips slot-time check when `booking.status === "invoice_created"`; policy engine returns `refundAction: "forfeit"` unconditionally for this status; UI button label and confirm dialog updated                                                                                                                                        |
| Booking-fee release control       | Booking-fee payout should trigger only on provider arrival and geofence compliance                                                                                                                                                                                                              | Implemented                                                                                                                                                                                                                                                                                                                                                           |
| Capacity limit                    | Provider acceptance blocked when at capacity                                                                                                                                                                                                                                                    | Implemented via transactional checks                                                                                                                                                                                                                                                                                                                                  |
| Invoice review                    | Seeker can approve/reject invoice with reason on reject                                                                                                                                                                                                                                         | Implemented                                                                                                                                                                                                                                                                                                                                                           |
| Invoice reject outcome            | Booking should terminate with booking fee forfeiture                                                                                                                                                                                                                                            | Implemented (`cancelled` + `bookingFeeStatus=forfeited`)                                                                                                                                                                                                                                                                                                              |
| Order payment auth                | Only order owner can initialize/verify payment                                                                                                                                                                                                                                                  | Implemented on canonical payment routes and legacy aliases                                                                                                                                                                                                                                                                                                            |
| Payment integrity                 | Verification must bind to server-created Razorpay order                                                                                                                                                                                                                                         | Implemented on canonical payment routes and legacy aliases                                                                                                                                                                                                                                                                                                            |
| Payment idempotency               | Re-verification should not create duplicates                                                                                                                                                                                                                                                    | Implemented on payment verification paths                                                                                                                                                                                                                                                                                                                             |
| Financial precision               | All monetary calculations must use paise-level integers or decimal.js                                                                                                                                                                                                                           | Implemented (`decimal.js` for payout calculations, paise-based Razorpay amounts)                                                                                                                                                                                                                                                                                      |
| CSP telemetry pipeline            | Security policy should be staged with violation reporting before enforcement                                                                                                                                                                                                                    | Implemented (`next.config.ts` CSP Report-Only + `/api/security/csp-report`; enforce mode behind `CSP_ENFORCE`)                                                                                                                                                                                                                                                        |
| Order activation                  | Paid invoice should result in active order linkage                                                                                                                                                                                                                                              | Implemented (booking linked to order in invoice and pay-invoice paths)                                                                                                                                                                                                                                                                                                |
| Deadline guarantee                | Booking requires deadline; pickup must respect deadline; late delivery auto-compensates seeker                                                                                                                                                                                                  | Implemented (deadline required at booking, enforced in pickup scheduling, propagated to orders, and compensated at OTP delivery confirmation with idempotent safeguards)                                                                                                                                                                                              |
| Delivery scheduling auth          | Provider proposes, seeker confirms                                                                                                                                                                                                                                                              | Implemented                                                                                                                                                                                                                                                                                                                                                           |
| Delivery OTP                      | Delivery requires OTP and starts escrow hold window                                                                                                                                                                                                                                             | Implemented                                                                                                                                                                                                                                                                                                                                                           |
| Complaint window                  | Complaint allowed only within 24h after delivery                                                                                                                                                                                                                                                | Implemented                                                                                                                                                                                                                                                                                                                                                           |
| One order one complaint           | Prevent multiple complaints per order                                                                                                                                                                                                                                                           | Implemented                                                                                                                                                                                                                                                                                                                                                           |
| Complaint immutability            | Resolved/rejected complaints are terminal                                                                                                                                                                                                                                                       | Implemented                                                                                                                                                                                                                                                                                                                                                           |
| Complaint navigation visibility   | Seeker/provider menus show complaints only for ongoing cases; provider only after admin grants access                                                                                                                                                                                           | Implemented                                                                                                                                                                                                                                                                                                                                                           |
| Finalized complaint chat lock     | Seeker/provider cannot continue messaging after resolve/reject; UI archived                                                                                                                                                                                                                     | Implemented                                                                                                                                                                                                                                                                                                                                                           |
| Complaint split settlement        | Admin can split distributable amount between seeker and provider (`refund_partial`) with commission preserved                                                                                                                                                                                   | Implemented                                                                                                                                                                                                                                                                                                                                                           |
| Reject complaint outcome          | Rejecting a complaint pays provider full distributable amount (post-commission) and finalizes case as hidden for seeker/provider                                                                                                                                                                | Implemented                                                                                                                                                                                                                                                                                                                                                           |
| Settlement outcome breadth (E2E)  | Browser-level coverage should validate split, reject/provider-favor, and full seeker-refund complaint outcomes                                                                                                                                                                                  | Implemented (`e2e/settlement-chain-journey.spec.ts`)                                                                                                                                                                                                                                                                                                                  |
| E2E diagnostics hygiene           | End-to-end test output should be readable and low-noise for CI triage                                                                                                                                                                                                                           | Implemented (`scripts/run-playwright.mjs` sanitizes `NO_COLOR` conflict in E2E runner env)                                                                                                                                                                                                                                                                            |
| Escrow release gating             | Open complaints must block payout release                                                                                                                                                                                                                                                       | Implemented                                                                                                                                                                                                                                                                                                                                                           |
| Escrow payout orchestration       | Cron/manual/admin payout actions must run through one idempotent processor with lock + failure recording                                                                                                                                                                                        | Implemented (`lib/payouts.ts` with concurrent batch processing)                                                                                                                                                                                                                                                                                                       |
| Admin refund safety               | Admin refunds must enforce payment-state and payout-state guardrails                                                                                                                                                                                                                            | Implemented                                                                                                                                                                                                                                                                                                                                                           |
| No-show automation                | Missed confirmed pickup should auto-mark no-show                                                                                                                                                                                                                                                | Implemented                                                                                                                                                                                                                                                                                                                                                           |
| Auditability                      | State transitions and financial events should be traceable                                                                                                                                                                                                                                      | Implemented (state/escrow audits + idempotent webhook event tracking/reconciliation)                                                                                                                                                                                                                                                                                  |
| Rate limiting                     | Sensitive endpoints must enforce per-IP request limits                                                                                                                                                                                                                                          | Implemented (MongoDB-backed rate limiter with TTL auto-cleanup on admin, signup, password reset, cron endpoints)                                                                                                                                                                                                                                                      |
| Structured logging                | Backend must use structured logging with secret redaction                                                                                                                                                                                                                                       | Implemented (Pino with native redaction paths for passwords, tokens, OTPs, API keys)                                                                                                                                                                                                                                                                                  |
| Email delivery reliability        | Transactional emails must be queued with retry                                                                                                                                                                                                                                                  | Implemented (`email_outbox` collection with claim-lock-dispatch pattern, exponential backoff, dead-letter tracking)                                                                                                                                                                                                                                                   |
| Operational health monitoring     | System must detect overdue payouts, payout failures, and overdue complaints                                                                                                                                                                                                                     | Implemented (`/api/cron/monitor-operational-health` → `system_alerts` with configurable thresholds)                                                                                                                                                                                                                                                                   |
| Alert notification                | Open alerts must be delivered to operators via email/webhook                                                                                                                                                                                                                                    | Implemented (`/api/cron/notify-system-alerts` with dedup, escalation, and multi-channel fan-out)                                                                                                                                                                                                                                                                      |
| Alert acknowledgement             | Admin must be able to acknowledge and own alerts                                                                                                                                                                                                                                                | Implemented (`PATCH /api/admin/system-alerts/:id/acknowledge` with SLA tracking)                                                                                                                                                                                                                                                                                      |
| Alert SLA tracking                | Critical 15 min, high 60 min acknowledgement SLAs                                                                                                                                                                                                                                               | Implemented (dashboard surfaces SLA-breached alert counts)                                                                                                                                                                                                                                                                                                            |
| Owner routing                     | SLA-breached alerts auto-assign to appropriate oncall, persistent breaches escalate to tech_lead                                                                                                                                                                                                | Implemented (`lib/ops/owner-routing.ts` with load-balanced assignment)                                                                                                                                                                                                                                                                                                |
| Alert analytics                   | Dashboard must show trend, burn-rate, and MTTR                                                                                                                                                                                                                                                  | Implemented (`lib/ops/alerts-analytics.ts` — 7d trend, burn-rate tier, MTTR)                                                                                                                                                                                                                                                                                          |
| Abuse monitoring                  | System must detect excessive cancellation patterns                                                                                                                                                                                                                                              | Implemented (`/api/cron/monitor-abuse` — daily 2 AM scan with configurable lookback/threshold)                                                                                                                                                                                                                                                                        |
| Webhook hygiene                   | Processed webhook events must be purged after retention period                                                                                                                                                                                                                                  | Implemented (`/api/cron/webhook-cleanup` — daily purge of events older than 30 days)                                                                                                                                                                                                                                                                                  |
| Complaint window extension        | Admin must be able to extend complaint filing window for exceptional cases                                                                                                                                                                                                                      | Implemented (`POST /api/admin/orders/[id]/extend-complaint`)                                                                                                                                                                                                                                                                                                          |
| Data integrity auditing           | System must periodically verify order/payment/booking consistency                                                                                                                                                                                                                               | Implemented (`/api/cron/audit-integrity` — every 30 min)                                                                                                                                                                                                                                                                                                              |
| Cron observability                | Every cron run must be tracked                                                                                                                                                                                                                                                                  | Implemented (`cron_runs` collection with `lib/cron-tracking.ts`)                                                                                                                                                                                                                                                                                                      |

| Invoice finalization safety | Invoice payment must atomically create order and link booking | Implemented (`lib/services/invoice-finalization.ts` with MongoDB transaction + compensating-write fallback for non-replica-set envs) |
| Distributed refund locking | Concurrent cancel/reject must not double-refund booking fees | Implemented (`lib/services/refund-lock.ts` with stale-lock timeout and diagnostic recovery) |
| React Compiler | Frontend should leverage compiler optimizations for performance | Implemented (`reactCompiler: true` in `next.config.ts`) |
| Real-time chat | Order chat and complaint chat must deliver messages in real time via WebSocket without polling | Implemented — `server.js` co-hosts Socket.IO with Next.js on the same port; each connection is checked with a signed login token; **order** (`order:<id>`) + complaint (`complaint:<id>`) rooms use database-backed access checks; per-socket rate limiting (20 joins/min); `SocketProvider` + `useSocket()` hook; server-side emitter (`lib/realtime/emitter.ts`) pushes events from API routes; `OrderChat` replaces the older booking-scoped `BookingChat`; `/api/orders/[id]/chat` handles message history + send |
| Real-time order chat | Seekers and providers must be able to exchange messages on active orders in real time; messages persisted in `order_chats` | Implemented — `components/order-chat.tsx` joins `order:<id>` Socket.IO room via `order:join` event; `authorizeOrderRoom()` in `lib/realtime/socket-auth.js` verifies participant access against MongoDB; REST endpoint `GET/POST /api/orders/[id]/chat` for history + send; `emitOrderMessageCreated()` pushes `order:message:created` events; provider messages inbox refactored to aggregate from `orders` + `order_chats`; expandable chat panel on provider order-status page |
| Rich media messaging | Chat should support voice notes and multiple photo attachments | Implemented — Integrates with Cloudinary for audio blob storage and image uploads. Order chat supports up to 5 photos. Complaint chat also supports voice and images. |
| Message deletion | Users should be able to delete chat messages similar to WhatsApp | Implemented — order chat supports `for_me` (hide only for yourself) and `for_everyone` (within 1 hour, leaving a deleted placeholder). Complaint chat additionally supports `admin_hard_delete` (permanent admin removal). |
| CSP WebSocket support | CSP must allow WebSocket transport for real-time features without breaking localhost development | Implemented — `connect-src` includes `ws:` and `wss:` in `lib/security/csp.ts`; `upgrade-insecure-requests` is now production-only (`NODE_ENV === "production"`) to avoid breaking Socket.IO polling transport on localhost |
| Demo cron dispatcher | Local development should be able to trigger all cron jobs without an external scheduler | Implemented — `lib/demo/cron-dispatch.ts` provides in-process runner for all 10 cron handlers; enabled by `DEMO_MODE=1` in `.env`; admin demo panel invokes handlers with `CRON_SECRET`-signed requests; must be disabled (`DEMO_MODE=0`) in production |
| Provider bank sync | Bank detail changes must sync to Razorpay contact/fund account | Implemented (`lib/services/provider-bank-sync.ts` — creates contact + fund account, masks stored account number) |
| Delivery charge calculation | Charges must be distance-based with free radius and per-km rate | Implemented (`lib/utils/delivery-charge.ts` — Haversine distance, configurable free radius and per-km rate) |
| SEO foundations | Platform should have sitemap, robots.txt, and structured data | Implemented (`app/sitemap.ts`, `app/robots.ts`, `components/seo/json-ld.tsx`) |

### Remaining Hardening Opportunities

1. Add alerting/monitoring dashboards for index creation failures caused by pre-existing duplicate historical data.
2. Add staging smoke coverage for live gateway paths (CI remains deterministic with fake-payments mode for reliability).
3. Add archival policy for old webhook payloads to control long-term storage growth.
4. Add CAPTCHA (e.g., reCAPTCHA/hCaptcha) to forgot-password form for production anti-abuse hardening (rate limiting already in place).
5. Promote CSP from report-only to enforced mode after violation cleanup.
6. **Tighten CSP `connect-src`** from broad `wss:` to `wss://<production-domain>` for defence-in-depth.
7. **Remove `DEMO_MODE=1`** from `.env` before any public deployment — demo cron panel bypasses external scheduler auth.
8. Integrate real team calendar/on-call system for dynamic owner pool routing.
9. Add split-settlement reconciliation tooling for rare one-leg failure cases.
10. Add reschedule abuse prevention (caps, cooldowns, or admin escalation).
11. Consider stateful session management for instant session revocation (current approach has ≤5 min delay via JWT re-check).
12. Add Playwright E2E test covering forgot-password → email outbox → follow link → reset → login with new password.
13. Add Playwright E2E coverage for Socket.IO chat flows and cancel-at-invoice-stage scenario.
