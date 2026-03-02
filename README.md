# LaundryEase

## 1. One-Paragraph Product Story

Laundry runs on informal promises: "I'll pick it up," "I'll start tonight," "I'll pay when it's delivered." Those promises break because neither side can prove what happened and neither side wants to take the first risk. Customers hand over personal clothing with no visibility. Providers spend time, water, electricity, and labor with no payment guarantee. Existing marketplaces paper over the gap with reviews and chat, but the failure happens mid-transaction, not after it. LaundryEase exists because local services need a contract you can see: money committed before work starts, progress tracked as facts, and delivery verified before settlement.

## 2. What This Product Is

LaundryEase is an escrow-backed workflow system that turns a local laundry job into a verifiable sequence of states from booking to delivery.

## 3. Core Principles

1. **Commitment before labor**
   We require verified invoice payment only after the provider inspects items and issues an invoice. Providers don't work on a maybe.

2. **Every physical step has a recorded state**
   "In progress" creates panic and phone calls. We use explicit lifecycle states so both sides share the same reality.

3. **Distance must make economic sense**
   Availability depends on radius, not hope. We only show providers who deliberately cover the seeker's location.

4. **Humans keep control**
   Providers set their own radius, pricing, and acceptance decisions. The platform enforces the contract; it doesn't run their business.

## 4. How the System Works (Mental Model)

Picture LaundryEase as three linked tracks that move in lockstep: **Location**, **State**, and **Money**.

1. **Location chooses who can even participate**
   The seeker shares a point on the map. The system returns only providers whose service radius covers that point.

2. **State creates the shared timeline**
   A seeker requests a booking. A provider accepts. After inspection and invoicing, the job advances through a fixed lifecycle (washing → ironing → ready → out for delivery → delivered). Nobody "says" it's done; the system records it.

3. **Money follows state, not messaging**
   The seeker pays the invoice (`payment_status: paid`). Delivery completes only when the seeker confirms with OTP, which starts the escrow hold window (`payment_status: held`) and timed payout processing.

## 5. Key Capabilities

- **Radius-true discovery**
  Seekers stop calling providers who don't actually serve their area. The system filters by coverage before the first message.

- **Invoice then controlled settlement**
  Providers stop debating price after pickup. They issue a precise invoice and get a verified payment commitment before they spend time and supplies.

- **Deterministic order tracking**
  Seekers stop chasing updates. Providers stop answering the same question all day. The job tells its own story through state.

- **Delivery authentication**
  Providers stop fearing "delivered but unpaid." Seekers stop fearing "paid but not delivered." OTP ties the final handoff to a recorded confirmation.

- **Arrival-gated booking-fee release**
  Booking-fee payout starts only when the provider marks arrival (with geofence checks when seeker coordinates are available).

- **Complaint & dispute resolution**
  Seekers can raise complaints within 24 hours of delivery. Escrow freezes immediately. Admin mediates through a 3-way chat system with response deadlines and commission-aware split settlement.

- **Reschedule without cancellation (booking-level)**
  Either side can request a pickup reschedule while pickup is still being negotiated. Reschedule creates an explicit booking state (not a cancellation) and routes the booking back into the propose/confirm flow.

- **Operational health monitoring & alerting**
  Platform automatically detects overdue payouts, failure spikes, and complaint backlogs. Alerts are delivered via email/webhook with SLA-driven escalation and owner routing.

- **Deadline guarantee with auto-compensation**
  Bookings carry a deadline. Late delivery triggers automatic full refund at OTP confirmation — the seeker is compensated without needing to file a complaint.

## 6. Who This Is For

- **For** local laundry businesses and serious independent providers who run scheduled work and want payment certainty.
- **For** customers who want predictable timelines and proof, not reassurance.

Not for:

- **Not for** "instant gig" pickup models where speed beats verification.
- **Not for** platforms that want algorithmic pricing or anonymous providers.
- **Not for** operations that require the platform to supply delivery riders.

## 7. Why This Architecture

LaundryEase treats a laundry order like a small contract.

- We separate the **handshake** (booking) from the **commitment** (paid invoice) so neither side gets trapped by assumptions.
- We keep the system strict about **state transitions** because ambiguity costs more than friction.
- We use escrow and OTP as the minimum mechanism that closes the trust gap without turning the platform into an arbitrator-by-default.

Tradeoff: the flow rejects "fast but fuzzy" transactions. It favors clarity over impulse.

## 8. Technology Stack

| Layer              | Technology                   | Purpose                                       |
| ------------------ | ---------------------------- | --------------------------------------------- |
| **Framework**      | Next.js 16.1.6 (App Router)  | Full-stack React framework with SSR/SSG       |
| **Frontend**       | React 19.2.4 + TypeScript 5  | Type-safe modern UI with React Compiler       |
| **Styling**        | Tailwind CSS 4 + shadcn/ui   | Utility-first CSS + accessible components     |
| **Animations**     | Framer Motion                | Smooth page and element animations            |
| **Database**       | MongoDB 6.21 (native driver) | Flexible documents + geospatial queries       |
| **Auth**           | NextAuth v4                  | Google OAuth + email/password credentials     |
| **Payments**       | Razorpay + RazorpayX         | Payment capture, escrow, and provider payouts |
| **Maps**           | Google Maps APIs             | Places, Geocoding, Maps JavaScript            |
| **SMS**            | Twilio                       | OTP delivery via SMS                          |
| **Email**          | Nodemailer + Email Outbox    | Queued email delivery with retry/backoff      |
| **Images**         | Cloudinary                   | CDN-backed image uploads                      |
| **Validation**     | Zod 4                        | Runtime schema validation                     |
| **Forms**          | React Hook Form              | Performant form handling                      |
| **Data Fetching**  | SWR                          | Client-side caching with revalidation         |
| **Logging**        | Pino + pino-pretty           | Structured JSON logging with secret redaction |
| **Financial Math** | decimal.js                   | Precise monetary calculations (no float bugs) |
| **APM / Telemetry**| Datadog (dd-trace + StatsD)  | Application performance monitoring & metrics  |
| **Rate Limiting**  | MongoDB-backed counters      | Per-IP/actor abuse prevention with TTL        |
| **Testing**        | Vitest + Playwright          | Unit tests + browser E2E tests                |
| **CI/CD**          | GitHub Actions + Vercel      | Quality gates + serverless deployment         |

