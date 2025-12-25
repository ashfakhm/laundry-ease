# LaundryEase

> **Laundry, solved.** A premium on-demand laundry marketplace for busy professionals.

[![Next.js](https://img.shields.io/badge/Next.js%2015-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Razorpay](https://img.shields.io/badge/Razorpay-blue?logo=razorpay&logoColor=white)](https://razorpay.com)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5?logo=cloudinary&logoColor=white)](https://cloudinary.com)

---

## What is LaundryEase?

LaundryEase connects busy professionals with verified laundry service providers. No shop visits, no missed deadlines, no payment disputes.

| Problem | Solution |
|---------|----------|
| 2-4 hours/week wasted on laundry runs | Doorstep pickup & delivery |
| Missed deadlines for urgent clothes | Deadline-guaranteed matching |
| Unclear pricing, surprise charges | Transparent fixed-price lists |
| No accountability for damage/loss | Photo evidence + Admin mediation |
| Payment disputes | Escrow-protected payments |

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

# Cloudinary (Image Storage)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Optional: SMS & Email
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
SENDGRID_API_KEY=...
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│  Next.js 16 (App Router) + React + Tailwind CSS + Shadcn   │
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

| Role | Description |
|------|-------------|
| **Seeker** | Customer who books laundry services |
| **Provider** | Laundry professional who fulfills orders |
| **Admin** | Platform operator who manages disputes |

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

### For Admins
- **Resolve Disputes** — Three-way chat, refund controls
- **Manage Users** — Suspend, ban, or warn accounts
- **Monitor Payments** — Track escrow and payouts

---

## Project Structure

```
laundry-ease/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # Protected routes
│   │   ├── admin/          # Admin dashboard
│   │   ├── provider/       # Provider dashboard
│   │   └── seeker/         # Seeker dashboard
│   ├── api/                # Route handlers
│   └── auth/               # Authentication pages
├── components/             # React components
│   ├── navigation/         # Nav bars & sidebars
│   ├── orders/             # Order-related components
│   ├── providers/          # Provider-related components
│   └── ui/                 # Shadcn UI components
├── lib/                    # Utilities
│   ├── db.ts               # Database helpers
│   ├── razorpay.ts         # Payment integration
│   └── cloudinary.ts       # Image uploads
└── types/                  # TypeScript definitions
```

---

## API Reference

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/[...nextauth]` | ALL | NextAuth handlers |
| `/api/verify-phone` | POST | Send/verify OTP |
| `/api/verify-email` | POST | Magic link verification |

### Bookings
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/bookings` | GET, POST | List/create bookings |
| `/api/bookings/[id]` | GET, PATCH | Get/update booking |
| `/api/bookings/[id]/accept` | POST | Provider accepts |

### Orders
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/orders` | GET | List orders |
| `/api/orders/[id]/status` | PATCH | Update status |
| `/api/orders/[id]/pay` | POST | Process payment |
| `/api/orders/[id]/confirm-delivery` | POST | OTP verification |

### Complaints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/complaints` | GET, POST | List/create complaints |
| `/api/complaints/[id]/messages` | GET, POST | Chat messages |
| `/api/admin/complaints/[id]/resolve` | POST | Admin resolution |

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

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| UI Components | Shadcn/UI |
| Database | MongoDB Atlas |
| Auth | NextAuth.js |
| Payments | Razorpay + RazorpayX |
| Images | Cloudinary |
| SMS | Twilio |
| Email | SendGrid |

---

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

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
