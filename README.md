# LaundryEase

## 1. One-Paragraph Product Story

Laundry runs on informal promises: “I’ll pick it up,” “I’ll start tonight,” “I’ll pay when it’s delivered.” Those promises break because neither side can prove what happened and neither side wants to take the first risk. Customers hand over personal clothing with no visibility. Providers spend time, water, electricity, and labor with no payment guarantee. Existing marketplaces paper over the gap with reviews and chat, but the failure happens mid-transaction, not after it. LaundryEase exists because local services need a contract you can see: money committed before work starts, progress tracked as facts, and delivery verified before settlement.

## 2. What This Product Is

LaundryEase is an escrow-backed workflow system that turns a local laundry job into a verifiable sequence of states from booking to delivery.

## 3. Core Principles

1. **Commitment before labor**
   We lock payment in escrow only after the provider inspects items and issues an invoice. Providers don’t work on a maybe.

2. **Every physical step has a recorded state**
   “In progress” creates panic and phone calls. We use explicit lifecycle states so both sides share the same reality.

3. **Distance must make economic sense**
   Availability depends on radius, not hope. We only show providers who deliberately cover the seeker’s location.

4. **Humans keep control**
   Providers set their own radius, pricing, and acceptance decisions. The platform enforces the contract; it doesn’t run their business.

## 4. How the System Works (Mental Model)

Picture LaundryEase as three linked tracks that move in lockstep: **Location**, **State**, and **Money**.

1. **Location chooses who can even participate**
   The seeker shares a point on the map. The system returns only providers whose service radius covers that point.

2. **State creates the shared timeline**
   A seeker requests a booking. A provider accepts. After inspection and invoicing, the job advances through a fixed lifecycle (washing → ironing → ready → out for delivery → delivered). Nobody “says” it’s done; the system records it.

3. **Money follows state, not messaging**
   The seeker pays the invoice. The system holds funds in escrow while the provider executes. Delivery completes only when the seeker confirms with an OTP. That confirmation triggers settlement.

## 5. Key Capabilities

- **Radius-true discovery**
  Seekers stop calling providers who don’t actually serve their area. The system filters by coverage before the first message.

- **Invoice then escrow**
  Providers stop debating price after pickup. They issue a precise invoice and get a locked commitment before they spend time and supplies.

- **Deterministic order tracking**
  Seekers stop chasing updates. Providers stop answering the same question all day. The job tells its own story through state.

- **Delivery authentication**
  Providers stop fearing “delivered but unpaid.” Seekers stop fearing “paid but not delivered.” OTP ties the final handoff to a recorded confirmation.
- **Complaint & dispute resolution**
  Seekers can raise complaints within 24 hours of delivery. Escrow freezes immediately. Admin mediates through a 3-way chat system with response deadlines.
- **Reschedule without cancellation (booking-level)**
  Either side can request a pickup reschedule while pickup is still being negotiated. Reschedule creates an explicit booking state (not a cancellation) and routes the booking back into the propose/confirm flow.

## 6. Who This Is For

- **For** local laundry businesses and serious independent providers who run scheduled work and want payment certainty.
- **For** customers who want predictable timelines and proof, not reassurance.

Not for:

- **Not for** “instant gig” pickup models where speed beats verification.
- **Not for** platforms that want algorithmic pricing or anonymous providers.
- **Not for** operations that require the platform to supply delivery riders.

## 7. Why This Architecture

LaundryEase treats a laundry order like a small contract.

- We separate the **handshake** (booking) from the **commitment** (paid invoice) so neither side gets trapped by assumptions.
- We keep the system strict about **state transitions** because ambiguity costs more than friction.
- We use escrow and OTP as the minimum mechanism that closes the trust gap without turning the platform into an arbitrator-by-default.

Tradeoff: the flow rejects “fast but fuzzy” transactions. It favors clarity over impulse.

## 8. Getting Started

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

   Run the geospatial index setup (if script exists):

   ```bash
   # This ensures proper indexing for location-based queries
   npm run setup:geospatial-index
   ```

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

- `NEXTAUTH_URL` - Application base URL (defaults to `http://localhost:3000`)
- `NEXT_PUBLIC_BASE_URL` - Public URL for email links
- `NEXT_PUBLIC_APP_URL` - Alternative app URL
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret

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

## 10. Booking reschedule flow (latest)

