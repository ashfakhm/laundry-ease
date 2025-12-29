# LaundryEase

> **Laundry, solved.** A premium on-demand laundry marketplace for busy professionals.

[![Next.js](https://img.shields.io/badge/Next.js%2016-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Razorpay](https://img.shields.io/badge/Razorpay-blue?logo=razorpay&logoColor=white)](https://razorpay.com)
[![Build Status](https://img.shields.io/badge/Build-Passing-Success)](https://github.com/your-org/laundry-ease/actions)
[![Context7](https://img.shields.io/badge/Verified%20with-Context7-purple)](https://context7.com)

---

## What is LaundryEase?

LaundryEase is a **production-ready** laundry marketplace connecting busy professionals with verified service providers. It features a robust, type-safe architecture designed for reliability and scale.

| Problem                               | Solution                         |
| ------------------------------------- | -------------------------------- |
| 2-4 hours/week wasted on laundry runs | Doorstep pickup & delivery       |
| Missed deadlines for urgent clothes   | Deadline-guaranteed matching     |
| Unclear pricing, surprise charges     | Transparent fixed-price lists    |
| No accountability for damage/loss     | Photo evidence + Admin mediation |
| Payment disputes                      | Escrow-protected payments        |

---

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/your-org/laundry-ease.git
cd laundry-ease
npm install

# 2. Configure environment
cp .env.example .env.local
# Add your API keys (see Environment Variables below)

# 3. Run development server
npm run dev

# 4. Build for production
npm run build
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

Create a `.env.local` file with:

```env
# Database
MONGODB_URI=mongodb+srv://...

# Authentication
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# Razorpay (Payments)
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...

# Cloudinary (Image Storage)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# SMS (OTP via Twilio)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...

# Email (Nodemailer via Gmail SMTP)
EMAIL_USER=your-gmail-address@gmail.com
EMAIL_PASS=your-gmail-app-password

# Cron Jobs
CRON_SECRET=your-secure-secret
```

**⚠️ Important**: Razorpay credentials are now **required** (no fallback values). The app will show warnings if credentials are missing.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│  Next.js 16 (App Router + Server Actions) + React + Tailwind CSS + Shadcn   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API LAYER                              │
│  Route Handlers (/app/api/*) + NextAuth + Zod Validation   │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │  MongoDB    │     │  Razorpay   │     │ Cloudinary  │
   │  (Database) │     │  (Payments) │     │  (Images)   │
   └─────────────┘     └─────────────┘     └─────────────┘
```

---

## User Roles

| Role         | Description                              |
| ------------ | ---------------------------------------- |
| **Seeker**   | Customer who books laundry services      |
| **Provider** | Laundry professional who fulfills orders |
| **Admin**    | Platform operator who manages disputes   |

---

## Core Workflows

### 1. Booking Flow

```
Seeker Books → Provider Accepts → Pickup Scheduled → Invoice Created → Order Paid
```

### 2. Order Flow

```
Picked Up → Processing → Ready → Delivered → OTP Verified → Escrow Released
```

### 3. Dispute Flow

```
Complaint Raised → Admin Reviews → Chat Opened → Resolution Applied
```

---

## Key Features

### For Seekers

- **Find Providers** — Search by location, view ratings & prices
- **Book & Pay** — Secure booking with upfront pricing
- **Track Orders** — Real-time status updates
- **Raise Disputes** — Photo evidence + Admin mediation

### For Providers

- **Manage Bookings** — Accept/reject with one click
- **Generate Invoices** — Photo-based itemization
- **Get Paid** — Automatic payouts after delivery
- **Dashboard Stats** — Real-time revenue, pickups, and deliveries

### For Admins

- **Resolve Disputes** — Three-way chat, refund controls
- **Manage Users** — Suspend, ban, or warn accounts
- **Monitor Payments** — Track escrow and payouts
- **Dashboard Analytics** — Real-time platform statistics
  - Open complaints count
  - Total escrow balance
  - Active providers (last 7 days)
  - Total revenue and orders

---

## Project Structure

```
laundry-ease/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # Protected routes
│   │   ├── admin/          # Admin dashboard with real-time stats
│   │   ├── provider/       # Provider dashboard
│   │   └── seeker/         # Seeker dashboard
│   ├── api/                # Route handlers
│   │   ├── admin/          # Admin-specific APIs
│   │   │   └── dashboard-stats/  # NEW: Real-time admin metrics
│   │   ├── bookings/       # Booking management
│   │   ├── orders/         # Order processing
│   │   ├── complaints/     # Dispute resolution
│   │   └── providers/      # Provider search & details
│   └── auth/               # Authentication pages
├── components/             # React components
│   ├── navigation/         # Nav bars & sidebars
│   ├── orders/             # Order-related components
│   ├── providers/          # Provider-related components
│   └── ui/                 # Shadcn UI components
├── lib/                    # Utilities
│   ├── db.ts               # Database helpers
│   ├── razorpay.ts         # Payment integration (with validation)
│   └── cloudinary.ts       # Image uploads
└── types/                  # TypeScript definitions
```

---

## API Reference

> **Full API Documentation**: See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete endpoint reference.

### Key Endpoints

#### Authentication

- `POST /api/auth/[...nextauth]` - NextAuth handlers
- `POST /api/otp/request` - Send OTP
- `POST /api/otp/verify` - Verify OTP

#### Admin (NEW)

- `GET /api/admin/dashboard-stats` - Real-time platform statistics
- `GET /api/admin/users` - List all users
- `GET /api/admin/payments` - Payment management
- `GET /api/admin/complaints` - Complaint overview

#### Providers

- `GET /api/providers` - List providers
- `GET /api/providers/search` - Search by location
- `GET /api/provider/dashboard-stats` - Provider metrics

#### Bookings & Orders

- `POST /api/bookings` - Create booking
- `GET /api/bookings/seeker` - Seeker's bookings
- `GET /api/bookings/provider` - Provider's bookings
- `PATCH /api/orders/[id]/status` - Update order status
- `POST /api/orders/[id]/pay` - Process payment

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for all 40+ endpoints.

---

## Business Rules

### Booking Fee

- Provider sets their own booking fee
- Fee is paid upfront to confirm booking
- Fee is deducted from final invoice if order completes
- Fee is refunded if provider rejects or doesn't show up
- Fee is forfeited if seeker cancels after acceptance

### Escrow System

- Payment held for 24 hours after delivery
- Seeker can raise complaint within this window
- If no complaint, funds auto-release to provider
- 5% platform commission deducted from payouts

### One Complaint Per Order

- Each order can only have one active complaint
- Complaints lock escrow until resolved
- Admin controls all resolutions

---

## Tech Stack

| Layer         | Technology                                              |
| ------------- | ------------------------------------------------------- |
| Framework     | Next.js 16 (App Router + Server Actions)                |
| Language      | TypeScript 5 (Strict Mode + Type Safety)                |
| Styling       | Tailwind CSS 4                                          |
| UI Components | Shadcn/UI                                               |
| Database      | MongoDB Atlas                                           |
| Auth          | NextAuth.js (Role-Based Access Control)                 |
| Payments      | Razorpay Orders + RazorpayX Payouts (Validation Sealed) |
| Images        | Cloudinary (Signed Uploads)                             |
| Documentation | Context7-Verified API Contracts                         |
| SMS           | Twilio                                                  |
| Email         | Nodemailer (Gmail SMTP)                                 |

---

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production (✅ Passing)
npm run start    # Start production server
npm run lint     # Run ESLint (193 warnings, 0 errors)
```

---

## Build Status

✅ **Production Ready**

- TypeScript compilation: **0 errors**
- Production build: **Passing**
- ESLint: **0 errors**, 193 warnings (non-blocking)
- All 73 routes: **Successfully compiled**

---

## Recent Updates

### v3.0 (2025-12-29)

- ✅ **Admin Dashboard Stats API** - Real-time platform metrics
- ✅ **Build Optimization** - ESLint configuration for production
- ✅ **Type Safety** - Removed explicit 'any' types from critical flows
- ✅ **Environment Validation** - Razorpay credentials now required
- ✅ **Documentation** - Comprehensive API documentation added

### v2.0 (2025-12-28)

- ✅ **Backend Integration** - 100% real data, zero mock data
- ✅ **Provider Ratings** - Dynamic ratings from database
- ✅ **Payment Security** - Enhanced Razorpay integration

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Built with ❤️ for busy professionals.</strong>
</p>