## 9. Getting Started

### Prerequisites

- Node.js 18+ and npm
- MongoDB instance (local or Atlas — replica set recommended for transactions)
- Razorpay account (test mode works for development)
- Google Cloud project with Maps JavaScript API, Places API, Geocoding API enabled
- Twilio account for SMS OTP
- Google OAuth credentials (for social login)

### Installation

```bash
git clone https://github.com/your-org/laundry-ease.git
cd laundry-ease
npm install
```

Create a `.env.local` file with your configuration (see Environment Variables section below).

Start the development server:

```bash
npm run dev
```

### Scripts

| Command                      | Purpose                                               |
| ---------------------------- | ----------------------------------------------------- |
| `npm run dev`                | Start development server                              |
| `npm run build`              | Production build                                      |
| `npm run start`              | Start production server                               |
| `npm run lint`               | ESLint checks                                         |
| `npm run typecheck`          | TypeScript type checking                              |
| `npm run typecheck:strict`   | Strict mode (unused locals/params)                    |
| `npm run test`               | Run unit tests (Vitest)                               |
| `npm run test:watch`         | Run unit tests in watch mode                          |
| `npm run test:e2e`           | Run E2E tests (Playwright)                            |
| `npm run test:e2e:headed`    | Run E2E with browser visible                          |
| `npm run test:e2e:ui`        | Playwright UI mode                                    |
| `npm run verify:gates`       | Local release gate runner (typecheck+lint+test+build) |
| `npm run check:docs-sync`    | Documentation sync checker                            |

### Environment Variables

**Required:**

| Variable                          | Description                                          |
| --------------------------------- | ---------------------------------------------------- |
| `GOOGLE_ID`                       | Google OAuth client ID                               |
| `GOOGLE_SECRET`                   | Google OAuth client secret                           |
| `MONGODB_URI`                     | MongoDB connection string                            |
| `MONGODB_DB`                      | Database name (default: `laundryease`)               |
| `EMAIL_USER`                      | Email address for sending OTP emails                 |
| `EMAIL_PASS`                      | App-specific password for email service              |
| `TWILIO_ACCOUNT_SID`             | Twilio account SID                                   |
| `TWILIO_AUTH_TOKEN`              | Twilio authentication token                          |
| `TWILIO_PHONE_NUMBER`           | Twilio phone number (E.164 format)                   |
| `RAZORPAY_KEY_ID`               | Razorpay API key ID                                  |
| `RAZORPAY_KEY_SECRET`           | Razorpay API key secret                              |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID`   | Same as RAZORPAY_KEY_ID (exposed to client)          |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`| Google Maps API key                                  |
| `CRON_SECRET`                    | Secret for securing cron endpoints                   |
| `NEXTAUTH_SECRET`               | Secret for NextAuth JWT signing                      |

**Optional:**

| Variable                          | Description                                          |
| --------------------------------- | ---------------------------------------------------- |
| `NEXTAUTH_URL`                   | Application base URL                                 |
| `NEXT_PUBLIC_BASE_URL`           | Public URL for email links                           |
| `NEXT_PUBLIC_APP_URL`            | Alternative application URL                          |
| `RAZORPAYX_ACCOUNT_NUMBER`      | RazorpayX account number for payouts                 |
| `CLOUDINARY_CLOUD_NAME`         | Cloudinary cloud name                                |
| `CLOUDINARY_API_KEY`            | Cloudinary API key                                   |
| `CLOUDINARY_API_SECRET`         | Cloudinary API secret                                |
| `DATADOG_API_KEY` / `DD_API_KEY`| Datadog API key for APM tracing                      |
| `OPS_ALERT_EMAIL_TO`            | Comma-separated alert email recipients               |
| `OPS_ALERT_WEBHOOK_URL`         | Webhook URL for alert delivery (Slack, PagerDuty)    |
| `OPS_ALERT_WEBHOOK_BEARER`      | Bearer token for webhook auth                        |
| `OPS_PAGERDUTY_ROUTING_KEY`     | PagerDuty routing key                                |
| `CSP_ENFORCE`                    | `true` to switch CSP from report-only to enforced    |
| `CSP_ALLOW_UNSAFE_EVAL`         | `true` to allow unsafe-eval in CSP (dev only)        |
| `TRUST_PROXY`                    | `true` to trust x-forwarded-for headers              |
| `DEBUG_LOGGING`                  | `true` for debug-level Pino logging in production    |
| `ADMIN_ALLOWLIST_IPS`           | Comma-separated IP allowlist for admin access        |
| `E2E_FAKE_PAYMENTS`             | `1` to bypass real Razorpay in E2E tests             |
| `PROVIDER_SEARCH_DEBUG`         | `true` to log provider search diagnostics            |
| `ALLOW_BASE64_UPLOAD_FALLBACK`  | `1` to allow base64 upload when Cloudinary is down   |
| `ALLOW_START_WITH_INDEX_ERRORS` | `1` to skip critical index failure hard-stop         |