LaundryEase supports a _reschedule request_ that is separate from cancellation.

### What it does

- Either **seeker or provider** can request a pickup reschedule.
- The booking moves to `reschedule_requested`.
- The system clears pickup confirmation (`pickupSlot.confirmedAt`) so a new proposal can be made.
- The reschedule action is tracked via `booking.reschedule` metadata (requestedBy, requestedAt, reason, count, previousPickupSlot).

### When it’s allowed

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

## 9. Project Status & Direction

Stable:

- Role-based flows (seeker/provider/admin)
- Location-based provider discovery
- Booking → invoicing → escrow → delivery confirmation loop
- Booking reschedule requests during pickup scheduling
- Complaint system with admin workflow (accept → add provider → resolve)
- 3-way chat for dispute mediation (seeker, provider, admin)
- Response deadline tracking for provider engagement
- Escrow freeze on complaint, release on resolution

Intentionally not finished yet:

- Partial refund flow (currently only full refund or full payout)
- Complaint window extension requests
- Cancellation and no-show handling that enforces penalties consistently
- Provider field UX polish (mobile-first ergonomics)

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
   - Seeker notified of acceptance

3. **Admin adds provider to chat**
   - Provider gains access to complaint details
   - Status moves to `in_review`
   - 3-way conversation begins (Admin, Seeker, Provider)

