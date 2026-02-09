# LaundryEase — Presentation Q&A Helper

> **Purpose**: This document helps you answer any question your HODs and teachers may ask about your project. Read it fully before your mock presentation.

---

## Table of Contents

1. [Project Overview Questions](#1-project-overview-questions)
2. [Technology Stack Questions](#2-technology-stack-questions)
3. [Architecture & Design Questions](#3-architecture--design-questions)
   - [3B. Code Location Questions](#3b-code-location-questions-where-is-x-written)
4. [Database Questions](#4-database-questions)
5. [Authentication & Security Questions](#5-authentication--security-questions)
6. [Payment & Escrow Questions](#6-payment--escrow-questions)
   - [6B. Location Tracking Questions](#6b-location-tracking-questions)
7. [Core Features Questions](#7-core-features-questions)
8. [API & Backend Questions](#8-api--backend-questions)
9. [Frontend & UI Questions](#9-frontend--ui-questions)
10. [Deployment & DevOps Questions](#10-deployment--devops-questions)
11. [Testing & Quality Questions](#11-testing--quality-questions)
12. [Challenges & Solutions](#12-challenges--solutions)
13. [Future Scope](#13-future-scope)
14. [Quick Technical Terms Glossary](#14-quick-technical-terms-glossary)

---

## 1. Project Overview Questions

### Q: What is LaundryEase?

**Answer**: LaundryEase is a full-stack web app that connects people who need laundry done (seekers) with people who do laundry (providers). It turns informal laundry deals into clear contracts with safe escrow payments, so both sides are protected.

### Q: What problem does it solve?

**Answer**: It solves three main problems:

1. **Payment worry for providers**: Providers always get paid after they finish the work
2. **Order confusion for seekers**: Seekers see a clear order timeline, not messy chat threads
3. **Trust problems**: The escrow system holds money safely until the service is done and confirmed with OTP

### Q: Who are the target users?

**Answer**: Three types of users:

- **Seekers**: People who need laundry services
- **Providers**: People or small businesses who do laundry work
- **Admins**: People who run the platform, handle problems, and manage the system

### Q: What makes this project different from other solutions?

**Answer**:

1. **Escrow-based payment**: Unlike informal deals, money is locked until delivery is confirmed with OTP
2. **Location matching**: Only providers who serve the seeker's exact area are shown
3. **Proper complaint system**: 3-way chat between Admin, Seeker, and Provider to solve problems fairly
4. **Full record keeping**: Every change is saved for openness and trust

---

## 2. Technology Stack Questions

### Q: Why did you choose Next.js over MERN stack?

**Answer**: I chose Next.js App Router over normal MERN (MongoDB, Express, React, Node) for these reasons:

| Aspect                    | Next.js (My Choice)                     | Traditional MERN                       |
| ------------------------- | --------------------------------------- | -------------------------------------- |
| **Server-Side Rendering** | Built-in SSR, SSG, ISR                  | Client-only, needs extra setup for SSR |
| **API Routes**            | Built-in, no need for separate server   | Needs separate Express backend         |
| **Routing**               | Based on files, automatic               | Manual React Router setup              |
| **Performance**           | Auto code-splitting, image optimization | Manual optimization needed             |
| **Deployment**            | One-click Vercel deployment             | Many services, more complex            |
| **SEO**                   | Excellent (SSR by default)              | Poor without extra setup               |

**Main benefit**: Next.js gives me a full-stack app in one codebase with API routes, so I don't need a separate Express server. This means less complexity, faster speed, and easier deployment.

### Q: What is your complete tech stack?

**Answer**:

| Layer              | Technology                | Why                                        |
| ------------------ | ------------------------- | ------------------------------------------ |
| **Framework**      | Next.js 16 (App Router)   | Full-stack, SSR, API routes                |
| **Frontend**       | React 19, TypeScript      | Type safety, modern features               |
| **Styling**        | Tailwind CSS 4, shadcn/ui | Fast development, same look everywhere     |
| **Animations**     | Framer Motion             | Smooth, fast animations                    |
| **Database**       | MongoDB (native driver)   | Flexible data structure, location queries  |
| **Authentication** | NextAuth v4               | Google OAuth + Credentials support         |
| **Payments**       | Razorpay + RazorpayX      | Indian payment system, escrow payouts      |
| **Maps**           | Google Maps APIs          | Location, address to coordinates, places   |
| **SMS OTP**        | Twilio                    | Dependable SMS sending                     |
| **Email**          | Nodemailer                | Email OTP backup option                    |
| **Image Upload**   | Cloudinary                | Fast image storage with CDN                |
| **Validation**     | Zod                       | Check data types while app runs            |
| **Forms**          | React Hook Form           | Fast form handling                         |
| **Deployment**     | Vercel                    | Serverless, edge functions, scheduled jobs |

### Q: Why MongoDB instead of SQL databases like MySQL/PostgreSQL?

**Answer**:

1. **Flexible data structure**: Laundry orders have different items - MongoDB handles this well
2. **Location queries**: Built-in `$geoWithin` and `2dsphere` indexes for finding providers by location
3. **Works like JSON**: Easy mapping between frontend objects and database records
4. **Grows easily**: Can handle more users by adding more servers
5. **Fast to build**: No need to set up tables during early development

### Q: Why native MongoDB driver instead of Mongoose?

**Answer**:

1. **Faster**: Native driver has less overhead than ORM
2. **More control**: Direct access to all MongoDB features
3. **Type safety**: Combined with TypeScript for type checking
4. **Transactions**: Full support for multi-document safe operations
5. **Learning**: I understand raw MongoDB operations, not hidden behind abstraction

### Q: Why TypeScript instead of JavaScript?

**Answer**:

1. **Finds errors early**: Catches mistakes when you write code, not when you run it
2. **Better code editor help**: Autocomplete, refactoring, error highlighting
3. **Code explains itself**: Types show what data looks like
4. **Easier to maintain**: Big codebases become easier to manage
5. **Industry need**: Required skill for professional jobs
6. **SDK types**: We create proper TypeScript interfaces for external SDKs like Razorpay (see `types/razorpay.d.ts`) to get full type safety even with third-party libraries

### Q: Why Razorpay instead of Stripe or PayPal?

**Answer**:

1. **Made for India**: Razorpay works best with Indian payment methods (UPI, cards, net banking)
2. **RazorpayX**: Built-in payout system to send money to provider bank accounts
3. **Lower fees**: Good prices for Indian payments
4. **Already follows rules**: Handles RBI and other Indian rules already
5. **Webhooks**: Sends reliable payment updates to our app

---

## 3. Architecture & Design Questions

### Q: Explain your application architecture

**Answer**: LaundryEase uses a **layered setup**:

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
├─────────────────────────────────────────────────────────┤
│              Next.js App Router (Frontend)               │
│         Server Components + Client Components            │
├─────────────────────────────────────────────────────────┤
│                  API Routes (Backend)                    │
│    /api/bookings, /api/orders, /api/payments, etc.      │
├─────────────────────────────────────────────────────────┤
│                  Business Logic Layer                    │
│      lib/db.ts, lib/razorpay.ts, lib/audit.ts           │
├─────────────────────────────────────────────────────────┤
│                     Data Layer                           │
│           MongoDB (Native Driver + Transactions)         │
├─────────────────────────────────────────────────────────┤
│                  External Services                       │
│    Razorpay, Twilio, Google Maps, Cloudinary            │
└─────────────────────────────────────────────────────────┘
```

### Q: What design patterns did you use?

**Answer**:

1. **Repository Pattern** (`lib/db.ts`): One place for all database work, keeping MongoDB code separate from business logic

2. **Factory Pattern** (`lib/api/errors.ts`): Error creation functions like `Errors.notFound()`, `Errors.validation()`

3. **Middleware Pattern** (`lib/api/auth.ts`): `requireAuth()`, `requireSeeker()`, `requireProvider()` to protect routes

4. **Observer Pattern** (Webhooks): Razorpay webhooks watch for payment events and update order status

5. **State Machine** (Booking/Order lifecycle): Clear state changes with checking

6. **Audit Trail Pattern** (`lib/audit.ts`): Save all changes in the background for record keeping

### Q: How do you handle separation of concerns?

**Answer**:

- **`app/`**: Pages and API routes (what users see and call)
- **`components/`**: Reusable UI parts
- **`lib/`**: Business logic, helpers, outside service connections
- **`types/`**: TypeScript type definitions
- **`cron/`**: Scheduled job logic (e.g. payouts)
- **`e2e/`**: End-to-end tests (Playwright)

Each part has one job and doesn't depend much on other parts.

### Q: Explain the App Router structure

**Answer**: Next.js App Router uses file-based routing with special rules:

```
app/
├── (auth)/              # Route group (URL: /verify-email, /verify-phone)
├── (dashboard)/         # Route group (URL: /admin, /provider, /seeker)
│   ├── admin/           # /admin/...
│   ├── provider/        # /provider/...
│   └── seeker/          # /seeker/...
├── api/                 # API routes (REST endpoints)
├── layout.tsx           # Root layout (shared across pages)
└── page.tsx             # Home page (/)
```

- **Route Groups** `()`: Organize files without changing URL
- **Dynamic Routes** `[id]`: URL parts that change like `/orders/[id]`
- **API Routes**: `route.ts` files that handle HTTP requests

---

## 3B. Code Location Questions ("Where is X written?")

### Q: Where is the MongoDB connection code?

**Answer**: `lib/mongodb.ts` - This file handles database connection:

```typescript
// lib/mongodb.ts
import { MongoClient } from "mongodb";
import { env } from "./env";
import { ensureDbIndexes } from "./db-indexes";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  var _mongoIndexInitPromise: Promise<void> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;

function createClientPromise(): Promise<MongoClient> {
  const client = new MongoClient(env.MONGODB_URI);
  if (process.env.NODE_ENV === "development") {
    // Reuse in dev to avoid too many connections
    if (!global._mongoClientPromise)
      global._mongoClientPromise = client.connect();
    return global._mongoClientPromise;
  }
  return client.connect();
}

export async function getDb() {
  if (!clientPromise) clientPromise = createClientPromise();
  const client = await clientPromise;
  const db = client.db(env.MONGODB_DB);

  if (!global._mongoIndexInitPromise) {
    global._mongoIndexInitPromise = ensureDbIndexes(db);
  }

  await global._mongoIndexInitPromise;
  return { db, client };
}
```

### Q: Where is the backend code written?

**Answer**: Backend code is in **two places**:

| Location   | What It Contains                                  | Example                        |
| ---------- | ------------------------------------------------- | ------------------------------ |
| `app/api/` | API routes (HTTP endpoints)                       | `app/api/bookings/route.ts`    |
| `lib/`     | Business logic, database operations, integrations | `lib/db.ts`, `lib/razorpay.ts` |

**API Routes** (`app/api/`) - Handle HTTP requests:

```text
app/api/
├── bookings/
│   ├── route.ts              → GET /api/bookings, POST /api/bookings
│   └── [id]/
│       ├── route.ts          → GET /api/bookings/:id
│       ├── accept/route.ts   → POST /api/bookings/:id/accept
│       └── cancel/route.ts   → POST /api/bookings/:id/cancel
├── orders/
├── payments/
└── webhooks/
```

**Business Logic** (`lib/`) - Shared functions:

```text
lib/
├── db.ts           → Database CRUD operations
├── razorpay.ts     → Payment integration
├── audit.ts        → Logging changes
├── otp.ts          → OTP generation/verification
├── google-maps.ts  → Location services
└── mongodb.ts      → Database connection
```

### Q: Where is the frontend code?

**Answer**: Frontend is in **three places**:

| Location         | What It Contains            | Example                           |
| ---------------- | --------------------------- | --------------------------------- |
| `app/`           | Pages (Server + Client)     | `app/(dashboard)/seeker/page.tsx` |
| `components/`    | Reusable UI components      | `components/booking-modal.tsx`    |
| `components/ui/` | Base UI components (shadcn) | `components/ui/button.tsx`        |

### Q: Where is authentication code?

**Answer**: Authentication is in multiple files:

| File                                  | Purpose                               |
| ------------------------------------- | ------------------------------------- |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth configuration (providers)    |
| `lib/api/auth.ts`                     | Auth helper functions (`requireAuth`) |
| `app/auth/page.tsx`                   | Login page UI                         |
| `app/choose-role/page.tsx`            | Role selection after OAuth            |

### Q: Where is payment/Razorpay code?

**Answer**:

| File                                   | Purpose                           |
| -------------------------------------- | --------------------------------- |
| `lib/razorpay.ts`                      | Razorpay SDK setup, create orders |
| `app/api/orders/[id]/payment/route.ts` | Payment initiation & verification |
| `app/api/webhooks/razorpay/route.ts`   | Handle Razorpay webhooks          |
| `components/orders/payment-button.tsx` | Payment button UI component       |
| `types/razorpay.d.ts`                  | TypeScript types for Razorpay SDK |

### Q: Where are the database models/schemas?

**Answer**: We use **native MongoDB driver** (no Mongoose), so types are in:

| File                  | What It Defines                     |
| --------------------- | ----------------------------------- |
| `types/bookings.ts`   | Booking interface and status enum   |
| `types/orders.ts`     | Order interface and status enum     |
| `types/complaints.ts` | Complaint interface and status enum |
| `types/provider.ts`   | Provider profile interface          |
| `types/enums.ts`      | Shared enums (Role, etc.)           |

**Example**:

```typescript
// types/bookings.ts
export type BookingStatus =
  | "requested"
  | "accepted"
  | "pickup_proposed"
  | "confirmed"
  | "invoice_created"
  | "completed"
  | "cancelled"
  | "rejected";

export interface PopulatedBooking {
  _id: ObjectId;
  seeker: { name: string; email: string; ... };
  provider: { businessName: string; ... };
  status: BookingStatus;
  // ...
}
```

### Q: Where is the cron job code?

**Answer**: Cron jobs are in **two places**:

| Location         | Purpose                                                        |
| ---------------- | -------------------------------------------------------------- |
| `app/api/cron/`  | API endpoints that cron calls                                  |
| `lib/payouts.ts` | Unified escrow release + payout orchestration logic            |
| `cron/`          | Script-style background helpers (no-show, auto-reject, legacy) |
| `vercel.json`    | Cron schedule configuration                                    |

**Example flow**:

```text
vercel.json → schedules "/api/cron/process-payouts" every 15 min
    ↓
app/api/cron/process-payouts/route.ts → verifies CRON_SECRET, calls logic
    ↓
lib/payouts.ts (processEligibleEscrowPayouts) → lock + complaint checks + escrow release + payout initiation
```

### Q: Where is environment variable validation?

**Answer**: `lib/env.ts` - Uses Zod to validate all env vars at startup:

```typescript
// lib/env.ts
import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1),
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  GOOGLE_ID: z.string().min(1),
  // ... all required variables
});

export const env = envSchema.parse(process.env);
// If any variable is missing, app crashes immediately with clear error
```

### Q: Where is error handling code?

**Answer**: Centralized in `lib/api/`:

| File                  | Purpose                                    |
| --------------------- | ------------------------------------------ |
| `lib/api/errors.ts`   | Custom `AppError` class & helper functions |
| `lib/api/response.ts` | Standard API response helpers              |

**Example**:

```typescript
// lib/api/errors.ts
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

// Usage in API route
throw Errors.notFound("Booking"); // 404
throw Errors.unauthorized(); // 401
throw Errors.validation("Bad input"); // 400
```

### Q: Quick Reference - "Where is X?"

| Feature                | File Location                          |
| ---------------------- | -------------------------------------- |
| MongoDB connection     | `lib/mongodb.ts`                       |
| Database operations    | `lib/db.ts`                            |
| API routes             | `app/api/**/*.ts`                      |
| Frontend pages         | `app/(dashboard)/**/*.tsx`             |
| UI components          | `components/**/*.tsx`                  |
| Authentication config  | `app/api/auth/[...nextauth]/route.ts`  |
| Auth helpers           | `lib/api/auth.ts`                      |
| Payment integration    | `lib/razorpay.ts`                      |
| Payment API            | `app/api/orders/[id]/payment/route.ts` |
| DB index bootstrap     | `lib/db-indexes.ts`                    |
| Webhooks               | `app/api/webhooks/razorpay/route.ts`   |
| OTP logic              | `lib/otp.ts`                           |
| Location/Maps          | `lib/google-maps.ts`                   |
| Distance calculation   | `lib/distance.ts`                      |
| Type definitions       | `types/*.ts`                           |
| Environment validation | `lib/env.ts`                           |
| Error handling         | `lib/api/errors.ts`                    |
| Escrow payout engine   | `lib/payouts.ts`                       |
| Cron job logic         | `cron/*.ts`                            |
| Cron API endpoints     | `app/api/cron/*.ts`                    |
| Audit logging          | `lib/audit.ts`                         |
| Cloudinary upload      | `lib/cloudinary.ts`                    |

---

## 4. Database Questions

### Q: What collections do you have?

**Answer**: Key MongoDB collections:

| Collection       | Purpose                                             |
| ---------------- | --------------------------------------------------- |
| `seekers`        | User profiles for service seekers                   |
| `providers`      | Provider profiles with location, services, capacity |
| `admins`         | Admin user accounts                                 |
| `bookings`       | Request and negotiation records                     |
| `orders`         | Final orders with payment info                      |
| `complaints`     | Problem records with chat messages                  |
| `reviews`        | Provider ratings and feedback                       |
| `payments`       | Payment records                                     |
| `refunds`        | Refund records from Razorpay                        |
| `audit_logs`     | Full history of all changes                         |
| `webhook_events` | Incoming webhook records                            |

### Q: How do you handle database connections?

**Answer**: Connection pooling with one shared connection:

```typescript
// lib/mongodb.ts
import { ensureDbIndexes } from "./db-indexes";

let clientPromise: Promise<MongoClient> | undefined;

export async function getDb() {
  if (!clientPromise) clientPromise = createClientPromise();
  const client = await clientPromise;
  const db = client.db(env.MONGODB_DB);

  // One-time startup index initialization
  if (!global._mongoIndexInitPromise) {
    global._mongoIndexInitPromise = ensureDbIndexes(db);
  }
  await global._mongoIndexInitPromise;

  return { db, client };
}
```

This stops too many connections from being created when the app reloads during development.

### Q: How do you handle geospatial queries?

**Answer**: MongoDB's `2dsphere` index with `$geoWithin`:

```typescript
// Find providers who serve the seeker's location
const providers = await db.collection("providers").find({
  coordinates: {
    $geoWithin: {
      $centerSphere: [
        [seekerLng, seekerLat],
        radius_km / 6378.1, // Convert km to radians
      ],
    },
  },
});
```

Providers save their `coordinates` and `radius_km`. The query finds all providers whose service area includes the seeker's location.

### Q: Do you use database transactions?

**Answer**: Yes, for important operations like creating bookings:

```typescript
// Check capacity AND create booking at the same time (safely)
await session.withTransaction(async () => { {
  const activeCount = await db.collection("bookings").countDocuments(
    { provider_id, status: { $in: ["requested", "accepted", ...] } },
    { session }
  );

  if (activeCount >= provider.capacity) {
    throw new Error("CAPACITY_EXCEEDED");
  }

  await db.collection("bookings").insertOne(booking, { session });
});
```

This stops race conditions where many bookings could go past the provider's limit at the same time.

---

## 5. Authentication & Security Questions

### Q: How does authentication work?

**Answer**: NextAuth v4 with two ways to sign in:

1. **Google OAuth**: Sign in with Google accounts
2. **Credentials**: Email/password with bcrypt password hashing

```typescript
// How it works
User clicks "Sign in with Google"
  → Google OAuth runs
  → Check if user is in database
  → If new user: go to /choose-role
  → If existing user: create JWT session (login token)
```

### Q: How do you protect routes?

**Answer**: Server-side check functions:

```typescript
// lib/api/auth.ts
export async function requireSeeker(): Promise<AuthResult> {
  return requireAuth([Role.SEEKER]);
}

// Usage in API route
export const POST = withErrorHandling(async (req: Request) => {
  const session = await requireSeeker(); // Throws error if not a seeker
  // ... route logic
});
```

### Q: How do you handle password security?

**Answer**:

- **Bcrypt hashing**: Passwords are scrambled with bcrypt (10 rounds)
- **No plain text storage**: Only the hash is saved
- **Safe comparison**: Uses timing-safe check to prevent attacks
- **Password confirmation**: Users must type password twice during signup
- **Strength requirements**: Enforced client-side and server-side:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one number
  - At least one special character
- **Real-time validation**: Users see password strength indicators as they type

```typescript
const isValid = await bcrypt.compare(password, user.passwordHash);
```

### Q: How do you prevent common security problems?

**Answer**:

| Problem             | How We Prevent It                                                                 |
| ------------------- | --------------------------------------------------------------------------------- |
| **SQL Injection**   | Not possible (MongoDB), but we clean all inputs                                   |
| **XSS**             | React escapes output by default                                                   |
| **CSRF-like abuse** | Same-origin guard (`requireSameOrigin` + `proxy.ts` checks) on unsafe API methods |
| **CSP hardening**   | Report-Only CSP headers + `/api/security/csp-report` telemetry endpoint           |
| **Timing Attacks**  | `crypto.timingSafeEqual()` for checking signatures                                |
| **Fake Webhooks**   | HMAC signature check                                                              |
| **Wrong Access**    | Role checks on every protected route                                              |

### Q: How do you check webhook signatures?

**Answer**:

```typescript
// Safe time-equal comparison prevents timing attacks
if (!/^[a-f0-9]{64}$/i.test(webhookSignature)) {
  return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
}

const expectedSignature = crypto
  .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
  .update(webhookBody)
  .digest("hex");

if (
  !crypto.timingSafeEqual(
    Buffer.from(webhookSignature, "hex"),
    Buffer.from(expectedSignature, "hex"),
  )
) {
  return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
}
```

---

## 6. Payment & Escrow Questions

### Q: Explain the escrow system

**Answer**: The escrow system makes sure payments are safe:

```
1. Seeker pays for order
   ↓
2. Payment is captured and stored as payment_status: "paid"
   ↓
3. Provider finishes work and delivers
   ↓
4. Seeker confirms with OTP
   → payment_status: "held"
   → escrow_started_at + escrow_release_at are set
   ↓
5. 24-hour waiting period
   ↓
6. If no complaint and timer elapsed:
   unified payout processor releases escrow and initiates RazorpayX payout
   ─ OR ─
   If complaint raised: Escrow frozen until admin decides
```

### Q: What is RazorpayX?

**Answer**: RazorpayX is Razorpay's service for sending money to bank accounts. I use it to:

1. Create a "Contact" (provider's info)
2. Create a "Fund Account" (provider's bank details)
3. Send automatic payouts when escrow releases

### Q: How do you prevent double payouts?

**Answer**: Many safety checks:

```typescript
// 1. Already paid out? stop
if (order.payout_id) {
  return { status: "already_paid_out" };
}

// 2. Acquire payout lock (or fail fast if another worker holds it)
const lock = await db.collection("orders").updateOne(
  {
    _id: order._id,
    payout_id: { $exists: false },
    $or: [
      { payout_lock_at: { $exists: false } },
      { payout_lock_at: { $lt: staleCutoff } },
    ],
  },
  { $set: { payout_lock_at: now, payout_status: "processing" } },
);
if (lock.modifiedCount === 0) return { status: "already_processing" };

// 3. Final write still requires payout_id not set
await db
  .collection("orders")
  .updateOne(
    { _id: order._id, payout_id: { $exists: false } },
    { $set: { payout_id: payout.id, payout_status: "processing" } },
  );

// 4. Razorpay reference_id protects against accidental duplicates too
await createRazorpayPayout({
  reference_id: order._id.toString(),
});
```

### Q: What happens if a payment fails?

**Answer**:

1. Webhook gets `payment.failed` event
2. Payment status is updated in database
3. User can retry payment from their dashboard
4. No double payouts; each payment try is checked by signature and matched via webhooks

### Q: How does the split settlement math work? (Advanced)

**Answer**: We use a strict "Commission First" logic:

```typescript
// 1. Calculate Distributable Amount
// Total - Platform Commission (5%) = Distributable
const total = 500;
const commission = 25; // 5%
const distributable = 475;

// 2. Apply Refunds (if any)
// If admin refunds 100 to seeker:
const seekerRefund = 100;
const providerPayout = distributable - seekerRefund; // 375

// Result:
// Platform keeps: 25 (Commission is protected)
// Seeker gets: 100
// Provider gets: 375
```

### Q: What if the cron job fails?

**Answer**: The system is designed to be **self-healing**:

1. **Idempotency**: All payout functions check `payout_id` before running. Running the same job twice does nothing safe.
2. **Next Run**: The cron runs every hour. If it fails or times out, the next run will pick up any pending "held" orders that have passed their 24h window.
3. **Manual Trigger**: Admins can manually trigger `POST /api/cron/process-payouts` if needed.

### Q: Why is commission deducted even on rejected complaints?

**Answer**: The platform fee covers the service of hosting the booking, processing the payment, and handling the dispute. Even if a complaint is invalid, the platform provided its infrastructure. The provider receives the full _distributable_ amount, which is the fair share agreed upon by using the platform.

### Q: How does the complaint affect escrow?

**Answer**:

- **Complaint raised** → Escrow timer stops right away
- **Admin accepts** → Case enters `accepted` with a response deadline (Admin + Seeker chat)
- **Admin adds provider** → Case moves to `in_review` and becomes 3-way chat
- **Result**:
  - `release_payout`: Pay provider full distributable amount
  - `refund_partial`: Slider-based split between seeker and provider (commission already retained)
  - `refund_full`: Full distributable amount to seeker (provider gets 0)
  - `reject`: Invalid complaint, pay provider (minus standard commission). Case is hidden from ongoing lists.

### Q: Walk me through the complete payment flow (step by step)

**Answer**: Here's the complete payment integration:

```text
1. INVOICE APPROVAL
   Seeker clicks "Approve & Pay" on invoice
   ↓
2. CREATE RAZORPAY ORDER (Backend)
   POST /api/orders/{id}/payment
   → Backend creates Razorpay order with amount
   → Returns: order_id, key, amount, currency
   → Legacy aliases still supported: /api/orders/{id}/pay and /api/orders/{id}/payment/init
   ↓
3. OPEN RAZORPAY CHECKOUT (Frontend)
   const rzp = new window.Razorpay(options);
   rzp.open();
   → User sees Razorpay payment popup
   → User pays via UPI/Card/Net Banking
   ↓
4. PAYMENT SUCCESS CALLBACK (Frontend)
   handler: async (response) => {
     // response has: razorpay_order_id, razorpay_payment_id, razorpay_signature
   }
   ↓
5. VERIFY SIGNATURE (Backend)
   PUT /api/orders/{id}/payment
   → Backend verifies HMAC signature
   → Legacy alias still supported: POST /api/orders/{id}/payment/verify
   → generated_signature = HMAC_SHA256(order_id + "|" + payment_id, secret)
   → Compare with razorpay_signature
   ↓
6. UPDATE DATABASE
   → payment_status: "paid"
   → Save razorpay_payment_id
   ↓
7. DELIVERY CONFIRMATION (OTP)
   POST /api/orders/{id}/confirm-delivery OR /api/orders/{id}/otp/verify
   → payment_status moves to "held"
   → escrow_started_at + escrow_release_at set
   ↓
8. WEBHOOK BACKUP (Async)
   Razorpay sends webhook to /api/webhooks/razorpay
   → Verify webhook signature
   → Deduplicate by event_id in webhook_events
   → Reconcile orders/bookings/payments/refunds idempotently
```

**Code example (Frontend - invoice-review-form.tsx)**:

```typescript
const options: RazorpayOptions = {
  key: payData.key,
  amount: payData.amount,
  currency: payData.currency,
  name: "LaundryEase",
  description: `Payment for Order #${orderId}`,
  order_id: payData.id,
  handler: async function (response: RazorpayResponse) {
    // Verify payment on backend
    const verifyRes = await fetch(`/api/orders/${orderId}/payment`, {
      method: "PUT",
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      }),
    });
  },
};
const rzp = new window.Razorpay(options);
rzp.open();
```

### Q: How do you verify payment signature is genuine?

**Answer**: HMAC-SHA256 signature verification:

```typescript
// Backend verification (lib/razorpay.ts)
import crypto from "crypto";

function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;

  const body = orderId + "|" + paymentId;
  const expectedSignature = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSignature, "hex"),
  );
}
```

**Why this works**:

- Only Razorpay knows the secret key
- If signature matches, payment is genuine
- `timingSafeEqual` prevents timing attacks

### Q: What are webhooks and why do you need them?

**Answer**: Webhooks are HTTP callbacks Razorpay sends when events happen:

| Event                                     | When It Fires               | What We Do                               |
| ----------------------------------------- | --------------------------- | ---------------------------------------- |
| `payment.authorized` / `payment.captured` | Payment authorized/captured | Reconcile payment + order/booking status |
| `payment.failed`                          | Payment failed              | Update error state, allow retry          |
| `refund.created`                          | Refund initiated            | Reconcile refund + order/booking status  |
| `payout.processed`                        | Provider payout completed   | Mark payout as done                      |

**Why webhooks are needed**:

1. User might close browser after payment
2. Network might fail during callback
3. Webhooks are the "source of truth" from Razorpay
4. Webhooks can retry if our server is down

---

## 6B. Location Tracking Questions

### Q: How do you track user location?

**Answer**: We use **Google Maps APIs** for location features:

| API                 | Purpose                                     |
| ------------------- | ------------------------------------------- |
| **Places API**      | Address autocomplete when user types        |
| **Geocoding API**   | Convert address text → latitude/longitude   |
| **Maps JavaScript** | Display interactive map on provider profile |

**Flow when seeker searches**:

```text
1. Seeker types address in search box
   ↓
2. Places Autocomplete shows suggestions
   → Uses Google Places API
   ↓
3. Seeker selects an address
   ↓
4. Geocoding API converts to coordinates
   → "123 Main St, Mumbai" → { lat: 19.076, lng: 72.877 }
   ↓
5. Store coordinates in seeker profile
   → db.seekers.updateOne({ coordinates: { lat, lng } })
   ↓
6. Search for providers
   → MongoDB geospatial query finds matching providers
```

### Q: How does provider location matching work?

**Answer**: Providers set a **service radius** (e.g., 5 km). We use MongoDB's geospatial queries:

```typescript
// lib/google-maps.ts + MongoDB query
const providers = await db.collection("providers").find({
  isApproved: true,
  coordinates: {
    $geoWithin: {
      $centerSphere: [
        [seekerLng, seekerLat], // Seeker's location
        radiusInKm / 6378.1, // Convert km to radians (Earth radius)
      ],
    },
  },
});
```

**Visual explanation**:

```text
Provider sets: coordinates = [72.87, 19.07], radius = 5km

                    5km radius
                   ╭─────────╮
                  ╱           ╲
                 │  Provider   │
                 │     ⦿       │  ← Provider's location
                 │   Seeker ✓  │  ← Seeker inside radius (MATCH!)
                  ╲           ╱
                   ╰─────────╯

Seeker outside radius → NOT shown in results
```

### Q: How do you calculate delivery charges based on distance?

**Answer**: Using the **Haversine formula** (calculates distance on a sphere):

```typescript
// lib/distance.ts
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

// Usage for delivery charges
const distance = calculateDistance(
  providerLat,
  providerLng,
  seekerLat,
  seekerLng,
);
const freeRadius = provider.freeDeliveryRadius; // e.g., 2km
const extraDistance = Math.max(0, distance - freeRadius);
const deliveryCharge = extraDistance * provider.perKmCharge; // e.g., ₹10/km
```

### Q: What is a 2dsphere index and why do you use it?

**Answer**: It's a MongoDB index optimized for **spherical geometry** (Earth is a sphere):

```typescript
// lib/setup-geospatial-index.ts
await db
  .collection("providers")
  .createIndex(
    { coordinates: "2dsphere" },
    { name: "provider_location_2dsphere" },
  );
```

**Why we need it**:

- Without index: MongoDB scans ALL providers (slow)
- With 2dsphere index: MongoDB quickly finds nearby providers
- Handles Earth's curvature correctly (not flat geometry)

**Performance difference**:

- Without index: 500ms for 10,000 providers
- With index: 5ms for 10,000 providers

---

## 7. Core Features Questions

### Q: Explain the booking lifecycle

**Answer**:

```
requested → accepted → pickup_proposed → confirmed → invoice_created
    ↓           ↓             ↓              ↓
 rejected    cancelled   reschedule    converted to Order
```

**What each state means**:

- `requested`: Seeker asked for a booking
- `accepted`: Provider said yes
- `pickup_proposed`: Provider suggested a pickup time
- `confirmed`: Both agreed on time
- `invoice_created`: Provider made invoice after pickup
- `reschedule_requested`: Someone wants a new time

**Invoice Review Flow**:

- Seeker can view invoice details (items, photos, pricing)
- Seeker can approve invoice and pay → Order created
- Seeker can reject invoice with reason → Items returned to provider
- Past invoices viewable in read-only mode from payment history

### Q: Explain the order lifecycle

**Answer**:

```
invoiced → processing → washing → ironing → ready → out_for_delivery → delivered
```

After `delivered`:

- OTP confirmed → Escrow starts 24-hour timer
- No complaint → Money goes to provider
- Complaint → Freeze and admin looks at it

### Q: How does provider capacity work?

**Answer**: Providers set a `capacity` (max jobs at once). Before accepting:

```typescript
const activeJobs =
  bookings.count({ status: active }) + orders.count({ status: active });
if (activeJobs >= provider.capacity) {
  throw new Error("CAPACITY_EXCEEDED");
}
```

This is checked in a transaction so many requests can't break the limit at the same time.

### Q: How does location-based discovery work?

**Answer**:

1. Seeker types their address
2. Google Geocoding API changes it to coordinates
3. MongoDB query finds providers whose `radius_km` covers that point
4. Results sorted by distance using Haversine formula (Earth distance math)
5. Delivery charges based on distance beyond the free radius

### Q: How does the complaint system work?

**Answer**:

```
Seeker raises complaint (status: "open")
    ↓
Admin reviews and accepts (status: "accepted", deadline set)
    ↓
Admin adds provider to chat (status: "in_review")
    ↓
3-way chat to solve the problem
    ↓
Admin decides with payout/refund split (status: "resolved" or "rejected")
    ↓
Escrow action done (release, partial split, or seeker full distributable award)
```

Note: The 24-hour complaint window is enforced in `POST /api/complaints` using delivery timestamps (`otp_confirmed_at` / `escrow_started_at`).

Operational detail from current code:

- Seeker/provider complaint menus show only ongoing cases (`open`, `accepted`, `in_review`).
- Provider sees complaint navigation only after admin grants provider access.
- After `resolved`/`rejected`, seeker/provider chat input is locked and the thread is archived in UI.

---

## 8. API & Backend Questions

### Q: How are your API routes organized?

**Answer**: Organized by feature:

```
app/api/
├── admin/          # Admin-only endpoints (complaints, users)
├── auth/           # NextAuth handlers
├── bookings/       # Booking operations (create, chat, status)
├── complaints/     # Dispute resolution logic
├── cron/           # Scheduled jobs (payouts, auto-reject)
├── escrow/         # Manual escrow actions
├── invoices/       # Invoice generation and management
├── orders/         # Order lifecycle and payment status
├── otp/            # SMS OTP generation/verification
├── payments/       # Razorpay integration
├── profile/        # User profile management
├── providers/      # Provider search and listing
├── reviews/        # Rating and review submission
├── security/       # Security checks (CSP violations)
└── webhooks/       # Razorpay payment events
```

### Q: How do you handle API errors?

**Answer**: One place for error handling with custom `AppError` class:

```typescript
// lib/api/errors.ts
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly statusCode: number,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

// Helper functions
Errors.notFound("Booking"); // 404
Errors.unauthorized(); // 401
Errors.validation("Invalid data"); // 400
Errors.conflict("Already exists"); // 409
```

### Q: How do you check request data?

**Answer**: Zod schemas to check data while the app runs:

```typescript
// lib/api/schemas.ts
export const createBookingSchema = z.object({
  provider_id: z.string().min(1),
  deadline: z.string().datetime().optional(),
  seeker_coordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
});

// How to use in route
const result = createBookingSchema.safeParse(body);
if (!result.success) {
  throw Errors.validation("Invalid data", result.error.flatten());
}
```

### Q: How do cron jobs work?

**Answer**: Vercel Cron Jobs call API endpoints on a schedule:

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/auto-reject-bookings", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/no-show", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/process-payouts", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/monitor-abuse", "schedule": "0 2 * * *" }
  ]
}
```

**Security**: Each cron endpoint needs `Authorization: Bearer ${CRON_SECRET}` header.

**Jobs**:

- `auto-reject-bookings`: Cancel pending requests after timeout
- `process-payouts`: Run unified escrow release + payout orchestration
- `no-show`: Handle when provider doesn't show up
- `monitor-abuse`: Find suspicious activity (runs at 2 AM)
- `release-payouts`: Protected compatibility endpoint (manual/legacy trigger path; same payout engine)

---

## 9. Frontend & UI Questions

### Q: What UI framework do you use?

**Answer**: **shadcn/ui** with Tailwind CSS:

- Not a library you install with npm
- Pre-built parts you copy into your code
- You can change everything
- Built on Radix UI (accessible for all users)
- Styled with Tailwind CSS

### Q: How do you handle dark mode?

**Answer**: `next-themes` package with Tailwind:

```tsx
// ThemeProvider wraps the app
<ThemeProvider attribute="class" defaultTheme="system">
  {children}
</ThemeProvider>;

// Toggle component
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} />
  );
}
```

Tailwind's `dark:` prefix handles dark mode styling.

### Q: How do you handle forms?

**Answer**: React Hook Form + Zod:

```tsx
const form = useForm<FormData>({
  resolver: zodResolver(schema),
  defaultValues: { ... }
});

<form onSubmit={form.handleSubmit(onSubmit)}>
  <Input {...form.register("email")} />
  {form.formState.errors.email && <Error />}
</form>
```

Benefits: Less screen redraws, built-in checking, works with TypeScript.

**Client-side validation features**:

- Real-time email format validation with error display on blur
- Password strength indicators (shows 4 requirements with green checkmarks)
- Password confirmation matching (shows match status as user types)
- Inline error messages for invalid inputs

### Q: How do you handle animations?

**Answer**: Framer Motion for smooth movements:

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  Content
</motion.div>
```

### Q: How do you handle loading states?

**Answer**:

- **Page-level**: `loading.tsx` files (shows loading while page loads)
- **Part-level**: `useState` with skeleton loaders
- **Button-level**: Disabled button with spinner icon

---

## 10. Deployment & DevOps Questions

### Q: Where is the app deployed?

**Answer**: **Vercel** - best for Next.js:

- No setup needed to deploy
- Automatic SSL (https)
- Edge functions
- Preview links for pull requests
- Built-in stats
- Cron job support

### Q: How does the deployment pipeline work?

**Answer**:

1. Push code to GitHub
2. Vercel sees the changes
3. Builds the Next.js app
4. Deploys to serverless functions
5. CDN stores static files
6. Preview link for branches, production for main

### Q: How do you manage environment variables?

**Answer**:

- **Development**: `.env.local` file (not saved in git)
- **Production**: Vercel Environment Variables page
- **Checking**: Zod schema checks all vars when app starts

```typescript
// lib/env.ts
const envSchema = z.object({
  GOOGLE_ID: z.string().min(1),
  MONGODB_URI: z.string().min(1),
  // ... all required vars
});

export const env = envSchema.parse(process.env);
```

App stops right away if any needed variable is missing.

### Q: How do you handle logs?

**Answer**: Organized logging with custom logger:

```typescript
// lib/logger.ts
logger.info("ORDERS", "Order created", { orderId, amount });
logger.error("WEBHOOK", "Signature invalid", error, { paymentId });
```

Logs include: time, category, message, extra data.

---

## 11. Testing & Quality Questions

### Q: How do you ensure code quality?

**Answer**:

1. **TypeScript**: Checks types when building
2. **ESLint**: Makes sure code style is consistent
3. **Zod checking**: Checks data while app runs
4. **Error boundaries**: Handles errors nicely without crashing
5. **Automated tests**: Vitest suite now covers critical payment, complaint, escrow, webhook-adjacent, and security paths

Current quality snapshot (2026-02-08):

- `17` test files
- `75` tests passing
- `npm test`, `npm run lint`, and `npm run build` all passing

### Q: How do you handle errors in production?

**Answer**:

- **API Routes**: Many routes use `withErrorHandling`; others use `try/catch` with `NextResponse`
- **Frontend**: Error boundaries + toast messages
- **Global**: `global-error.tsx` for any uncaught errors
- **Logging**: All errors saved with context info for debugging

---

## 12. Challenges & Solutions

### Q: What was the biggest technical challenge?

**Answer**: **Stopping race conditions in bookings**

**Problem**: Many seekers could book the same provider at the same time, going past the limit.

**Fix**: MongoDB transactions that check capacity at the same time:

```typescript
await session.withTransaction(async () => {
  const count = await db.collection("bookings").countDocuments(
    { provider_id, status: { $in: activeStatuses } },
    { session }, // Same database transaction
  );

  if (count >= capacity) throw new Error("CAPACITY_EXCEEDED");

  await db.collection("bookings").insertOne(booking, { session });
});
```

### Q: How do you handle idempotency in payments?

**Answer**:

1. Check if the action was already done before doing it
2. Use updates that only work if conditions are met
3. Razorpay's `reference_id` says no to duplicate payouts
4. Webhooks can come many times and still work correctly

### Q: How do you handle offline/slow networks?

**Answer**:

- Update UI right away, then undo if it fails
- Show loading spinners during API calls
- Toast messages to show success or failure
- Try again logic for failed requests

---

## 13. Future Scope

### Q: What features would you add next?

**Answer**:

1. **Real-time updates**: WebSocket/SSE for instant messages
2. **Mobile app**: React Native for Android/iOS
3. **Provider dashboard**: Earnings view, order charts
4. **Monthly plans**: Unlimited laundry subscriptions
5. **More languages**: Hindi, regional languages
6. **Pickup calendar**: Visual time slot picker
7. **Rewards program**: Points and discounts for regular users

### Q: How would you scale this for 10x users?

**Answer**:

1. **Database**: MongoDB Atlas with data splitting, read copies
2. **Caching**: Redis for data that gets read often
3. **CDN**: Cloudflare/Vercel Edge for static files
4. **Queue**: Background job queue for heavy tasks
5. **Microservices**: Split payment/notification into separate services

---

## 14. Quick Technical Terms Glossary

| Term            | What It Means                                                            |
| --------------- | ------------------------------------------------------------------------ |
| **SSR**         | Server-Side Rendering - pages built on server                            |
| **SSG**         | Static Site Generation - pages made at build time                        |
| **ISR**         | Incremental Static Regeneration - static pages refreshed when needed     |
| **JWT**         | JSON Web Token - login token without storing session                     |
| **Escrow**      | Third party holds money until both sides agree                           |
| **Webhook**     | HTTP call when something happens                                         |
| **ACID**        | Atomicity, Consistency, Isolation, Durability (safe database operations) |
| **OTP**         | One-Time Password - code you can only use once                           |
| **HMAC**        | Hash-based Message Authentication Code - signature to verify sender      |
| **Idempotency** | Same action gives same result, even if done many times                   |
| **Geospatial**  | Data based on map coordinates                                            |
| **Haversine**   | Math formula to find distance between two map points                     |

---

## Known Gaps vs PRD (Be Honest)

Use these points if you are asked about differences between the PRD and what is built now:

- **Historical data cleanup**: New unique indexes enforce integrity, but old duplicate data can still block index creation until cleaned.
- **Automated integration testing**: Webhook replay and payment idempotency races need stronger integration test coverage.
- **Observability depth**: We need dedicated dashboards/alerts for webhook failures and index-init issues.
- **Webhook payload retention**: Archive policy for old `webhook_events` payloads is still a backlog item.
- **CSP rollout**: CSP is currently in Report-Only mode; enforcement requires violation cleanup.
- **Password-recovery abuse hardening**: Forgot-password flow needs dedicated anti-abuse strategy (rate-limit/captcha policy).
- **PRD future scope**: Complaint window extension requests and split-settlement reconciliation tooling remain future work.

## Key Features Implemented Recently

- **Canonical payment routing**: Unified around `/api/orders/:id/payment` and `/api/bookings/:id/pay` with backward-compatible aliases.
- **Order creation guardrails**: Direct `/api/orders` creation path is disabled; order creation is tied to invoice approval/payment flow.
- **Webhook resilience**: Razorpay webhook handling now has replay-safe idempotency, retry handling, and domain reconciliation.
- **Payment verification coverage**: Added deep route tests for canonical and legacy payment verification paths (including idempotency and signature validation).
- **Security policy telemetry**: Added Report-Only CSP header pipeline with violation capture endpoint (`/api/security/csp-report`).
- **DB index bootstrap**: Startup index initialization now enforces critical uniqueness and TTL cleanup invariants.
- **Complaint-window enforcement**: 24-hour complaint timing is now validated in API logic.
- **Complaint split settlement**: Admin complaint resolution now supports commission-aware partial splits (`refund_partial`) with slider-based seeker/provider allocation.

## Quick Presentation Tips

1. **Start with the problem**: "Local laundry services have trust and payment issues"
2. **Show how it works**: Live demo of booking → payment → delivery flow
3. **Show what's special**: Escrow system, 3-way chat for problems, location matching
4. **Talk with confidence about tech choices**: Use the comparison tables above
5. **Mention production quality**: Audit logs, no double payments, error handling

**Good luck with your presentation! 🚀**
