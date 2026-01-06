# LaundryEase# LaundryEase# LaundryEase

**The laundry problem, engineered away.\*\***The laundry problem, engineered away.**> **Laundry, solved.\*\* A premium on-demand laundry marketplace for busy professionals.

LaundryEase is a production-grade marketplace connecting urban professionals with verified laundry providers. It eliminates the 2-4 hours per week that busy people lose to laundry logistics—pickup, tracking, delays, and disputes—through doorstep service with escrow-protected payments, photo-documented handoffs, and guaranteed deadlines.LaundryEase is a production-grade marketplace that connects urban professionals with verified laundry providers. It eliminates the 2-4 hours per week that busy people lose to laundry logistics—pickup, tracking, delays, and disputes—by providing doorstep service with escrow-protected payments, photo-documented handoffs, and guaranteed deadlines.[![Next.js](https://img.shields.io/badge/Next.js%2016-black?logo=next.js)](https://nextjs.org)

[![Next.js](https://img.shields.io/badge/Next.js%2016-black?logo=next.js)](https://nextjs.org)[![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)](https://typescriptlang.org)

[![TypeScript](https://img.shields.io/badge/TypeScript%205-blue?logo=typescript&logoColor=white)](https://typescriptlang.org)

[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS%204-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)This is not another gig-economy prototype. Every state transition is defined. Every edge case has a handler. Every failure mode has a recovery path.[![Razorpay](https://img.shields.io/badge/Razorpay-blue?logo=razorpay&logoColor=white)](https://razorpay.com)

[![MongoDB](https://img.shields.io/badge/MongoDB%20Atlas-47A248?logo=mongodb&logoColor=white)](https://mongodb.com)

[![Razorpay](https://img.shields.io/badge/Razorpay-528FF0?logo=razorpay&logoColor=white)](https://razorpay.com)[![Build Status](https://img.shields.io/badge/Build-Passing-Success)](https://github.com/your-org/laundry-ease/actions)

------[![Context7](https://img.shields.io/badge/Verified%20with-Context7-purple)](https://context7.com)

## The Problem## The Problem---

Traditional laundry services fail knowledge workers in predictable ways:Traditional laundry services fail knowledge workers in predictable ways:## What is LaundryEase?

| Failure Mode | Business Impact || Failure Mode | Business Impact |LaundryEase is a **production-ready** laundry marketplace connecting busy professionals with verified service providers. It features a robust, type-safe architecture designed for reliability and scale.

|--------------|-----------------|

| Physical shop visits | 2-4 hours/week of high-value time lost ||-------------|-----------------|

| No deadline guarantees | Missed presentations, events, interviews |

| Opaque pricing | Budget uncertainty, surprise charges || Physical shop visits | 2-4 hours/week of high-value time lost || Problem | Solution |

| Zero accountability | Damaged/lost items with no recourse |

| Cash-only operations | Security risk, inconvenience || No deadline guarantees | Missed presentations, events, interviews || ------------------------------------- | -------------------------------- |

These aren't minor annoyances—they're systematic friction that scales with urbanization.| Opaque pricing | Budget uncertainty, surprise charges || 2-4 hours/week wasted on laundry runs | Doorstep pickup & delivery |

## The Solution| Zero accountability | Damaged/lost items with no recourse || Missed deadlines for urgent clothes | Deadline-guaranteed matching |

LaundryEase addresses each failure mode with an engineered countermeasure:| Cash-only operations | Security risk, inconvenience || Unclear pricing, surprise charges | Transparent fixed-price lists |

- **Doorstep pickup/delivery** eliminates travel entirely| No accountability for damage/loss | Photo evidence + Admin mediation |

- **Escrow-protected payments** hold funds for 24h post-delivery, releasing only after the complaint window closes

- **Photo-documented handoffs** create irrefutable evidence for dispute resolutionThese aren't minor annoyances—they're systematic friction that scales with urbanization.| Payment disputes | Escrow-protected payments |

- **Provider-set booking fees** filter unserious customers while compensating providers for no-shows

- **Admin-mediated three-way chat** resolves disputes with full context## The Solution---

---LaundryEase addresses each failure mode with an engineered countermeasure:## Quick Start

## Quick Start- **Doorstep pickup/delivery** eliminates travel entirely```bash

`````bash- **Escrow-protected payments** hold funds for 24h post-delivery, releasing only after the complaint window closes# 1. Clone and install

# 1. Clone and install

git clone https://github.com/your-org/laundry-ease.git- **Photo-documented handoffs** create irrefutable evidence for dispute resolutiongit clone https://github.com/your-org/laundry-ease.git

cd laundry-ease

npm install- **Provider-set booking fees** filter unserious customers while compensating providers for no-showscd laundry-ease



# 2. Configure environment- **Admin-mediated three-way chat** resolves disputes with full contextnpm install

cp .env.example .env.local

# Add your API keys (see Environment Variables below)---# 2. Configure environment



# 3. Run development servercp .env.example .env.local

npm run dev

## Architecture# Add your API keys (see Environment Variables below)

# 4. Build for production

npm run build````# 3. Run development server

`````

┌─────────────────────────────────────────────────────────────────┐npm run dev

Open [http://localhost:3000](http://localhost:3000)

│ FRONTEND │

---

│ Next.js 16 (App Router) + React 19 + Tailwind CSS 4 │# 4. Build for production

## Architecture

│ Server Components • Server Actions • Streaming SSR │npm run build

`````

┌─────────────────────────────────────────────────────────────────┐└─────────────────────────────────────────────────────────────────┘```

│                         FRONTEND                                │

│     Next.js 16 (App Router) + React 19 + Tailwind CSS 4        │                              │

│     Server Components • Server Actions • Streaming SSR          │

└─────────────────────────────────────────────────────────────────┘                              ▼Open [http://localhost:3000](http://localhost:3000)

                              │

                              ▼┌─────────────────────────────────────────────────────────────────┐

┌─────────────────────────────────────────────────────────────────┐

│                        API LAYER                                ││                        API LAYER                                │---

│   Route Handlers • NextAuth v4 • Zod v4 Validation • RBAC      │

└─────────────────────────────────────────────────────────────────┘│   Route Handlers • NextAuth v4 • Zod v4 Validation • RBAC      │

                              │

          ┌───────────────────┼───────────────────┐└─────────────────────────────────────────────────────────────────┘## Environment Variables

          ▼                   ▼                   ▼

   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                              │

   │  MongoDB    │     │  Razorpay   │     │ Cloudinary  │

   │  Atlas      │     │  + RazorpayX│     │  (Images)   │          ┌───────────────────┼───────────────────┐Create a `.env.local` file with:

   │  (Primary)  │     │  (Payments) │     │             │

   └─────────────┘     └─────────────┘     └─────────────┘          ▼                   ▼                   ▼

          │

          ▼   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐```env

   ┌─────────────┐

   │   Vercel    │   │  MongoDB    │     │  Razorpay   │     │ Cloudinary  │# Database

   │   Cron      │

   │  (Escrow)   │   │  Atlas      │     │  + RazorpayX│     │  (Images)   │MONGODB_URI=mongodb+srv://...

   └─────────────┘

```   │  (Primary)  │     │  (Payments) │     │             │



### Key Architectural Decisions   └─────────────┘     └─────────────┘     └─────────────┘# Authentication



| Decision | Rationale |          │NEXTAUTH_SECRET=your-secret-here

|----------|-----------|

| **Next.js 16 App Router** | Server Components reduce client bundle; Server Actions eliminate API boilerplate |          ▼NEXTAUTH_URL=http://localhost:3000

| **MongoDB over Postgres** | Flexible schema for evolving order items; native geospatial queries for provider discovery |

| **Razorpay + RazorpayX** | Single vendor for collection (Orders API) and disbursement (Payouts API); native UPI support |   ┌─────────────┐

| **24h Escrow Window** | Balances seeker protection with provider cash flow; industry-standard for marketplace trust |

| **Cron-based Auto-release** | Deterministic, auditable payout triggers; no complex event-driven architecture needed |   │   Cron      │# Razorpay (Payments)



---   │   Jobs      │RAZORPAY_KEY_ID=rzp_test_...



## Tech Stack   │  (Escrow)   │RAZORPAY_KEY_SECRET=...



| Layer | Technology | Version | Purpose |   └─────────────┘NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...

|-------|------------|---------|---------|

| Framework | Next.js | 16.1.1 | App Router, Server Actions, React 19 support |````

| Language | TypeScript | 5.x | Strict mode; Zod v4 for runtime validation |

| Styling | Tailwind CSS | 4.x | CSS-first config, `@theme` inline directive |# Cloudinary (Image Storage)

| UI | shadcn/ui | Latest | Accessible, composable components |

| Database | MongoDB Atlas | 6.x | Geospatial indexes, flexible documents |### Key Architectural DecisionsCLOUDINARY_CLOUD_NAME=...

| Auth | NextAuth.js | 4.24 | Google OAuth + Credentials; JWT sessions (7-day expiry) |

| Payments | Razorpay | — | Orders API (collection) + RazorpayX (payouts) |CLOUDINARY_API_KEY=...

| Storage | Cloudinary | — | Signed uploads, automatic optimization |

| SMS | Twilio | — | OTP delivery, transactional alerts || Decision | Rationale |CLOUDINARY_API_SECRET=...

| Email | Nodemailer | — | Magic links, order confirmations |

|----------|-----------|

---

| **Next.js 16 App Router** | Server Components reduce client bundle; Server Actions eliminate API boilerplate for mutations |# SMS (OTP via Twilio)

## User Roles

| **MongoDB over Postgres** | Flexible schema for evolving order items; native geospatial queries for provider discovery |TWILIO_ACCOUNT_SID=...

| Role | Description | Key Capabilities |

|------|-------------|------------------|| **Razorpay + RazorpayX** | Single vendor for collection (Orders API) and disbursement (Payouts API); native UPI support for India |TWILIO_AUTH_TOKEN=...

| **Seeker** | Customer booking laundry services | Search providers, book services, track orders, raise disputes |

| **Provider** | Laundry professional fulfilling orders | Accept bookings, create invoices, receive payouts || **24h Escrow Window** | Balances seeker protection with provider cash flow; industry-standard for marketplace trust |TWILIO_PHONE_NUMBER=...

| **Admin** | Platform operator | Resolve disputes, manage users, monitor payments |

| **Cron-based Auto-release** | Deterministic, auditable payout triggers; no complex event-driven architecture needed for MVP |

---

# Email (Nodemailer via Gmail SMTP)

## Core Workflows

---EMAIL_USER=your-gmail-address@gmail.com

### Booking → Order Lifecycle

EMAIL_PASS=your-gmail-app-password

`````

SEEKER PROVIDER SYSTEM## Tech Stack

───────────────────────────────────────────────────────────────────────────

Search providers by location# Cron Jobs

        │

        ▼| Layer | Technology | Version | Why |CRON_SECRET=your-secure-secret

Book + pay booking fee ─────────► Notification received

                                         │|-------|-----------|---------|-----|```

                                         ▼

                                 Accept (2h SLA) ◄───── Auto-reject if timeout| Framework | Next.js | 16.1.1 | App Router, Server Actions, React 19 support |

                                         │

                                         ▼| Language | TypeScript | 5.x | Strict mode enabled; Zod for runtime validation |**⚠️ Important**: Razorpay credentials are now **required** (no fallback values). The app will show warnings if credentials are missing.

                                 Propose pickup time

        │| Styling | Tailwind CSS | 4.x | CSS-first config, @theme inline directive |

        ▼

Confirm availability| UI | shadcn/ui | Latest | Accessible, composable, zero vendor lock-in |---

        │

        ▼| Database | MongoDB Atlas | 6.x | Geospatial indexes, flexible documents |

Present at pickup ◄──────────── Arrive + GPS verify ◄─── No-show detection

        │                                │| Auth | NextAuth.js | 4.24 | Google OAuth + Credentials; JWT sessions |## Architecture

        ▼                                ▼

Review invoice ◄─────────────── Create itemized invoice| Payments | Razorpay | — | Orders API (collection) + RazorpayX (payouts) |

        │                        (photo per item)

        ▼| Storage | Cloudinary | — | Signed uploads, automatic optimization |```

Approve invoice ─────────────────────────────────────► Order created

        │| SMS | Twilio | — | OTP delivery, transactional alerts |┌─────────────────────────────────────────────────────────────┐

        ▼

Pay order total ─────────────────────────────────────► Funds collected| Email | Nodemailer | — | Magic links, order confirmations |│ FRONTEND │

        │

        ▼│ Next.js 16 (App Router + Server Actions) + React + Tailwind CSS + Shadcn │

Track status ◄───────────────── Update: WASHING → IRONING → READY

        │---└─────────────────────────────────────────────────────────────┘

        ▼

Confirm delivery (OTP) ◄──────── Deliver + capture proof ──► Escrow starts (24h) │

        │

        ├─── Raise complaint ──────────────────────────────► Escrow frozen## Core Workflows ▼

        │         │

        │         ▼┌─────────────────────────────────────────────────────────────┐

        │    Admin resolution ─────────────────────────────► Refund OR Release

        │### Booking → Order Lifecycle│ API LAYER │

        └─── No complaint ─────────────────────────────────► Auto-release (cron)

`````│ Route Handlers (/app/api/*) + NextAuth + Zod Validation │



### Payment Flow````└─────────────────────────────────────────────────────────────┘



```SEEKER                          PROVIDER                         SYSTEM                              │

Seeker pays ─► Razorpay Order ─► Platform holds ─► 24h escrow ─► RazorpayX Payout

                    │                  │                              │───────────────────────────────────────────────────────────────────────────          ┌───────────────────┼───────────────────┐

                    │                  │                              ▼

                    │                  │                    95% to ProviderSearch providers by location          ▼                   ▼                   ▼

                    │                  │                    5% Platform fee

                    │                  │        │   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐

                    │                  └─► Complaint? ─► Freeze until resolved

                    │        ▼   │  MongoDB    │     │  Razorpay   │     │ Cloudinary  │

                    └─► Booking fee: Refunded on reject, forfeited on seeker no-show

```Book + pay booking fee ─────────► Notification received   │  (Database) │     │  (Payments) │     │  (Images)   │



---                                         │   └─────────────┘     └─────────────┘     └─────────────┘



## Project Structure                                         ▼```



```                                 Accept (2h SLA) ◄───── Auto-reject if timeout

laundry-ease/

├── app/                                         │---

│   ├── (dashboard)/

│   │   ├── admin/              # Platform operations: disputes, payouts, users                                         ▼

│   │   ├── provider/           # Booking management, invoicing, payouts

│   │   └── seeker/             # Discovery, orders, complaints                                 Propose pickup time## User Roles

│   ├── api/

│   │   ├── auth/               # NextAuth + magic link        │

│   │   ├── bookings/           # CRUD + accept/reject + scheduling

│   │   ├── orders/             # Lifecycle + payment + delivery        ▼| Role         | Description                              |

│   │   ├── complaints/         # Filing + chat + resolution

│   │   ├── cron/               # Auto-reject, no-show, escrow releaseConfirm availability| ------------ | ---------------------------------------- |

│   │   └── admin/              # Dashboard stats, user management

│   └── (auth)/                 # Login, signup, verification flows        │| **Seeker**   | Customer who books laundry services      |

├── components/

│   ├── ui/                     # shadcn primitives        ▼| **Provider** | Laundry professional who fulfills orders |

│   ├── navigation/             # Role-specific sidebars

│   └── orders/                 # Payment buttons, status badgesPresent at pickup ◄──────────── Arrive + GPS verify ◄─── No-show detection| **Admin**    | Platform operator who manages disputes   |

├── lib/

│   ├── db.ts                   # MongoDB helpers, type-safe queries        │                                │

│   ├── razorpay.ts             # Orders, contacts, fund accounts, payouts

│   ├── logger.ts               # Structured logging (production-ready)        ▼                                ▼---

│   └── api/

│       ├── schemas.ts          # Zod v4 validation schemasReview invoice ◄───────────────  Create itemized invoice

│       └── response.ts         # Standardized API responses

├── cron/        │                        (photo per item)## Core Workflows

│   ├── auto-reject-bookings.ts

│   ├── no-show-check.ts        ▼

│   └── escrow-auto-release.ts

├── proxy.ts                    # Next.js 16 edge middleware (auth, routing)Approve invoice ─────────────────────────────────────► Order created### 1. Booking Flow

└── types/

    ├── bookings.ts        │

    ├── orders.ts

    └── complaints.ts        ▼```

`````

Pay order total ─────────────────────────────────────► Funds collectedSeeker Books → Provider Accepts → Pickup Scheduled → Invoice Created → Order Paid

---

        │```

## Environment Variables

        ▼

Create a `.env.local` file:

Track status ◄───────────────── Update: WASHING → IRONING → READY### 2. Order Flow

`````env

# Database        │

MONGODB_URI=mongodb+srv://...

        ▼```

# Authentication

NEXTAUTH_SECRET=<32+ char random string>Confirm delivery (OTP) ◄──────── Deliver + capture proof ──► Escrow starts (24h)Picked Up → Processing → Ready → Delivered → OTP Verified → Escrow Released

NEXTAUTH_URL=http://localhost:3000

        │```

# Razorpay (REQUIRED - no fallback values)

RAZORPAY_KEY_ID=rzp_live_...        ├─── Raise complaint ──────────────────────────────► Escrow frozen

RAZORPAY_KEY_SECRET=...

RAZORPAYX_ACCOUNT_NUMBER=...        │         │### 3. Dispute Flow

NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_...

        │         ▼

# Cloudinary

CLOUDINARY_CLOUD_NAME=...        │    Admin resolution ─────────────────────────────► Refund OR Release```

CLOUDINARY_API_KEY=...

CLOUDINARY_API_SECRET=...        │Complaint Raised → Admin Reviews → Chat Opened → Resolution Applied



# Twilio (SMS/OTP)        └─── No complaint ─────────────────────────────────► Auto-release (cron)```

TWILIO_ACCOUNT_SID=...

TWILIO_AUTH_TOKEN=...````

TWILIO_PHONE_NUMBER=...

---

# Email

EMAIL_USER=...### Payment Flow

EMAIL_PASS=...

## Key Features

# Cron Security

CRON_SECRET=<32+ char random string>````

`````

Seeker pays ─► Razorpay Order ─► Platform holds ─► 24h escrow ─► RazorpayX Payout### For Seekers

> ⚠️ **Important**: Razorpay credentials are now **required**. The app will fail gracefully with warnings if credentials are missing.

                    │                  │                              │

---

                    │                  │                              ▼- **Find Providers** — Search by location, view ratings & prices

## Business Rules (Encoded in System)

                    │                  │                    95% to Provider- **Book & Pay** — Secure booking with upfront pricing

| Rule | Implementation |

|------|----------------| │ │ 5% Platform fee- **Track Orders** — Real-time status updates

| **Booking fee** | Provider-defined; deducted from final invoice on success |

| **Auto-reject** | 2h timeout → full refund to seeker | │ │- **Raise Disputes** — Photo evidence + Admin mediation

| **No-show penalty** | GPS verification; refund + provider flag |

| **Escrow window** | 24h post-delivery; cron-triggered release | │ └─► Complaint? ─► Freeze until resolved

| **Platform commission** | 5% deducted from provider payout |

| **Late penalty** | 5%/hour, max 30% (calculated at delivery) | │### For Providers

| **One complaint per order** | Enforced at API level |

                    └─► Booking fee: Refunded on reject, forfeited on seeker no-show

---

`````- **Manage Bookings** — Accept/reject with one click

## Security Model

- **Generate Invoices** — Photo-based itemization

| Layer | Implementation |

|-------|----------------|---- **Get Paid** — Automatic payouts after delivery

| **Authentication** | NextAuth.js with JWT; Google OAuth + email/password credentials |

| **Authorization** | Role-based middleware (`proxy.ts`); Admin/Provider/Seeker segregation |- **Dashboard Stats** — Real-time revenue, pickups, and deliveries

| **API Validation** | Zod v4 schemas on all inputs; ObjectId format validation |

| **Payment Security** | Never store card data; Razorpay tokenization; webhook signature verification |## Project Structure

| **Cron Protection** | Bearer token authentication on all `/api/cron/*` endpoints |

| **Session Management** | JWT with 7-day maxAge; automatic refresh |### For Admins



---````



## API Referencelaundry-ease/- **Resolve Disputes** — Three-way chat, refund controls



Full documentation: [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md)├── app/- **Manage Users** — Suspend, ban, or warn accounts



### Key Endpoints│ ├── (dashboard)/- **Monitor Payments** — Track escrow and payouts



```│ │ ├── admin/ # Platform operations: disputes, payouts, users- **Dashboard Analytics** — Real-time platform statistics

POST   /api/bookings                    Create booking with fee payment

POST   /api/bookings/[id]/accept        Provider accepts (creates Razorpay fund account)│ │ ├── provider/ # Booking management, invoicing, payouts - Open complaints count

POST   /api/orders/[id]/confirm-delivery  OTP verification, starts escrow

GET    /api/cron/process-payouts        Escrow release (requires CRON_SECRET)│ │ └── seeker/ # Discovery, orders, complaints - Total escrow balance

POST   /api/admin/complaints/[id]/resolve  Admin resolution with payment action

GET    /api/admin/dashboard-stats       Real-time platform metrics│ ├── api/ - Active providers (last 7 days)

`````

│ │ ├── auth/ # NextAuth + magic link - Total revenue and orders

---

│ │ ├── bookings/ # CRUD + accept/reject + scheduling

## Build Status

│ │ ├── orders/ # Lifecycle + payment + delivery---

````

✅ TypeScript: 0 errors│ │ ├── complaints/ # Filing + chat + resolution

✅ Production build: Passing

✅ ESLint: 0 errors (warnings acceptable)│ │ ├── cron/ # Auto-reject, no-show, escrow release## Project Structure

✅ All 73 routes: Compiled

```│ │ └── admin/ # Dashboard stats, user management



### Scripts│ └── (auth)/ # Login, signup, verification flows```



```bash├── components/laundry-ease/

npm run dev       # Start development server

npm run build     # Build for production│ ├── ui/ # shadcn primitives├── app/ # Next.js App Router

npm run start     # Start production server

npm run lint      # Run ESLint│ ├── navigation/ # Role-specific sidebars│ ├── (dashboard)/ # Protected routes

````

│ └── orders/ # Payment buttons, status badges│ │ ├── admin/ # Admin dashboard with real-time stats

---

├── lib/│ │ ├── provider/ # Provider dashboard

## Performance Targets

│ ├── db.ts # MongoDB helpers, type-safe queries│ │ └── seeker/ # Seeker dashboard

| Metric | Target | Implementation |

|--------|--------|----------------|│ ├── razorpay.ts # Orders, contacts, fund accounts, payouts│ ├── api/ # Route handlers

| **TTFB** | <200ms | Server Components, Edge-compatible |

| **LCP** | <2.5s | Image optimization via Cloudinary |│ ├── logger.ts # Structured logging (production-ready)│ │ ├── admin/ # Admin-specific APIs

| **API p95** | <500ms | MongoDB indexes on hot paths |

| **Concurrent bookings** | 10/provider | Capacity management in discovery API |│ └── api/│ │ │ └── dashboard-stats/ # NEW: Real-time admin metrics

---│ ├── schemas.ts # Zod v4 validation schemas│ │ ├── bookings/ # Booking management

## Scalability Notes│ └── response.ts # Standardized API responses│ │ ├── orders/ # Order processing

**Current architecture supports:**├── cron/│ │ ├── complaints/ # Dispute resolution

- 10,000 monthly orders with single MongoDB replica set

- Horizontal scaling via Vercel serverless functions│ ├── auto-reject-bookings.ts│ │ └── providers/ # Provider search & details

- Cron jobs designed for idempotent re-runs

│ ├── no-show-check.ts│ └── auth/ # Authentication pages

**Future scaling path:**

- Redis for session cache and rate limiting│ └── escrow-auto-release.ts├── components/ # React components

- BullMQ for job queues (notifications, batch payouts)

- Read replicas for analytics queries└── types/│ ├── navigation/ # Nav bars & sidebars

--- ├── bookings.ts│ ├── orders/ # Order-related components

## Contributing ├── orders.ts│ ├── providers/ # Provider-related components

1. Fork the repository └── complaints.ts│ └── ui/ # Shadcn UI components

2. Create a feature branch from `main`

3. Ensure `npm run build` passes with 0 errors```├── lib/ # Utilities

4. Submit PR with clear description of changes

│ ├── db.ts # Database helpers

---

---│ ├── razorpay.ts # Payment integration (with validation)

## License

│ └── cloudinary.ts # Image uploads

MIT License. See [LICENSE](./LICENSE).

## Quick Start└── types/ # TypeScript definitions

---

````

<p align="center">

<strong>Built for people who have better things to do than laundry.</strong>```bash

</p>

# Clone---

git clone https://github.com/your-org/laundry-ease.git

cd laundry-ease## API Reference



# Install dependencies> **Full API Documentation**: See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete endpoint reference.

npm install

### Key Endpoints

# Configure environment (see below)

cp .env.example .env.local#### Authentication



# Run development server- `POST /api/auth/[...nextauth]` - NextAuth handlers

npm run dev- `POST /api/otp/request` - Send OTP

- `POST /api/otp/verify` - Verify OTP

# Build for production

npm run build#### Admin (NEW)

````

- `GET /api/admin/dashboard-stats` - Real-time platform statistics

### Environment Variables- `GET /api/admin/users` - List all users

- `GET /api/admin/payments` - Payment management

```env- `GET /api/admin/complaints` - Complaint overview

# Database

MONGODB_URI=mongodb+srv://...#### Providers

# Auth- `GET /api/providers` - List providers

NEXTAUTH_SECRET=<32+ char random string>- `GET /api/providers/search` - Search by location

NEXTAUTH_URL=http://localhost:3000- `GET /api/provider/dashboard-stats` - Provider metrics

# Razorpay (REQUIRED - no fallback)#### Bookings & Orders

RAZORPAY*KEY_ID=rzp_live*...

RAZORPAY_KEY_SECRET=...- `POST /api/bookings` - Create booking

RAZORPAYX_ACCOUNT_NUMBER=...- `GET /api/bookings/seeker` - Seeker's bookings

NEXT*PUBLIC_RAZORPAY_KEY_ID=rzp_live*...- `GET /api/bookings/provider` - Provider's bookings

- `PATCH /api/orders/[id]/status` - Update order status

# Cloudinary- `POST /api/orders/[id]/pay` - Process payment

CLOUDINARY_CLOUD_NAME=...

CLOUDINARY_API_KEY=...See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for all 40+ endpoints.

CLOUDINARY_API_SECRET=...

---

# Twilio (SMS/OTP)

TWILIO_ACCOUNT_SID=...## Business Rules

TWILIO_AUTH_TOKEN=...

TWILIO_PHONE_NUMBER=...### Booking Fee

# Email- Provider sets their own booking fee

EMAIL_USER=...- Fee is paid upfront to confirm booking

EMAIL_PASS=...- Fee is deducted from final invoice if order completes

- Fee is refunded if provider rejects or doesn't show up

# Cron Security- Fee is forfeited if seeker cancels after acceptance

CRON_SECRET=<32+ char random string>

````### Escrow System



---- Payment held for 24 hours after delivery

- Seeker can raise complaint within this window

## Security Model- If no complaint, funds auto-release to provider

- 5% platform commission deducted from payouts

| Layer | Implementation |

|-------|---------------|### One Complaint Per Order

| **Authentication** | NextAuth.js with JWT; Google OAuth + email/password credentials |

| **Authorization** | Role-based middleware; Admin/Provider/Seeker segregation |- Each order can only have one active complaint

| **API Validation** | Zod v4 schemas on all inputs; ObjectId format validation |- Complaints lock escrow until resolved

| **Payment Security** | Never store card data; Razorpay tokenization; webhook signature verification |- Admin controls all resolutions

| **Cron Protection** | Bearer token authentication on all `/api/cron/*` endpoints |

| **Data Masking** | Bank details masked in API responses; full values only for payout execution |---



---## Tech Stack



## Performance Characteristics| Layer         | Technology                                              |

| ------------- | ------------------------------------------------------- |

| Metric | Target | Implementation || Framework     | Next.js 16 (App Router + Server Actions)                |

|--------|--------|---------------|| Language      | TypeScript 5 (Strict Mode + Type Safety)                |

| **TTFB** | <200ms | Server Components, Edge-compatible || Styling       | Tailwind CSS 4                                          |

| **LCP** | <2.5s | Image optimization via Cloudinary || UI Components | Shadcn/UI                                               |

| **API p95** | <500ms | MongoDB indexes on hot paths || Database      | MongoDB Atlas                                           |

| **Concurrent bookings** | 10/provider | Capacity management in discovery API || Auth          | NextAuth.js (Role-Based Access Control)                 |

| Payments      | Razorpay Orders + RazorpayX Payouts (Validation Sealed) |

---| Images        | Cloudinary (Signed Uploads)                             |

| Documentation | Context7-Verified API Contracts                         |

## Scalability Notes| SMS           | Twilio                                                  |

| Email         | Nodemailer (Gmail SMTP)                                 |

**Current architecture supports:**

- 10,000 monthly orders with single MongoDB replica set---

- Horizontal scaling via Vercel serverless functions

- Cron jobs designed for idempotent re-runs## Scripts



**Future scaling path:**```bash

- Redis for session cache and rate limitingnpm run dev      # Start development server

- BullMQ for job queues (notifications, batch payouts)npm run build    # Build for production (✅ Passing)

- Read replicas for analytics queriesnpm run start    # Start production server

npm run lint     # Run ESLint (193 warnings, 0 errors)

---```



## Business Rules (Encoded in System)---



| Rule | Implementation |## Build Status

|------|---------------|

| **Booking fee** | Provider-defined; deducted from final invoice on success |✅ **Production Ready**

| **Auto-reject** | 2h timeout → full refund to seeker |

| **No-show penalty** | GPS verification; refund + provider flag |- TypeScript compilation: **0 errors**

| **Escrow window** | 24h post-delivery; cron-triggered release |- Production build: **Passing**

| **Platform commission** | 5% deducted from provider payout |- ESLint: **0 errors**, 193 warnings (non-blocking)

| **Late penalty** | 5%/hour, max 30% (calculated at delivery) |- All 73 routes: **Successfully compiled**

| **One complaint per order** | Enforced at API level |

---

---

## Recent Updates

## Build Status

### v3.0 (2025-12-29)

````

✅ TypeScript: 0 errors- ✅ **Admin Dashboard Stats API** - Real-time platform metrics

✅ Production build: Passing- ✅ **Build Optimization** - ESLint configuration for production

✅ ESLint: 0 errors (warnings acceptable)- ✅ **Type Safety** - Removed explicit 'any' types from critical flows

✅ All 73 routes: Compiled- ✅ **Environment Validation** - Razorpay credentials now required

```- ✅ **Documentation** - Comprehensive API documentation added



---### v2.0 (2025-12-28)



## API Reference- ✅ **Backend Integration** - 100% real data, zero mock data

- ✅ **Provider Ratings** - Dynamic ratings from database

Full documentation: [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md)- ✅ **Payment Security** - Enhanced Razorpay integration



Key endpoints:---

- `POST /api/bookings` — Create booking with fee payment

- `POST /api/bookings/[id]/accept` — Provider accepts (syncs Razorpay fund account)## Contributing

- `POST /api/orders/[id]/confirm-delivery` — OTP verification, starts escrow

- `GET /api/cron/process-payouts` — Escrow release (requires CRON_SECRET)1. Fork the repository

- `POST /api/admin/complaints/[id]/resolve` — Admin resolution with payment action2. Create a feature branch (`git checkout -b feature/amazing-feature`)

3. Commit your changes (`git commit -m 'Add amazing feature'`)

---4. Push to the branch (`git push origin feature/amazing-feature`)

5. Open a Pull Request

## Contributing

---

1. Fork the repository

2. Create a feature branch from `main`## License

3. Write tests for new functionality

4. Ensure `npm run build` passesMIT License. See [LICENSE](LICENSE) for details.

5. Submit PR with clear description of changes

---

---

<p align="center">

## License  <strong>Built with ❤️ for busy professionals.</strong>

</p>

MIT License. See [LICENSE](./LICENSE).

---

<p align="center">
<strong>Built for people who have better things to do than laundry.</strong>
</p>
```