4. **Admin resolves complaint**
   - `release_payout` - Funds go to provider (complaint dismissed or resolved in provider's favor)
   - `refund_full` - Seeker receives full refund (provider at fault)
   - `reject` - Complaint invalid; funds released to provider

### API endpoints

- `POST /api/complaints` - Create complaint (seeker)
- `GET /api/complaints/:id` - Get complaint details
- `GET /api/complaints/:id/messages` - Get chat messages
- `POST /api/complaints/:id/messages` - Send message
- `POST /api/admin/complaints/:id/accept` - Accept complaint (admin)
- `POST /api/admin/complaints/:id/add-provider` - Add provider to chat (admin)
- `POST /api/admin/complaints/:id/resolve` - Resolve with outcome (admin)

### Key rules

- **One order, one complaint**: Each order can have at most one complaint
- **Escrow freeze**: Raising a complaint halts the escrow release timer
- **Provider access control**: Provider only sees complaint after admin explicitly grants access
- **Response deadline**: Default 7 days from acceptance; overdue complaints surfaced to admin

## 12. Project Structure

```text
laundry-ease/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth route group
│   │   ├── verify-email/         # Email verification flow
│   │   └── verify-phone/         # Phone verification flow
│   ├── (dashboard)/              # Protected dashboard routes
│   │   ├── admin/                # Admin panel (complaints, users, payments)
│   │   ├── provider/             # Provider dashboard (bookings, orders, earnings, invoices)
│   │   └── seeker/               # Seeker dashboard (bookings, orders, disputes)
│   ├── (root)/                   # Public landing page route group
│   ├── actions/                  # Server actions
│   │   ├── booking-actions.ts    # Booking operations
│   │   ├── order-actions.ts      # Order operations
│   │   └── profile-actions.ts    # Profile operations
│   ├── api/                      # API routes
│   │   ├── admin/                # Admin endpoints (complaints, users, dashboard-stats, refund)
│   │   ├── auth/                 # NextAuth configuration
│   │   ├── bookings/             # Booking CRUD, chat, reschedule, dispute
│   │   ├── complaints/           # Complaint creation, messages
│   │   ├── cron/                 # Scheduled job endpoints
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
│   │   ├── signup/               # Registration endpoints
│   │   ├── upload/               # Image upload (Cloudinary)
│   │   └── webhooks/             # Payment webhooks (Razorpay)
│   ├── auth/                     # Auth pages (login)
│   ├── choose-role/              # Role selection after OAuth
│   ├── complete-signup/          # Profile completion (provider/seeker)
│   ├── reset-password/           # Password reset page
│   ├── signup/                   # Registration pages (provider/seeker)
│   ├── favicon.ico               # App favicon
│   ├── forbidden.tsx             # 403 error page
│   ├── global-error.tsx          # Global error boundary
│   ├── globals.css               # Global styles (Tailwind)
│   ├── layout.tsx                # Root layout with providers
│   ├── loading.tsx               # Global loading state
│   ├── not-found.tsx             # 404 error page
│   ├── page.tsx                  # Landing page
│   ├── robots.ts                 # SEO robots.txt generation
│   ├── sitemap.ts                # SEO sitemap generation
│   └── unauthorized.tsx          # 401 error page
│
├── components/                   # React components
│   ├── bookings/                 # Booking list components
│   ├── navigation/               # Sidebar, topnav components (admin, provider, seeker)
│   ├── orders/                   # Order actions, payment buttons
│   ├── provider/                 # Provider-specific components
│   ├── providers/                # Provider listing components (invoice-form)
│   ├── seeker/                   # Seeker-specific components
│   ├── seo/                      # SEO components (JSON-LD)
│   ├── ui/                       # shadcn/ui components
│   ├── booking-modal.tsx         # Booking creation modal
│   ├── chat-interface.tsx        # Booking chat with dispute modal
│   ├── complaint-chat.tsx        # 3-way complaint chat
│   ├── landing-animations.tsx    # Landing page animations (Framer Motion)
│   ├── landing-page-client.tsx   # Landing page client component
│   ├── provider-card.tsx         # Provider search result card
│   └── theme-toggle.tsx          # Dark/light mode toggle
│
├── cron/                         # Cron job logic
│   ├── auto-reject-bookings.ts   # Auto-reject expired booking requests
│   ├── escrow-auto-release.ts    # Auto-release escrow after cooling period
│   └── no-show-check.ts          # No-show detection and handling
│
├── docs/                         # Documentation
│   ├── PRD.md                    # Product Requirements Document
│   └── PRESENTATION_HELPER.md    # Demo/presentation guide
│
├── lib/                          # Shared utilities
│   ├── api/                      # API helpers (auth, errors, response, schemas)
│   ├── data/                     # Data fetching utilities
│   ├── orders/                   # Order-specific utilities
│   ├── audit.ts                  # Audit logging
│   ├── cloudinary.ts             # Image upload
│   ├── db.ts                     # Database operations
│   ├── delivery-otp-email.ts     # Delivery OTP email templates
│   ├── distance.ts               # Distance calculation utilities
│   ├── env.ts                    # Environment validation (Zod)
│   ├── escrow-jobs.ts            # Escrow job scheduling
│   ├── google-maps.ts            # Google Maps integration
│   ├── logger.ts                 # Structured logging
│   ├── mongodb.ts                # MongoDB connection
│   ├── otp.ts                    # OTP generation/verification
│   ├── razorpay.ts               # Razorpay payment integration
│   ├── setup-geospatial-index.ts # MongoDB geospatial index setup
│   ├── toast.ts                  # Toast notification utilities
│   └── utils.ts                  # General utilities (cn, formatters)
│
├── types/                        # TypeScript type definitions
│   ├── bookings.ts               # Booking types and states
│   ├── complaints.ts             # Complaint types and states
│   ├── enums.ts                  # Shared enums (Role, Status)
│   ├── next-auth.d.ts            # NextAuth type extensions
│   ├── order.ts                  # Order types
│   ├── orders.ts                 # Additional order types
│   └── provider.ts               # Provider types
│
├── public/                       # Static assets
│   └── laundryease-logo.png      # Application logo
│
├── proxy.ts                      # Custom proxy middleware (replaces middleware.ts)
├── next.config.ts                # Next.js configuration
├── vercel.json                   # Vercel deployment config (cron jobs)
├── components.json               # shadcn/ui configuration
├── eslint.config.mjs             # ESLint configuration
├── postcss.config.mjs            # PostCSS configuration
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
└── README.md                     # This file
```

### Key Directories Explained

| Directory                | Purpose                                            |
| ------------------------ | -------------------------------------------------- |
| `app/(dashboard)/`       | Role-based dashboards with protected routes        |
| `app/api/`               | RESTful API endpoints organized by domain          |
| `app/actions/`           | Next.js Server Actions for data mutations          |
| `components/ui/`         | Reusable shadcn/ui components                      |
| `components/navigation/` | Role-specific navigation (admin, provider, seeker) |
| `cron/`                  | Scheduled background jobs (Vercel cron)            |
| `docs/`                  | Product documentation and guides                   |
| `lib/api/`               | Request validation, error handling, auth helpers   |
| `lib/db.ts`              | Core database operations (CRUD, transactions)      |
| `types/`                 | Shared TypeScript interfaces and enums             |
| `public/`                | Static assets (logo, images)                       |
