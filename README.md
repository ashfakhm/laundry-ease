# LaundryEase# LaundryEase

**The laundry problem, engineered away.**> **Laundry, solved.** A premium on-demand laundry marketplace for busy professionals.

LaundryEase is a production-grade marketplace that connects urban professionals with verified laundry providers. It eliminates the 2-4 hours per week that busy people lose to laundry logistics—pickup, tracking, delays, and disputes—by providing doorstep service with escrow-protected payments, photo-documented handoffs, and guaranteed deadlines.[![Next.js](https://img.shields.io/badge/Next.js%2016-black?logo=next.js)](https://nextjs.org)

[![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)](https://typescriptlang.org)

This is not another gig-economy prototype. Every state transition is defined. Every edge case has a handler. Every failure mode has a recovery path.[![Razorpay](https://img.shields.io/badge/Razorpay-blue?logo=razorpay&logoColor=white)](https://razorpay.com)

[![Build Status](https://img.shields.io/badge/Build-Passing-Success)](https://github.com/your-org/laundry-ease/actions)

---[![Context7](https://img.shields.io/badge/Verified%20with-Context7-purple)](https://context7.com)

## The Problem---

Traditional laundry services fail knowledge workers in predictable ways:## What is LaundryEase?

| Failure Mode | Business Impact |LaundryEase is a **production-ready** laundry marketplace connecting busy professionals with verified service providers. It features a robust, type-safe architecture designed for reliability and scale.

|-------------|-----------------|

| Physical shop visits | 2-4 hours/week of high-value time lost || Problem | Solution |

| No deadline guarantees | Missed presentations, events, interviews || ------------------------------------- | -------------------------------- |

| Opaque pricing | Budget uncertainty, surprise charges || 2-4 hours/week wasted on laundry runs | Doorstep pickup & delivery |

| Zero accountability | Damaged/lost items with no recourse || Missed deadlines for urgent clothes | Deadline-guaranteed matching |

| Cash-only operations | Security risk, inconvenience || Unclear pricing, surprise charges | Transparent fixed-price lists |

| No accountability for damage/loss | Photo evidence + Admin mediation |

These aren't minor annoyances—they're systematic friction that scales with urbanization.| Payment disputes | Escrow-protected payments |

## The Solution---

LaundryEase addresses each failure mode with an engineered countermeasure:## Quick Start

- **Doorstep pickup/delivery** eliminates travel entirely```bash

- **Escrow-protected payments** hold funds for 24h post-delivery, releasing only after the complaint window closes# 1. Clone and install

- **Photo-documented handoffs** create irrefutable evidence for dispute resolutiongit clone https://github.com/your-org/laundry-ease.git

- **Provider-set booking fees** filter unserious customers while compensating providers for no-showscd laundry-ease

- **Admin-mediated three-way chat** resolves disputes with full contextnpm install

---# 2. Configure environment

cp .env.example .env.local

## Architecture# Add your API keys (see Environment Variables below)

````# 3. Run development server

┌─────────────────────────────────────────────────────────────────┐npm run dev

│                         FRONTEND                                │

│     Next.js 16 (App Router) + React 19 + Tailwind CSS 4        │# 4. Build for production

│     Server Components • Server Actions • Streaming SSR          │npm run build

└─────────────────────────────────────────────────────────────────┘```

                              │

                              ▼Open [http://localhost:3000](http://localhost:3000)

┌─────────────────────────────────────────────────────────────────┐

│                        API LAYER                                │---

│   Route Handlers • NextAuth v4 • Zod v4 Validation • RBAC      │

└─────────────────────────────────────────────────────────────────┘## Environment Variables

                              │

          ┌───────────────────┼───────────────────┐Create a `.env.local` file with:

          ▼                   ▼                   ▼

   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐```env

   │  MongoDB    │     │  Razorpay   │     │ Cloudinary  │# Database

   │  Atlas      │     │  + RazorpayX│     │  (Images)   │MONGODB_URI=mongodb+srv://...

   │  (Primary)  │     │  (Payments) │     │             │

   └─────────────┘     └─────────────┘     └─────────────┘# Authentication

          │NEXTAUTH_SECRET=your-secret-here

          ▼NEXTAUTH_URL=http://localhost:3000

   ┌─────────────┐

   │   Cron      │# Razorpay (Payments)

   │   Jobs      │RAZORPAY_KEY_ID=rzp_test_...

   │  (Escrow)   │RAZORPAY_KEY_SECRET=...

   └─────────────┘NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...

````

# Cloudinary (Image Storage)

### Key Architectural DecisionsCLOUDINARY_CLOUD_NAME=...

CLOUDINARY_API_KEY=...

| Decision | Rationale |CLOUDINARY_API_SECRET=...

|----------|-----------|

| **Next.js 16 App Router** | Server Components reduce client bundle; Server Actions eliminate API boilerplate for mutations |# SMS (OTP via Twilio)

| **MongoDB over Postgres** | Flexible schema for evolving order items; native geospatial queries for provider discovery |TWILIO_ACCOUNT_SID=...

| **Razorpay + RazorpayX** | Single vendor for collection (Orders API) and disbursement (Payouts API); native UPI support for India |TWILIO_AUTH_TOKEN=...

| **24h Escrow Window** | Balances seeker protection with provider cash flow; industry-standard for marketplace trust |TWILIO_PHONE_NUMBER=...

| **Cron-based Auto-release** | Deterministic, auditable payout triggers; no complex event-driven architecture needed for MVP |

# Email (Nodemailer via Gmail SMTP)

---EMAIL_USER=your-gmail-address@gmail.com

EMAIL_PASS=your-gmail-app-password

## Tech Stack

# Cron Jobs

| Layer | Technology | Version | Why |CRON_SECRET=your-secure-secret

|-------|-----------|---------|-----|```

| Framework | Next.js | 16.1.1 | App Router, Server Actions, React 19 support |

| Language | TypeScript | 5.x | Strict mode enabled; Zod for runtime validation |**⚠️ Important**: Razorpay credentials are now **required** (no fallback values). The app will show warnings if credentials are missing.

| Styling | Tailwind CSS | 4.x | CSS-first config, @theme inline directive |

| UI | shadcn/ui | Latest | Accessible, composable, zero vendor lock-in |---

| Database | MongoDB Atlas | 6.x | Geospatial indexes, flexible documents |

| Auth | NextAuth.js | 4.24 | Google OAuth + Credentials; JWT sessions |## Architecture

| Payments | Razorpay | — | Orders API (collection) + RazorpayX (payouts) |

| Storage | Cloudinary | — | Signed uploads, automatic optimization |```

| SMS | Twilio | — | OTP delivery, transactional alerts |┌─────────────────────────────────────────────────────────────┐

| Email | Nodemailer | — | Magic links, order confirmations |│ FRONTEND │

│ Next.js 16 (App Router + Server Actions) + React + Tailwind CSS + Shadcn │

---└─────────────────────────────────────────────────────────────┘

                              │

## Core Workflows ▼

┌─────────────────────────────────────────────────────────────┐

### Booking → Order Lifecycle│ API LAYER │

│ Route Handlers (/app/api/\*) + NextAuth + Zod Validation │

````└─────────────────────────────────────────────────────────────┘

SEEKER                          PROVIDER                         SYSTEM                              │

───────────────────────────────────────────────────────────────────────────          ┌───────────────────┼───────────────────┐

Search providers by location          ▼                   ▼                   ▼

        │   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐

        ▼   │  MongoDB    │     │  Razorpay   │     │ Cloudinary  │

Book + pay booking fee ─────────► Notification received   │  (Database) │     │  (Payments) │     │  (Images)   │

                                         │   └─────────────┘     └─────────────┘     └─────────────┘

                                         ▼```

                                 Accept (2h SLA) ◄───── Auto-reject if timeout

                                         │---

                                         ▼

                                 Propose pickup time## User Roles

        │

        ▼| Role         | Description                              |

Confirm availability| ------------ | ---------------------------------------- |

        │| **Seeker**   | Customer who books laundry services      |

        ▼| **Provider** | Laundry professional who fulfills orders |

Present at pickup ◄──────────── Arrive + GPS verify ◄─── No-show detection| **Admin**    | Platform operator who manages disputes   |

        │                                │

        ▼                                ▼---

Review invoice ◄───────────────  Create itemized invoice

        │                        (photo per item)## Core Workflows

        ▼

Approve invoice ─────────────────────────────────────► Order created### 1. Booking Flow

        │

        ▼```

Pay order total ─────────────────────────────────────► Funds collectedSeeker Books → Provider Accepts → Pickup Scheduled → Invoice Created → Order Paid

        │```

        ▼

Track status ◄───────────────── Update: WASHING → IRONING → READY### 2. Order Flow

        │

        ▼```

Confirm delivery (OTP) ◄──────── Deliver + capture proof ──► Escrow starts (24h)Picked Up → Processing → Ready → Delivered → OTP Verified → Escrow Released

        │```

        ├─── Raise complaint ──────────────────────────────► Escrow frozen

        │         │### 3. Dispute Flow

        │         ▼

        │    Admin resolution ─────────────────────────────► Refund OR Release```

        │Complaint Raised → Admin Reviews → Chat Opened → Resolution Applied

        └─── No complaint ─────────────────────────────────► Auto-release (cron)```

````

---

### Payment Flow

## Key Features

````

Seeker pays ─► Razorpay Order ─► Platform holds ─► 24h escrow ─► RazorpayX Payout### For Seekers

                    │                  │                              │

                    │                  │                              ▼- **Find Providers** — Search by location, view ratings & prices

                    │                  │                    95% to Provider- **Book & Pay** — Secure booking with upfront pricing

                    │                  │                    5% Platform fee- **Track Orders** — Real-time status updates

                    │                  │- **Raise Disputes** — Photo evidence + Admin mediation

                    │                  └─► Complaint? ─► Freeze until resolved

                    │### For Providers

                    └─► Booking fee: Refunded on reject, forfeited on seeker no-show

```- **Manage Bookings** — Accept/reject with one click

- **Generate Invoices** — Photo-based itemization

---- **Get Paid** — Automatic payouts after delivery

- **Dashboard Stats** — Real-time revenue, pickups, and deliveries

## Project Structure

### For Admins

````

laundry-ease/- **Resolve Disputes** — Three-way chat, refund controls

├── app/- **Manage Users** — Suspend, ban, or warn accounts

│ ├── (dashboard)/- **Monitor Payments** — Track escrow and payouts

│ │ ├── admin/ # Platform operations: disputes, payouts, users- **Dashboard Analytics** — Real-time platform statistics

│ │ ├── provider/ # Booking management, invoicing, payouts - Open complaints count

│ │ └── seeker/ # Discovery, orders, complaints - Total escrow balance

│ ├── api/ - Active providers (last 7 days)

│ │ ├── auth/ # NextAuth + magic link - Total revenue and orders

│ │ ├── bookings/ # CRUD + accept/reject + scheduling

│ │ ├── orders/ # Lifecycle + payment + delivery---

│ │ ├── complaints/ # Filing + chat + resolution

│ │ ├── cron/ # Auto-reject, no-show, escrow release## Project Structure

│ │ └── admin/ # Dashboard stats, user management

│ └── (auth)/ # Login, signup, verification flows```

├── components/laundry-ease/

│ ├── ui/ # shadcn primitives├── app/ # Next.js App Router

│ ├── navigation/ # Role-specific sidebars│ ├── (dashboard)/ # Protected routes

│ └── orders/ # Payment buttons, status badges│ │ ├── admin/ # Admin dashboard with real-time stats

├── lib/│ │ ├── provider/ # Provider dashboard

│ ├── db.ts # MongoDB helpers, type-safe queries│ │ └── seeker/ # Seeker dashboard

│ ├── razorpay.ts # Orders, contacts, fund accounts, payouts│ ├── api/ # Route handlers

│ ├── logger.ts # Structured logging (production-ready)│ │ ├── admin/ # Admin-specific APIs

│ └── api/│ │ │ └── dashboard-stats/ # NEW: Real-time admin metrics

│ ├── schemas.ts # Zod v4 validation schemas│ │ ├── bookings/ # Booking management

│ └── response.ts # Standardized API responses│ │ ├── orders/ # Order processing

├── cron/│ │ ├── complaints/ # Dispute resolution

│ ├── auto-reject-bookings.ts│ │ └── providers/ # Provider search & details

│ ├── no-show-check.ts│ └── auth/ # Authentication pages

│ └── escrow-auto-release.ts├── components/ # React components

└── types/│ ├── navigation/ # Nav bars & sidebars

    ├── bookings.ts│   ├── orders/             # Order-related components

    ├── orders.ts│   ├── providers/          # Provider-related components

    └── complaints.ts│   └── ui/                 # Shadcn UI components

```├── lib/                    # Utilities

│   ├── db.ts               # Database helpers

---│   ├── razorpay.ts         # Payment integration (with validation)

│   └── cloudinary.ts       # Image uploads

## Quick Start└── types/                  # TypeScript definitions

```

```bash

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

```

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