### External Service Setup

1. **Google OAuth**: Create credentials in [Google Cloud Console](https://console.cloud.google.com), add authorized redirect URI (`http://localhost:3000/api/auth/callback/google`)
2. **Razorpay**: Create a [Razorpay](https://razorpay.com) account, enable test mode, get API keys. For payouts, enable RazorpayX.
3. **Google Maps**: Enable Maps JavaScript API, Places API, and Geocoding API in your Google Cloud project
4. **Twilio**: Create a [Twilio](https://twilio.com) account, get a phone number for SMS OTP
5. **Cloudinary**: Create a [Cloudinary](https://cloudinary.com) account for image uploads
6. **MongoDB**: Use a replica set for transaction support (MongoDB Atlas works out of the box)

### Troubleshooting

- **Transaction errors**: Ensure MongoDB is running as a replica set. Standalone mode doesn't support transactions — the app has a compensating-write fallback for invoice finalization, but other operations require replica set support.
- **Index bootstrap errors**: On first startup, the app creates 30+ indexes. If historical data has duplicates that conflict with new unique indexes, set `ALLOW_START_WITH_INDEX_ERRORS=1` temporarily and clean up duplicates.
- **CSP violations**: CSP runs in report-only mode by default. Violations are logged to `/api/security/csp-report`. Set `CSP_ENFORCE=true` only after cleaning up violations.

## 10. Booking Lifecycle

### States

```
requested → accepted → pickup_proposed → confirmed → invoice_created → completed
                    ↘ rejected
         ↘ cancelled
              reschedule_requested ↩ (loops back to propose/confirm)
```

### Booking flow

1. **Seeker requests** a booking with a provider (includes deadline and optional coordinates)
2. **Provider accepts or rejects** (acceptance checks capacity limits)
3. **Pickup scheduling**: provider proposes a pickup slot, seeker confirms (or either side requests reschedule)
4. **Provider arrives**: arrival marked with optional geofence verification against seeker coordinates (max 200m)
5. **Invoice creation**: provider inspects items and creates a detailed invoice with line items and optional photos
6. **Seeker reviews invoice**: approve to proceed to payment, or reject (booking cancelled, booking fee forfeited)
7. **Payment**: seeker pays the invoice amount via Razorpay, which creates an Order and transitions booking to `completed`

### Booking fee

- ₹50 upfront booking fee collected at acceptance
- Refunded if provider cancels or doesn't respond within 2 hours (auto-reject)
- Forfeited if seeker cancels same-day or rejects a legitimate invoice
- Applied toward provider payout on successful arrival

### Cancellation policy

- **Seeker**: can cancel only before the booked slot time; same-day cancellation forfeits the booking fee
- **Provider**: cancellation always refunds the booking fee to seeker
- **After slot time**: seeker cannot cancel (enforced at API level)
- **Booking fee already applied**: cancellation blocked (requires admin intervention)

## 11. Order Lifecycle

### Process states

```
invoiced → processing → washing → ironing → ready → out_for_delivery → delivered
```

The order state machine (`lib/orders/status-machine.ts`) enforces valid transitions. Shortcuts are allowed (e.g., `processing` can go directly to `ready`).

### Payment states

```
unpaid → paid → held → released
                    → refunded
```

### Delivery flow

1. Provider advances order through processing states
2. Provider proposes a delivery slot; seeker confirms
3. Provider generates a delivery OTP (6-digit, hashed with bcrypt, 10-minute TTL)
4. OTP sent to seeker via email outbox
5. At handoff, OTP is verified → order marked `delivered`, payment moves to `held`
6. Escrow holds for 24 hours; if no complaint filed, payout cron releases funds

### Deadline compensation

If delivery confirmation happens after the booking deadline:
- If payment status is `paid`: automatic full refund via Razorpay, order marked `refunded` with `deadline_compensation_mode: full_refund`
- If payment is in another state: blocked with manual-support message
- Compensation is idempotent — applied only once per order

## 12. Complaint & Dispute Resolution

### Complaint Lifecycle

```
open → accepted → in_review → resolved
                            → rejected
```

### How it works

1. **Filing**: seeker files within 24 hours of delivery (enforced by API). Complaint type, title, description, and optional photo evidence required. One complaint per order enforced via unique index.
2. **Escrow freeze**: open complaint immediately blocks escrow release. The `releaseEscrowPayment` function checks for non-terminal complaints before any release.
3. **Admin acceptance**: admin reviews and accepts the complaint, setting a response deadline (1–14 days, default 7).
4. **Provider access**: admin grants provider access to the complaint chat — only then can the provider see and participate.
5. **3-way chat**: seeker, provider, and admin exchange messages (text + image attachments). System messages auto-posted on state changes.
6. **Resolution**: admin resolves with one of four outcomes:
   - `refund_full` — full distributable amount refunded to seeker
   - `refund_partial` — commission-aware split between seeker refund and provider payout
   - `release_payout` — full distributable amount paid out to provider
   - `reject` — complaint rejected, provider receives payout, complaint hidden from seeker/provider navigation
7. **Settlement math**: 5% platform commission is always deducted first. The remaining distributable amount is split based on the admin's decision. `decimal.js` ensures paise-level precision.
8. **Chat lock**: after resolution/rejection, chat is archived and no further messages are accepted.
9. **Manual fallback**: if Razorpay auto-refund or auto-payout fails, the admin UI shows counterparty bank/payment details for manual transfer.

### Complaint window extension

Admin can extend the complaint filing window for exceptional cases via `POST /api/admin/orders/[id]/extend-complaint` with a new deadline date.

### API endpoints

| Endpoint                                         | Purpose                            |
| ------------------------------------------------ | ---------------------------------- |
| `POST /api/complaints`                           | File a new complaint               |
| `GET /api/complaints/[id]`                       | Get complaint details              |
| `GET/POST /api/complaints/[id]/messages`         | Read/send chat messages            |
| `PATCH /api/admin/complaints/[id]/accept`        | Accept complaint, set deadline     |
| `PATCH /api/admin/complaints/[id]/add-provider`  | Grant provider chat access         |
| `PATCH /api/admin/complaints/[id]/access`        | Toggle provider access             |
| `PATCH /api/admin/complaints/[id]/resolve`       | Resolve with settlement outcome    |
| `POST /api/admin/orders/[id]/extend-complaint`   | Extend complaint filing window     |

## 13. Operational Monitoring & Alerting

### Health Monitoring

The `/api/cron/monitor-operational-health` cron runs hourly and evaluates three operational signals:

| Signal                  | Severity   | Threshold | Description                                                            |
| ----------------------- | ---------- | --------- | ---------------------------------------------------------------------- |
| `overdue_held_orders`   | `critical` | ≥ 3       | Held orders past release window + 1h grace without active complaints   |
| `payout_failures_spike` | `high`     | ≥ 3       | Payout failures in the last 24 hours                                   |
| `overdue_complaints`    | `high`     | ≥ 2       | Accepted/in-review complaints past response deadline                   |

Breached thresholds create or update `system_alerts` documents (upserted by alert key).

### Alert Delivery & Escalation

The `/api/cron/notify-system-alerts` cron runs every 15 minutes:

1. Finds open `critical`/`high` alerts that are unacknowledged
2. Applies dedup: notifications spaced at least 1 hour apart
3. Sends via configured channels: email digest (`OPS_ALERT_EMAIL_TO`), webhook (`OPS_ALERT_WEBHOOK_URL`), PagerDuty (`OPS_PAGERDUTY_ROUTING_KEY`)
4. Escalation: alerts older than 30 min (critical) or 2 hours (high) trigger escalation with 6-hour repeat spacing

### SLA & Owner Routing

- **Critical alerts**: 15-minute acknowledgement SLA
- **High alerts**: 60-minute acknowledgement SLA
- SLA-breached alerts are auto-assigned an owner:
  - Critical → `backend_oncall`
  - High → load-balanced between `platform_admin_oncall` and `backend_oncall`
- Persistent unacknowledged alerts escalate to `tech_lead`:
  - Critical after 60 minutes
  - High after 4 hours

### Alert Analytics

The admin dashboard surfaces:
- 7-day opened-vs-resolved trend
- Burn-rate tier: `stable` / `watch` / `high` / `critical`
- Mean Time To Resolve (MTTR) for recently resolved alerts
- SLA-breached alert counts (critical and high separately)

## 14. Cron Jobs

| Endpoint                               | Schedule     | Purpose                                         |
| -------------------------------------- | ------------ | ----------------------------------------------- |
| `/api/cron/auto-reject-bookings`       | Every 5 min  | Auto-reject bookings not accepted within 2 hours |
| `/api/cron/no-show`                    | Every 5 min  | Detect provider no-shows (30 min after pickup)   |
| `/api/cron/process-payouts`            | Every 15 min | Unified escrow release + payout engine           |
| `/api/cron/notify-system-alerts`       | Every 15 min | Alert delivery with dedup and escalation         |
| `/api/cron/process-email-outbox`       | Every 2 min  | Claim-and-dispatch queued transactional emails   |
| `/api/cron/audit-integrity`            | Every 30 min | Verify order/payment/booking consistency         |
| `/api/cron/reconciliation`             | Every 30 min | Reconcile Razorpay records vs internal state     |
| `/api/cron/monitor-operational-health` | Hourly       | Generate system alerts from health checks        |
| `/api/cron/monitor-abuse`              | Daily 2 AM   | Detect excessive cancellation patterns           |
| `/api/cron/webhook-cleanup`            | Daily 1 AM   | Purge processed webhook events older than 30 d   |

All cron runs are tracked in the `cron_runs` collection with job name, start time, duration, status, and result details. Cron endpoints are secured with `CRON_SECRET` bearer token authentication.

## 15. Security

### Headers & Transport

- **CSP**: Content-Security-Policy (report-only by default, enforce via `CSP_ENFORCE=true`) with violation reporting to `/api/security/csp-report`
- **HSTS**: `max-age=31536000; includeSubDomains; preload` in production
- **X-Frame-Options**: `DENY`
- **X-Content-Type-Options**: `nosniff`
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **Permissions-Policy**: camera/microphone disabled, geolocation self-only

### Authentication & Authorization

- Google OAuth + email/password credentials via NextAuth v4
- Session-based JWT tokens (7-day max age)
- Role-based API guards: `requireSeeker()`, `requireProvider()`, `requireAdmin()`, `requireAdminWithDbCheck()`
- Same-origin enforcement on unsafe HTTP methods
- Password policy: 8+ chars, uppercase, number, special character

### Rate Limiting

MongoDB-backed per-IP rate limiting with three tiers:
- **Default**: 60 requests per minute (standard API endpoints)
- **Strict**: limited per 5-minute window (accept/reject/cancel actions)
- **Auth**: limited per 15-minute window (signup, password reset, OTP)

Auto-cleanup via TTL indexes. Stale lock recovery for burst traffic.

### Payment Security

- Razorpay HMAC signature verification on all payment callbacks
- Idempotent webhook processing with event dedup via unique `event_id` index
- Escrow hold before release with complaint-gated checks
- Distributed refund locks to prevent concurrent double-refunds
- Payout locks with stale-lock timeout detection

### Logging & Redaction

Structured Pino logging with native redaction of: `password`, `passwordHash`, `token`, `secret`, `apiKey`, `otp`, `code`, `codeHash`, `authToken`, `accessToken`. Pretty-printing in dev, JSON in production.

## 16. Project Status & Direction

**Stable:**

- Role-based flows (seeker/provider/admin)
- Location-based provider discovery with geospatial indexes (`$geoNear` + bounding-box fallback)
- Full booking → invoicing → payment capture → delivery confirmation → escrow hold/release loop
- Canonical payment APIs with backward-compatible legacy aliases
- Booking reschedule requests during pickup scheduling
- Complaint system with admin workflow (accept → add provider → resolve)
- Complaint split-settlement support (`refund_partial`) with commission-aware allocation
- Unified payout orchestration with concurrent batch processing
- Booking cancellation rules with enforced refund/forfeiture policy
- Geofenced provider arrival checks before booking-fee payout release
- 24-hour complaint window enforcement at API level
- Deadline compensation (auto full-refund on late delivery at OTP confirmation)
- Idempotent webhook reconciliation with retry-safe event tracking
- Startup DB index bootstrap for 30+ integrity/query/TTL indexes
- CSP telemetry pipeline (Report-Only + `/api/security/csp-report`)
- Operational health monitoring with configurable alert thresholds
- Alert delivery + escalation with email/webhook/PagerDuty fan-out
- Alert acknowledgement with SLA tracking and owner routing
- Alert analytics dashboard (7-day trend, burn-rate, MTTR)
- Email outbox with retry/backoff for all transactional emails (delivery OTP, password reset, magic link, email OTP)
- MongoDB-backed rate limiting on sensitive endpoints (3 tiers)
- Structured Pino logging with native secret redaction
- `decimal.js` financial precision for payout calculations
- SWR data fetching for responsive client-side dashboards
- Abuse monitoring (excessive cancellation patterns, 30-day lookback)
- Data integrity auditing (order/payment/booking consistency, every 30 min)
- Cron run tracking for operational observability
- Secure signup with password strength validation
- Invoice finalization with transaction + compensating-write fallback
- Distributed refund locks with stale-lock recovery
- React Compiler enabled for automatic optimizations
- GitHub CI workflows:
  - `Quality Gates`: typecheck → lint → test → build → smoke E2E
  - `Real Gateway Smoke`: scheduled/manual live Razorpay connectivity
  - `Governance Audit`: branch-protection required-check detection
- Local release parity: `npm run verify:gates`
- Docs sync guardrails: `npm run check:docs-sync`

**Quality Snapshot (2026-03-02):**

- `104` test files, `517` tests passing (100% core route coverage)
- `5` Playwright E2E specs covering role journeys, complaints, settlements, booking lifecycle, and negative paths
- All quality gates passing: `typecheck`, `lint`, `test`, `build`, `test:e2e`
- Zero production type casts
- Strict escrow paise precision enforced
- System webhooks fully mutex-locked

**Remaining Hardening Opportunities:**

- Archival policy for old webhook payloads to control storage growth
- Team calendar/on-call integration for dynamic owner pools
- Password-recovery anti-abuse hardening (captcha strategy)
- Promote CSP from report-only to enforce mode after violation cleanup
- Split-settlement reconciliation tooling for rare one-leg failure cases
- Reschedule abuse prevention (caps, cooldowns, or admin escalation)

## 17. Project Structure

```text
laundry-ease/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth route group
│   │   ├── verify-email/         # Email verification flow
│   │   └── verify-phone/         # Phone verification flow
│   ├── (dashboard)/              # Protected dashboard routes
│   │   ├── admin/                # Admin panel (complaints, users, payments, alerts)
│   │   │   ├── complaints/       # Complaint management UI
│   │   │   ├── payment-management/ # Payment oversight
│   │   │   └── user-management/  # User administration
│   │   ├── provider/             # Provider dashboard
│   │   │   ├── bookings/         # Booking management
│   │   │   ├── disputes/         # Dispute view
│   │   │   ├── invoice-generation/ # Invoice creation
│   │   │   ├── manage-booking/   # Booking details
│   │   │   ├── messages/         # Chat interface
│   │   │   ├── order-status/     # Order lifecycle management
│   │   │   ├── profile/          # Provider profile
│   │   │   └── reviews-manage/   # Review management
│   │   └── seeker/               # Seeker dashboard
│   │       ├── bookings/         # Booking list and details
│   │       ├── disputes/         # Dispute view
│   │       ├── invoices/         # Invoice review
│   │       ├── orders/           # Order tracking
│   │       ├── profile/          # Seeker profile
│   │       ├── provider/         # Provider discovery
│   │       └── view-orders/      # Order history
│   ├── (root)/                   # Root layout group
│   ├── actions/                  # Server actions
│   │   ├── booking-actions.ts    # Booking operations
│   │   ├── order-actions.ts      # Order operations
│   │   └── profile-actions.ts    # Profile operations
│   ├── api/                      # API routes
│   │   ├── admin/                # Admin endpoints
│   │   │   ├── complaints/       # Complaint CRUD + accept/access/add-provider/resolve
│   │   │   ├── dashboard-stats/  # Admin dashboard statistics
│   │   │   ├── orders/           # Order management (extend-complaint)
│   │   │   ├── payments/         # Payment oversight
│   │   │   ├── refund/           # Manual refund processing
│   │   │   ├── system-alerts/    # Alert acknowledge/manage
│   │   │   └── users/            # User management + ban
│   │   ├── auth/                 # NextAuth + magic link + email verification
│   │   ├── bookings/             # Booking CRUD + accept/reject/cancel/arrive/schedule/reschedule/dispute/chat/invoice/pay/pay-invoice
│   │   ├── complaints/           # Complaint creation + messages
│   │   ├── cron/                 # 10 scheduled job endpoints
│   │   ├── escrow/               # Escrow release endpoint
│   │   ├── forgot-password/      # Password reset request
│   │   ├── invoices/             # Invoice review
│   │   ├── orders/               # Order lifecycle + status/payment/confirm-delivery/otp/schedule-delivery/cancel
│   │   ├── otp/                  # OTP send/verify
│   │   ├── payments/             # Razorpay order creation
│   │   ├── profile/              # Profile management
│   │   ├── provider/             # Provider dashboard stats
│   │   ├── providers/            # Provider search + discovery
│   │   ├── reset-password/       # Password reset execution
│   │   ├── reviews/              # Review submission
│   │   ├── security/             # CSP report endpoint
│   │   ├── signup/               # Registration endpoints
│   │   ├── upload/               # Image upload (Cloudinary)
│   │   └── webhooks/             # Razorpay webhook handler
│   ├── auth/                     # Login page
│   ├── choose-role/              # Role selection after OAuth
│   ├── complete-signup/          # Profile completion (provider/seeker)
│   ├── reset-password/           # Password reset page
│   ├── signup/                   # Registration pages (provider/seeker)
│   ├── forbidden.tsx             # 403 page
│   ├── global-error.tsx          # Global error boundary
│   ├── globals.css               # Tailwind global styles
│   ├── layout.tsx                # Root layout
│   ├── loading.tsx               # Global loading skeleton
│   ├── not-found.tsx             # 404 page
│   ├── page.tsx                  # Landing page
│   ├── robots.ts                 # SEO robots.txt
│   ├── sitemap.ts                # SEO sitemap.xml
│   └── unauthorized.tsx          # 401 page
│
├── components/                   # React components
│   ├── navigation/               # Role-based navigation
│   │   ├── admin-sidebar.tsx     # Admin sidebar menu
│   │   ├── provider-sidebar.tsx  # Provider sidebar menu
│   │   └── seeker-topnav.tsx     # Seeker top navigation
│   ├── orders/                   # Order UI components
│   │   ├── live-status-refresh.tsx # Auto-refreshing order status
│   │   ├── order-actions.tsx     # Provider order action buttons
│   │   ├── payment-button.tsx    # Razorpay payment integration
│   │   └── post-delivery-actions.tsx # Post-delivery review/complaint buttons
│   ├── provider/                 # Provider-specific components
│   │   ├── provider-header.tsx   # Provider page header
│   │   └── reviews-list.tsx      # Provider review display
│   ├── providers/                # Shared provider components
│   │   ├── google-maps-provider.tsx # Maps context provider
│   │   ├── invoice-form.tsx      # Invoice creation form
│   │   ├── provider-booking-list.tsx # Booking list for providers
│   │   └── session-provider.tsx  # NextAuth session wrapper
│   ├── seeker/                   # Seeker-specific components
│   │   ├── delivery-otp-form.tsx # OTP confirmation form
│   │   └── invoice-review-form.tsx # Invoice approval/rejection
│   ├── seo/                      # SEO components
│   │   └── json-ld.tsx           # Structured data
│   ├── ui/                       # shadcn/ui + custom components
│   │   ├── app-header.tsx        # Application header bar
│   │   ├── confirm-dialog.tsx    # Confirmation modal
│   │   ├── error-boundary.tsx    # React error boundary
│   │   ├── evidence-upload.tsx   # Complaint evidence upload
│   │   ├── global-footer.tsx     # Site footer
│   │   ├── go-back-button.tsx    # Navigation back button
│   │   ├── image-upload.tsx      # Image upload component
│   │   ├── interactive-grid.tsx  # Animated grid background
│   │   ├── location-autocomplete.tsx # Google Places autocomplete
│   │   ├── password-input.tsx    # Password with visibility toggle
│   │   ├── select.tsx            # Radix select wrapper
│   │   ├── skeleton.tsx          # Loading skeleton
│   │   ├── spotlight-card.tsx    # Animated spotlight card
│   │   ├── text-generate-effect.tsx # Text animation
│   │   ├── theme-provider.tsx    # Dark/light theme context
│   │   ├── theme-toggle.tsx      # Theme toggle button
│   │   └── toast.tsx             # Toast notifications
│   ├── chat-interface.tsx        # Booking chat with dispute modal
│   ├── complaint-chat.tsx        # 3-way complaint chat
│   └── landing-page-client.tsx   # Landing page client component
│
├── hooks/                        # Custom React hooks
│   └── use-booking-actions.ts    # Booking action handlers
│
├── cron/                         # Cron job logic
│   ├── auto-reject-bookings.ts   # Auto-reject expired bookings
│   └── no-show-check.ts          # No-show detection + refund
│
├── docs/                         # Documentation
│   ├── CODEBASE_UNDERSTANDING.md # Architecture reference
│   ├── HONEST_ASSESSMENT.md      # Codebase quality audit
│   ├── ML_AI_INTEGRATION.md      # Future ML capabilities
│   ├── OPERATIONS_RUNBOOK.md     # Incident response playbook
│   ├── PRD.md                    # Product Requirements Document
│   ├── PRESENTATION_HELPER.md    # Q&A and demo guide
│   └── PRODUCTION_READINESS_REVIEW.md # Production readiness checklist
│
├── e2e/                          # End-to-end tests (Playwright)
│   ├── support/                  # E2E test utilities
│   ├── booking-lifecycle-journey.spec.ts
│   ├── booking-negative-journeys.spec.ts
│   ├── complaint-chat-journey.spec.ts
│   ├── settlement-chain-journey.spec.ts
│   └── smoke-role-journeys.spec.ts
│
├── lib/                          # Core business logic & utilities
│   ├── api/                      # API layer
│   │   ├── auth.ts               # Role-based auth guards
│   │   ├── auth.test.ts          # Auth guard tests
│   │   ├── cron-auth.ts          # Cron secret verification
│   │   ├── errors.ts             # AppError class + error codes
│   │   ├── response.ts           # Standardized API responses
│   │   ├── schemas.ts            # Centralized Zod validation schemas
│   │   ├── schemas.contract.test.ts # Schema contract tests
│   │   ├── security.ts           # Rate limiting + origin checks
│   │   └── security.test.ts      # Security tests
│   ├── audit/                    # Data integrity
│   │   ├── integrity.ts          # Order/payment/booking consistency checks
│   │   └── integrity.test.ts     # Integrity test suite
│   ├── auth/                     # Auth policies
│   │   └── password-policy.ts    # Password strength rules
│   ├── bookings/                 # Booking business logic
│   │   ├── arrive-handler.ts     # Provider arrival request handler
│   │   ├── cancellation-policy.ts # Cancellation rules engine
│   │   ├── cancellation-policy.test.ts
│   │   └── mark-arrived.ts       # Arrival marking with geofence
│   ├── complaints/               # Complaint logic
│   │   ├── access.ts             # Complaint access control
│   │   └── access.test.ts        # Access control tests
│   ├── data/                     # Data access helpers
│   │   └── bookings.ts           # Booking queries
│   ├── db/                       # Database operations
│   │   ├── index.ts              # Re-exports all DB modules
│   │   ├── bookings.ts           # Booking CRUD
│   │   ├── complaints.ts         # Complaint CRUD
│   │   ├── escrow.ts             # Escrow hold/release with transactions
│   │   ├── orders.ts             # Order CRUD
│   │   ├── transaction.ts        # MongoDB transaction wrapper
│   │   └── users.ts              # User CRUD
│   ├── ops/                      # Operational monitoring
│   │   ├── ack-sla.ts            # Alert acknowledgement SLA tracking
│   │   ├── ack-sla.test.ts
│   │   ├── alert-channels.ts     # Email/webhook/PagerDuty delivery
│   │   ├── alert-delivery.ts     # Delivery plan builder (notify + escalate)
│   │   ├── alert-delivery.test.ts
│   │   ├── alert-lifecycle.ts    # Alert state management
│   │   ├── alerts-analytics.ts   # 7-day trend, burn-rate, MTTR
│   │   ├── alerts-analytics.test.ts
│   │   ├── health.ts             # Operational signal evaluation
│   │   ├── health.test.ts
│   │   ├── owner-routing.ts      # SLA-based alert owner assignment
│   │   └── owner-routing.test.ts
│   ├── orders/                   # Order business logic
│   │   ├── confirm-delivery-core.ts # Shared OTP verify + deadline compensation
│   │   ├── deadline-compensation.ts # Deadline breach evaluation
│   │   ├── deadline-compensation.test.ts
│   │   ├── status-machine.ts     # Order state machine
│   │   └── status-machine.test.ts
│   ├── payouts/                  # Payout logic
│   │   ├── amounts.ts            # Commission/payout calculation with decimal.js
│   │   └── amounts.test.ts
│   ├── security/                 # Security infrastructure
│   │   ├── csp.ts                # CSP policy builder
│   │   ├── csp.test.ts
│   │   ├── origin.ts             # Origin validation
│   │   └── origin.test.ts
│   ├── services/                 # Domain services
│   │   ├── admin-stats.ts        # Admin dashboard statistics
│   │   ├── complaint-resolution.ts # Settlement logic + financial actions
│   │   ├── invoice-finalization.ts # Transaction + compensating-write order creation
│   │   ├── provider-bank-sync.ts # Razorpay contact/fund account sync
│   │   ├── provider-password.ts  # Secure password change
│   │   ├── provider-search.ts    # Geo search engine ($geoNear + fallback)
│   │   ├── refund-lock.ts        # Distributed refund lock
│   │   └── system-alerts.ts      # System alert trigger helpers
│   ├── utils/                    # Utility functions
│   │   ├── delivery-charge.ts    # Distance-based delivery fee calculation
│   │   └── monetary.ts           # round2, toPaise, formatInr, MONEY_EPSILON
│   ├── webhooks/                 # Webhook handlers
│   │   └── razorpay-handlers.ts  # Razorpay event processing
│   ├── audit.ts                  # Audit log creation (booking, order, escrow, payment, complaint)
│   ├── client-api.ts             # Client-side API helpers
│   ├── client-error.ts           # Client error utilities
│   ├── cloudinary.ts             # Cloudinary upload integration
│   ├── constants.ts              # Centralized business constants (fees, timeouts, thresholds)
│   ├── cron-tracking.ts          # Cron job run observability
│   ├── db-indexes.ts             # 30+ database index bootstrap
│   ├── db-indexes.test.ts        # Index tests
│   ├── db.test.ts                # DB connection tests
│   ├── delivery-otp-email.ts     # Delivery OTP email template
│   ├── distance.ts               # Haversine distance calculation
│   ├── email-outbox.ts           # Queued email system (4 email types, claim-lock-dispatch)
│   ├── email-outbox.test.ts      # Outbox tests
│   ├── email-transporter.ts      # Nodemailer SMTP transport
│   ├── env.ts                    # Zod environment validation (lazy singleton)
│   ├── geocoding.ts              # Google Geocoding API
│   ├── logger.ts                 # Pino structured logging with secret redaction
│   ├── magic-link-email.ts       # Magic link email template
│   ├── mongodb.ts                # MongoDB connection + index init
│   ├── otp.ts                    # OTP generation + verification
│   ├── otp-code-email.ts         # OTP code email template
│   ├── password-reset-email.ts   # Password reset email template
│   ├── payouts.ts                # Payout orchestration engine (batch + lock)
│   ├── razorpay.ts               # Razorpay SDK wrapper (payments, refunds, payouts, contacts, fund accounts)
│   ├── telemetry.ts              # DogStatsD metrics (hot-shots)
│   └── utils.ts                  # General utilities (cn, etc.)
│
├── scripts/                      # Development & CI scripts
│   ├── audit-branch-protection.mjs # Branch protection auditor
│   ├── check-doc-sync.mjs        # Documentation sync checker
│   ├── run-playwright.mjs        # E2E env sanitization wrapper
│   └── verify-gates.mjs          # One-shot quality gate runner
│
├── types/                        # TypeScript definitions
│   ├── bookings.ts               # Booking, Invoice, PopulatedBooking types
│   ├── complaints.ts             # Complaint, ComplaintMessage types
│   ├── enums.ts                  # Role enum (seeker, provider, admin)
│   ├── next-auth.d.ts            # NextAuth session type augmentation
│   ├── orders.ts                 # Order, OrderItem, PaymentStatus types
│   ├── razorpay.d.ts             # Razorpay SDK type definitions
│   ├── reviews.ts                # Review type
│   └── users.ts                  # BaseUser, Seeker, Provider, Admin, ProviderSearchResult
│
├── public/                       # Static assets
│   ├── apple-touch-icon.png
│   ├── icon.svg
│   ├── laundryease-logo.png
│   ├── manifest.json             # PWA manifest
│   └── og-image.png              # Open Graph image
│
├── .github/                      # GitHub configuration
│   ├── workflows/
│   │   ├── quality-gates.yml     # CI: typecheck → lint → test → build → E2E
│   │   ├── real-gateway-smoke.yml # Scheduled live Razorpay connectivity
│   │   └── governance-audit.yml  # Branch-protection drift detection
│   ├── copilot-instructions.md   # AI assistant instructions
│   └── PULL_REQUEST_TEMPLATE.md  # PR checklist template
│
├── instrumentation.ts            # Datadog APM initialization hook
├── next.config.ts                # Next.js config (React Compiler, CSP headers, HSTS)
├── vercel.json                   # Vercel config + 10 cron schedules
├── playwright.config.ts          # Playwright E2E configuration
├── vitest.config.ts              # Vitest unit test configuration
├── vitest.setup.ts               # Test setup
├── global.d.ts                   # Global TypeScript declarations
├── proxy.ts                      # Development proxy
├── components.json               # shadcn/ui configuration
├── eslint.config.mjs             # ESLint configuration
├── postcss.config.mjs            # PostCSS configuration
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # Dependencies & scripts
```

### Key Directories

| Directory         | Purpose                                               |
| ----------------- | ----------------------------------------------------- |
| `app/(dashboard)` | Role-based dashboards with protected routes           |
| `app/api/`        | RESTful API endpoints organized by domain             |
| `app/actions/`    | Next.js Server Actions for data mutations             |
| `components/ui/`  | Reusable shadcn/ui + custom components                |
| `cron/`           | Scheduled background job logic                        |
| `docs/`           | Product documentation and guides                      |
| `e2e/`            | End-to-end browser tests (Playwright)                 |
| `lib/api/`        | Request validation, error handling, rate limiting     |
| `lib/db/`         | Core database operations (CRUD, escrow, transactions) |
| `lib/ops/`        | Operational health monitoring and alert management    |
| `lib/orders/`     | Order state machine and delivery logic                |
| `lib/payouts/`    | Payout calculation with decimal.js precision          |
| `lib/security/`   | CSP policy and origin validation                      |
| `lib/services/`   | Domain services (search, settlement, invoicing)       |
| `scripts/`        | CI/CD and development tooling                         |
| `types/`          | Shared TypeScript interfaces, enums, and SDK types    |