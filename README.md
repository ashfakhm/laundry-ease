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
| **Frontend**       | React 19.2.4 + TypeScript 5  | Type-safe modern UI                           |
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
- MongoDB (local instance or MongoDB Atlas)
- Google Cloud Project with OAuth credentials
- Razorpay account with API keys and RazorpayX account
- Twilio account for SMS OTP
- Google Cloud API key (Maps, Places, Geocoding)
- (Optional) Cloudinary account for image uploads

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd laundry-ease
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy the example environment file:

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and fill in all required variables. See the [Environment Variables](#environment-variables) section below for details.

4. **Set up MongoDB**
   - For local MongoDB: Ensure MongoDB is running on `localhost:27017`
   - For MongoDB Atlas: Update `MONGODB_URI` with your Atlas connection string

   Core indexes are initialized automatically on first DB access through `lib/mongodb.ts` and `lib/db-indexes.ts`.
   This includes integrity, query, and TTL indexes used by payments, complaints, OTP, and reset-token flows.
   Optional geospatial migration helpers remain in `lib/setup-geospatial-index.ts` for one-off operational scripts.

5. **Generate secure secrets**

   Generate strong random secrets for `CRON_SECRET` and `NEXTAUTH_SECRET`:

   ```bash
   openssl rand -base64 32
   ```

   Copy the output and use it for both secrets (or generate separate ones).

6. **Start the development server**

   ```bash
   npm run dev
   ```

7. **Access the application**

   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

All environment variables are validated on startup via Zod schema in `lib/env.ts`. See `.env.example` for a complete template.

**Required Variables:**

| Variable                          | Description                    | Example                                  |
| --------------------------------- | ------------------------------ | ---------------------------------------- |
| `GOOGLE_ID`                       | Google OAuth client ID         | From Google Cloud Console                |
| `GOOGLE_SECRET`                   | Google OAuth client secret     | From Google Cloud Console                |
| `MONGODB_URI`                     | MongoDB connection string      | `mongodb://localhost:27017` or Atlas URI |
| `MONGODB_DB`                      | Database name                  | `laundryease`                            |
| `EMAIL_USER`                      | Email for sending OTP          | `your-email@gmail.com`                   |
| `EMAIL_PASS`                      | Email app password             | Gmail App Password                       |
| `TWILIO_ACCOUNT_SID`              | Twilio account SID             | From Twilio Console                      |
| `TWILIO_AUTH_TOKEN`               | Twilio auth token              | From Twilio Console                      |
| `TWILIO_PHONE_NUMBER`             | Twilio phone number            | `+919876543210`                          |
| `RAZORPAY_KEY_ID`                 | Razorpay API key ID            | From Razorpay Dashboard                  |
| `RAZORPAY_KEY_SECRET`             | Razorpay API key secret        | From Razorpay Dashboard                  |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID`     | Same as RAZORPAY_KEY_ID        | Same as above                            |
| `RAZORPAYX_ACCOUNT_NUMBER`        | RazorpayX account number       | `2323230000000000`                       |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API key            | From Google Cloud Console                |
| `CRON_SECRET`                     | Secret for cron authentication | Generate with `openssl rand -base64 32`  |
| `NEXTAUTH_SECRET`                 | Secret for JWT signing         | Generate with `openssl rand -base64 32`  |

**Optional Variables:**

| Variable                   | Description                                          |
| -------------------------- | ---------------------------------------------------- |
| `NEXTAUTH_URL`             | Application base URL (defaults to localhost:3000)    |
| `NEXT_PUBLIC_BASE_URL`     | Public URL for email links                           |
| `NEXT_PUBLIC_APP_URL`      | Alternative app URL                                  |
| `CSP_ENFORCE`              | Set `true` to switch CSP from report-only to enforce |
| `TRUST_PROXY`              | Set `true` to trust `x-forwarded-for` headers        |
| `DEBUG_LOGGING`            | Set `true` for debug-level Pino logging              |
| `ADMIN_ALLOWLIST_IPS`      | Comma-separated IP allowlist for admin routes        |
| `OPS_ALERT_EMAIL_TO`       | Comma-separated email recipients for alert digests   |
| `OPS_ALERT_WEBHOOK_URL`    | Webhook URL for alert delivery (Slack, PagerDuty)    |
| `OPS_ALERT_WEBHOOK_BEARER` | Bearer token for webhook authentication              |
| `CLOUDINARY_CLOUD_NAME`    | Cloudinary cloud name                                |
| `CLOUDINARY_API_KEY`       | Cloudinary API key                                   |
| `CLOUDINARY_API_SECRET`    | Cloudinary API secret                                |
| `DATADOG_API_KEY`          | Datadog API key for APM tracing                      |
| `DD_API_KEY`               | Alternative Datadog API key                          |
| `OPS_PAGERDUTY_ROUTING_KEY`| PagerDuty routing key for alert integration          |
| `E2E_FAKE_PAYMENTS`        | Set `1` to bypass real Razorpay in E2E tests         |
| `CSP_ALLOW_UNSAFE_EVAL`    | Set `true` to allow unsafe-eval in CSP (dev only)    |

### External Service Setup

**Google OAuth:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials (Web application type)
5. Add authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Secret to `.env.local`

**Razorpay:**

1. Sign up at [Razorpay](https://razorpay.com/)
2. Activate your account
3. Get API keys from Settings → API Keys
4. Set up RazorpayX account for escrow
5. Copy account number and API keys to `.env.local`

**Twilio:**

1. Sign up at [Twilio](https://www.twilio.com/)
2. Get a phone number
3. Copy Account SID, Auth Token, and Phone Number to `.env.local`

**Google Maps:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable these APIs:
   - Maps JavaScript API
   - Places API
   - Geocoding API
3. Create API key and restrict it (recommended)
4. Copy API key to `.env.local`

### Troubleshooting

- **Environment variable errors**: Check `lib/env.ts` for exact variable names and requirements
- **MongoDB connection issues**: Verify `MONGODB_URI` format and network access
- **OTP not sending**: Verify email credentials (`EMAIL_USER` / `EMAIL_PASS`) and that your email provider allows app passwords / SMTP
- **Payment errors**: Verify Razorpay keys match environment (test/live) and account status

## 10. Booking Reschedule Flow

LaundryEase supports a _reschedule request_ that is separate from cancellation.

### What it does

- Either **seeker or provider** can request a pickup reschedule.
- The booking moves to `reschedule_requested`.
- The system clears pickup confirmation (`pickupSlot.confirmedAt`) so a new proposal can be made.
- The reschedule action is tracked via `booking.reschedule` metadata (requestedBy, requestedAt, reason, count, previousPickupSlot).

### When it's allowed

Reschedule requests are allowed only while the booking is still in pickup negotiation:

- `accepted`
- `pickup_proposed`
- `confirmed`

Not allowed:

- after provider arrival (`arrivedAt` exists)
- after invoice creation / completion

### API endpoint

- `POST /api/bookings/:id/reschedule/request`
  - Body: `{ "reason"?: string }`
  - Access: booking owner (seeker) or the assigned provider

## 11. Complaint & Dispute Resolution

LaundryEase provides a structured dispute resolution workflow for post-delivery issues.

### Complaint Lifecycle

| State       | Description                                     |
| ----------- | ----------------------------------------------- |
| `open`      | Seeker raised complaint; escrow frozen          |
| `accepted`  | Admin acknowledged; 7-day response deadline set |
| `in_review` | Provider added to chat; active mediation        |
| `resolved`  | Admin decided outcome; escrow action executed   |
| `rejected`  | Invalid complaint dismissed; escrow released    |

### How it works

1. **Seeker raises complaint** within 24 hours of delivery
   - Escrow immediately freezes
   - Complaint created in `open` status
   - Initial message includes title, description, and evidence photos

2. **Admin accepts complaint**
   - Sets 7-day response deadline for provider
   - Status moves to `accepted`
   - Conversation remains Admin + Seeker during this stage

3. **Admin adds provider to chat**
   - Provider gains access to complaint details (only after admin action)
   - Status moves to `in_review`
   - 3-way conversation begins (Admin, Seeker, Provider)

4. **Admin resolves complaint**
   - `release_payout` - Funds go to provider (complaint dismissed or resolved in provider's favor)
   - `refund_partial` - Admin chooses seeker refund amount via slider; remaining distributable amount goes to provider
   - `refund_full` - Seeker receives full distributable amount (provider gets zero)
   - `reject` - Complaint invalid; funds released to provider (minus standard commission). Case is hidden from ongoing lists.
   - Commission remains retained by the platform (default 5%) before split logic is applied.

### API endpoints

- `POST /api/complaints` - Create complaint (seeker)
- `GET /api/complaints/:id` - Get complaint details
- `GET /api/complaints/:id/messages` - Get chat messages
- `POST /api/complaints/:id/messages` - Send message
- `POST /api/admin/complaints/:id/accept` - Accept complaint (admin)
- `POST /api/admin/complaints/:id/add-provider` - Add provider to chat (admin)
- `POST /api/admin/complaints/:id/resolve` - Resolve with outcome (admin; `refund_partial` expects `seeker_refund_amount`)

### Key rules

- **One order, one complaint**: Each order can have at most one complaint
- **Escrow freeze**: Raising a complaint halts the escrow release timer
- **Provider access control**: Provider only sees complaint after admin explicitly grants access
- **Role-scoped visibility**: Seeker/provider complaint menus list only ongoing complaints (`open`, `accepted`, `in_review`)
- **Finalized thread lock**: After `resolved`/`rejected`, seeker/provider chat is archived/read-only
- **Response deadline**: Default 7 days from acceptance; overdue complaints surfaced to admin

## 12. Operational Monitoring & Alerting

### Health Monitoring

An hourly cron (`/api/cron/monitor-operational-health`) evaluates three operational signals:

- **Overdue held orders** (critical): Orders past escrow release window without active complaints
- **Payout failure spikes** (high): Failures in the last 24h exceeding threshold
- **Overdue complaints** (high): Accepted/in-review complaints past response deadlines

### Alert Delivery & Escalation

A 15-minute cron (`/api/cron/notify-system-alerts`) sends alert digests:

- **Email**: HTML digest to configured `OPS_ALERT_EMAIL_TO` recipients
- **Webhook**: JSON payload to `OPS_ALERT_WEBHOOK_URL` (Slack, PagerDuty, etc.)
- **Dedup**: Notifications spaced minimum 1 hour per alert
- **Escalation**: Critical alerts escalate after 30 min, high alerts after 2 hours

### SLA & Owner Routing

- Critical alerts: **15-minute** acknowledgement SLA
- High alerts: **60-minute** acknowledgement SLA
- SLA-breached critical alerts auto-route to `backend_oncall`
- SLA-breached high alerts load-balance between `platform_admin_oncall` and `backend_oncall`
- Persistent breaches (60 min critical, 4h high) escalate to `tech_lead`

### Alert Analytics

Admin dashboard shows: 7-day opened-vs-resolved trend, burn-rate tier (stable/watch/high/critical), and MTTR for recent alerts.

## 13. Cron Jobs

| Endpoint                               | Schedule     | Purpose                                   |
| -------------------------------------- | ------------ | ----------------------------------------- |
| `/api/cron/auto-reject-bookings`       | Every 5 min  | Auto-reject expired booking requests           |
| `/api/cron/no-show`                    | Every 5 min  | Detect provider no-shows                       |
| `/api/cron/process-payouts`            | Every 15 min | Unified escrow release + payout engine         |
| `/api/cron/notify-system-alerts`       | Every 15 min | Alert delivery with escalation                 |
| `/api/cron/process-email-outbox`       | Every 2 min  | Claim-and-dispatch queued transactional emails  |
| `/api/cron/audit-integrity`            | Every 30 min | Verify order/payment/booking consistency       |
| `/api/cron/reconciliation`             | Every 30 min | Reconcile Razorpay records vs internal state   |
| `/api/cron/monitor-operational-health` | Hourly       | Generate system alerts from health checks      |
| `/api/cron/monitor-abuse`              | Daily 2 AM   | Detect excessive cancellation patterns         |
| `/api/cron/webhook-cleanup`            | Daily 1 AM   | Purge processed webhook events older than 30 d |

All cron runs are tracked in `cron_runs` collection with job name, start time, duration, status, and result details.

## 14. Project Status & Direction

**Stable:**

- Role-based flows (seeker/provider/admin)
- Location-based provider discovery with geospatial indexes
- Booking → invoicing → payment capture → delivery confirmation → escrow hold/release loop
- Canonical payment APIs with backward-compatible legacy aliases
- Booking reschedule requests during pickup scheduling
- Complaint system with admin workflow (accept → add provider → resolve)
- Complaint split-settlement support (`refund_partial`) with commission-aware slider
- Unified payout orchestration for cron/manual/admin flows
- Booking cancellation rules with enforced refund/forfeiture policy
- Geofenced provider arrival checks before booking-fee payout release
- 24-hour complaint window enforcement at API level
- Idempotent webhook reconciliation with retry-safe event tracking
- Startup DB index bootstrap for integrity/query/TTL invariants
- CSP telemetry pipeline (Report-Only + `/api/security/csp-report`)
- Operational health monitoring with configurable alert thresholds
- Alert delivery + escalation with email/webhook fan-out
- Alert acknowledgement with SLA tracking and owner routing
- Alert analytics dashboard (7-day trend, burn-rate, MTTR)
- Email outbox with retry/backoff for all transactional emails
- MongoDB-backed rate limiting on sensitive endpoints
- Structured Pino logging with native secret redaction
- `decimal.js` financial precision for payout calculations
- SWR data fetching for responsive client-side dashboards
- Abuse monitoring (excessive cancellation patterns)
- Data integrity auditing (order/payment/booking consistency)
- Cron run tracking for operational observability
- Secure signup with password strength validation
- Real-time client-side form validation (email, password matching)
- GitHub CI workflows:
  - `Quality Gates`: typecheck → lint → test → build → smoke E2E
  - `Real Gateway Smoke`: scheduled/manual live Razorpay connectivity
  - `Governance Audit`: branch-protection required-check detection
- Local release parity: `npm run verify:gates`
- Docs sync guardrails: `npm run check:docs-sync`

**Quality Snapshot (2026-03-01):**

- `104` test files, `506` tests passing (100% core route coverage)
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

## 15. Project Structure

```text
laundry-ease/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth route group
│   │   ├── verify-email/         # Email verification flow
│   │   └── verify-phone/         # Phone verification flow
│   ├── (dashboard)/              # Protected dashboard routes
│   │   ├── admin/                # Admin panel (complaints, users, payments, alerts)
│   │   ├── provider/             # Provider dashboard (bookings, orders, earnings)
│   │   └── seeker/               # Seeker dashboard (bookings, orders, disputes)
│   ├── actions/                  # Server actions
│   │   ├── booking-actions.ts    # Booking operations
│   │   ├── order-actions.ts      # Order operations
│   │   └── profile-actions.ts    # Profile operations
│   ├── api/                      # API routes
│   │   ├── admin/                # Admin endpoints (complaints, users, system-alerts, payments, refund)
│   │   ├── auth/                 # NextAuth configuration
│   │   ├── bookings/             # Booking CRUD, chat, reschedule, dispute
│   │   ├── complaints/           # Complaint creation, messages
│   │   ├── cron/                 # Scheduled job endpoints (10 jobs)
│   │   ├── escrow/               # Escrow release endpoints
│   │   ├── forgot-password/      # Password reset request
│   │   ├── invoices/             # Invoice generation and review
│   │   ├── orders/               # Order lifecycle management
│   │   ├── otp/                  # OTP send/verify
│   │   ├── payments/             # Razorpay integration
│   │   ├── profile/              # Profile management
│   │   ├── provider/             # Provider-specific endpoints (dashboard-stats)
│   │   ├── providers/            # Provider search, discovery
│   │   ├── reset-password/       # Password reset execution
│   │   ├── reviews/              # Review submission
│   │   ├── security/             # Security telemetry (CSP reports)
│   │   ├── signup/               # Registration endpoints
│   │   ├── upload/               # Image upload (Cloudinary)
│   │   └── webhooks/             # Payment webhooks (Razorpay)
│   ├── auth/                     # Auth pages (login)
│   ├── choose-role/              # Role selection after OAuth
│   ├── complete-signup/          # Profile completion
│   ├── reset-password/           # Password reset page
│   ├── signup/                   # Registration pages
│   ├── global-error.tsx          # Global error boundary
│   ├── globals.css               # Global Tailwind styles
│   ├── layout.tsx                # Root layout with providers
│   └── page.tsx                  # Landing page
│
├── components/                   # React components
│   ├── bookings/                 # Booking list components
│   ├── navigation/               # Sidebar, topnav (admin, provider, seeker)
│   ├── orders/                   # Order actions, payment buttons
│   ├── provider/                 # Provider-specific components
│   ├── providers/                # Provider listing, invoice form
│   ├── seeker/                   # Seeker-specific components
│   ├── seo/                      # SEO components (JSON-LD)
│   ├── ui/                       # shadcn/ui components
│   ├── booking-modal.tsx         # Booking creation modal
│   ├── chat-interface.tsx        # Booking chat with dispute modal
│   ├── complaint-chat.tsx        # 3-way complaint chat
│   ├── provider-card.tsx         # Provider search result card
│   └── theme-toggle.tsx          # Dark/light mode toggle
│
├── hooks/                        # Custom React hooks
│   └── use-booking-actions.ts    # Booking action handlers
│
├── cron/                         # Cron job logic
│   ├── auto-reject-bookings.ts   # Auto-reject expired bookings
│   └── no-show-check.ts          # No-show detection
│
├── docs/                         # Documentation
│   ├── CODEBASE_UNDERSTANDING.md # Architecture reference
│   ├── HONEST_ASSESSMENT.md      # Codebase quality audit
│   ├── ML_AI_INTEGRATION.md      # Future ML capabilities
│   ├── OPERATIONS_RUNBOOK.md     # Incident response playbook
│   ├── PRD.md                    # Product Requirements Document
│   └── PRESENTATION_HELPER.md    # Q&A and demo guide
│
├── e2e/                          # End-to-end tests (Playwright)
│
├── lib/                          # Core business logic & utilities
│   ├── api/                      # API helpers (errors, auth, security, schemas)
│   ├── auth/                     # Auth policies
│   ├── audit/                    # Data integrity auditing
│   │   └── integrity.ts          # Order/payment/booking consistency checks
│   ├── bookings/                 # Booking logic (cancellation)
│   ├── complaints/               # Complaint access control
│   ├── data/                     # Data access helpers
│   │   └── bookings.ts           # Booking data queries
│   ├── db/                       # Database operations (bookings, orders, users)
│   ├── ops/                      # Operational monitoring
│   │   ├── ack-sla.ts            # Alert acknowledgement SLA tracking
│   │   ├── alert-channels.ts     # Email/webhook alert delivery
│   │   ├── alert-delivery.ts     # Delivery plan builder (notify + escalate)
│   │   ├── alerts-analytics.ts   # 7-day trend, burn-rate, MTTR
│   │   ├── health.ts             # Operational signal evaluation
│   │   └── owner-routing.ts      # SLA-based alert owner assignment
│   ├── orders/                   # Order state machine & compensation
│   ├── payouts/                  # Payout calculation logic
│   ├── security/                 # CSP and origin checks
│   ├── constants.ts              # Centralized business constants
│   ├── cron-tracking.ts          # Cron job run observability
│   ├── db-indexes.ts             # Database index bootstrap
│   ├── email-outbox.ts           # Queued email delivery with retry
│   ├── env.ts                    # Environment variable validation
│   ├── logger.ts                 # Structured Pino logging
│   ├── mongodb.ts                # Database connection
│   ├── payouts.ts                # Payout orchestration engine
│   └── razorpay.ts               # Payment gateway integration
│
├── scripts/
│   ├── audit-branch-protection.mjs # Branch-protection auditor
│   ├── check-doc-sync.mjs        # Documentation sync checker
│   ├── run-playwright.mjs        # E2E env sanitization wrapper
│   └── verify-gates.mjs          # One-shot quality gate runner
│
├── types/                        # TypeScript definitions
│
├── .github/workflows/            # CI/CD
│   ├── quality-gates.yml         # Lint/test/build/E2E on every push
│   ├── real-gateway-smoke.yml    # Live Razorpay connectivity checks
│   └── governance-audit.yml      # Branch-protection drift detection
├── .github/PULL_REQUEST_TEMPLATE.md # PR checklist template
│
├── next.config.ts                # Next.js configuration
├── vercel.json                   # Vercel config & cron schedules
└── package.json                  # Dependencies & scripts
```

### Key Directories

| Directory         | Purpose                                            |
| ----------------- | -------------------------------------------------- |
| `app/(dashboard)` | Role-based dashboards with protected routes        |
| `app/api/`        | RESTful API endpoints organized by domain          |
| `app/actions/`    | Next.js Server Actions for data mutations          |
| `components/ui/`  | Reusable shadcn/ui components                      |
| `cron/`           | Scheduled background job logic (Vercel cron)       |
| `docs/`           | Product documentation and guides                   |
| `e2e/`            | End-to-end browser tests (Playwright)              |
| `lib/api/`        | Request validation, error handling, rate limiting  |
| `lib/db/`         | Core database operations (CRUD, transactions)      |
| `lib/ops/`        | Operational health monitoring and alert management |
| `types/`          | Shared TypeScript interfaces, enums, and SDK types |
