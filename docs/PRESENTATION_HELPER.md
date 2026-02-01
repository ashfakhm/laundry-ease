# LaundryEase — Presentation Q&A Helper

> **Purpose**: This document prepares you to answer every question HODs and teachers might ask about your project. Read it thoroughly before your mock presentation.

---

## Table of Contents

1. [Project Overview Questions](#1-project-overview-questions)
2. [Technology Stack Questions](#2-technology-stack-questions)
3. [Architecture & Design Questions](#3-architecture--design-questions)
4. [Database Questions](#4-database-questions)
5. [Authentication & Security Questions](#5-authentication--security-questions)
6. [Payment & Escrow Questions](#6-payment--escrow-questions)
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

**Answer**: LaundryEase is a full-stack web platform that connects laundry service seekers with independent laundry providers. It transforms informal laundry transactions into verifiable contracts with escrow-based payments, ensuring both parties are protected.

### Q: What problem does it solve?

**Answer**: It solves three key problems:

1. **Payment uncertainty for providers**: Providers never wonder if they'll get paid after completing work
2. **Status ambiguity for seekers**: Seekers see their order as a clear timeline of states, not confusing chat threads
3. **Trust issues**: The escrow system ensures money is held safely until service is completed and verified via OTP

### Q: Who are the target users?

**Answer**: Three user roles:

- **Seekers**: Individuals who need laundry services
- **Providers**: Independent laundry operators or small businesses
- **Admins**: Platform operators who handle disputes and manage the system

### Q: What makes this project unique compared to existing solutions?

**Answer**:

1. **Escrow-based payment**: Unlike informal arrangements, funds are locked until OTP-verified delivery
2. **Geospatial matching**: Only providers who cover the seeker's exact location are shown
3. **Structured complaint system**: 3-way chat between Admin, Seeker, and Provider for fair dispute resolution
4. **Complete audit trail**: Every state transition is logged for transparency and accountability

---

## 2. Technology Stack Questions

### Q: Why did you choose Next.js over MERN stack?

**Answer**: I chose Next.js App Router over traditional MERN (MongoDB, Express, React, Node) for several reasons:

| Aspect                    | Next.js (My Choice)                          | Traditional MERN                     |
| ------------------------- | -------------------------------------------- | ------------------------------------ |
| **Server-Side Rendering** | Built-in SSR, SSG, ISR                       | CSR only, needs custom setup for SSR |
| **API Routes**            | Built-in, no separate Express server         | Requires separate Express backend    |
| **Routing**               | File-based, automatic                        | Manual React Router setup            |
| **Performance**           | Automatic code-splitting, image optimization | Manual optimization needed           |
| **Deployment**            | One-click Vercel deployment                  | Multi-service deployment complexity  |
| **SEO**                   | Excellent (SSR by default)                   | Poor without additional setup        |

**Key advantage**: Next.js gives me a full-stack application in a single codebase with API routes, eliminating the need for a separate Express server. This reduces complexity, latency, and deployment overhead.

### Q: What is your complete tech stack?

**Answer**:

| Layer              | Technology                | Why                                    |
| ------------------ | ------------------------- | -------------------------------------- |
| **Framework**      | Next.js 16 (App Router)   | Full-stack, SSR, API routes            |
| **Frontend**       | React 19, TypeScript      | Type safety, modern hooks              |
| **Styling**        | Tailwind CSS 4, shadcn/ui | Rapid development, consistent design   |
| **Animations**     | Framer Motion             | Smooth, performant animations          |
| **Database**       | MongoDB (native driver)   | Flexible schema, geospatial queries    |
| **Authentication** | NextAuth v4               | Google OAuth + Credentials support     |
| **Payments**       | Razorpay + RazorpayX      | Indian payment gateway, escrow payouts |
| **Maps**           | Google Maps APIs          | Location, geocoding, places            |
| **SMS OTP**        | Twilio                    | Reliable SMS delivery                  |
| **Email**          | Nodemailer                | Email OTP fallback                     |
| **Image Upload**   | Cloudinary                | CDN-backed image storage               |
| **Validation**     | Zod                       | Runtime type validation                |
| **Forms**          | React Hook Form           | Performant form handling               |
| **Deployment**     | Vercel                    | Serverless, edge functions, cron jobs  |

### Q: Why MongoDB instead of SQL databases like MySQL/PostgreSQL?

**Answer**:

1. **Flexible schema**: Laundry orders have varying items - MongoDB handles dynamic structures naturally
2. **Geospatial queries**: Built-in `$geoWithin` and `2dsphere` indexes for location-based provider discovery
3. **JSON-native**: Direct mapping between frontend objects and database documents
4. **Scalability**: Horizontal scaling for high-traffic scenarios
5. **Developer velocity**: No migrations needed during rapid development

### Q: Why native MongoDB driver instead of Mongoose?

**Answer**:

1. **Performance**: Native driver is faster without ORM overhead
2. **Control**: Direct access to MongoDB's full feature set
3. **Type safety**: Combined with TypeScript interfaces for type checking
4. **Transactions**: Full support for multi-document ACID transactions
5. **Learning**: Understanding raw MongoDB operations, not abstracted away

### Q: Why TypeScript instead of JavaScript?

**Answer**:

1. **Type safety**: Catches errors at compile-time, not runtime
2. **Better IDE support**: Autocomplete, refactoring, error highlighting
3. **Self-documenting code**: Types serve as documentation
4. **Easier maintenance**: Large codebases become manageable
5. **Industry standard**: Required skill for professional development

### Q: Why Razorpay instead of Stripe or PayPal?

**Answer**:

1. **Indian market focus**: Razorpay is optimized for Indian payment methods (UPI, cards, netbanking)
2. **RazorpayX**: Built-in payout system for escrow fund release to providers
3. **Lower fees**: Competitive pricing for Indian transactions
4. **Compliance**: Already handles RBI/regulatory requirements
5. **Webhooks**: Reliable webhook delivery for payment confirmation

---

## 3. Architecture & Design Questions

### Q: Explain your application architecture

**Answer**: LaundryEase follows a **layered architecture**:

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

1. **Repository Pattern** (`lib/db.ts`): Centralized database operations, abstracting MongoDB from business logic

2. **Factory Pattern** (`lib/api/errors.ts`): Error factory functions like `Errors.notFound()`, `Errors.validation()`

3. **Middleware Pattern** (`lib/api/auth.ts`): `requireAuth()`, `requireSeeker()`, `requireProvider()` for route protection

4. **Observer Pattern** (Webhooks): Razorpay webhooks observe payment events and update order state

5. **State Machine** (Booking/Order lifecycle): Explicit state transitions with validation

6. **Audit Trail Pattern** (`lib/audit.ts`): Fire-and-forget logging of all state changes

### Q: How do you handle separation of concerns?

**Answer**:

- **`app/`**: Pages and API routes (presentation layer)
- **`components/`**: Reusable UI components
- **`lib/`**: Business logic, utilities, external integrations
- **`types/`**: TypeScript interfaces and enums
- **`cron/`**: Background job logic

Each layer has a single responsibility and minimal coupling.

### Q: Explain the App Router structure

**Answer**: Next.js App Router uses file-based routing with special conventions:

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

- **Route Groups** `()`: Organize without affecting URL
- **Dynamic Routes** `[id]`: URL parameters like `/orders/[id]`
- **API Routes**: `route.ts` files that handle HTTP methods

---

## 4. Database Questions

### Q: What collections do you have?

**Answer**: Key MongoDB collections:

| Collection       | Purpose                                             |
| ---------------- | --------------------------------------------------- |
| `seekers`        | User profiles for service seekers                   |
| `providers`      | Provider profiles with location, services, capacity |
| `admins`         | Admin user accounts                                 |
| `bookings`       | Handshake/negotiation records                       |
| `orders`         | Committed orders with payment info                  |
| `complaints`     | Dispute records with chat messages                  |
| `reviews`        | Provider ratings and reviews                        |
| `payments`       | Payment transaction records                         |
| `audit_logs`     | Complete state change history                       |
| `webhook_events` | Incoming webhook records                            |

### Q: How do you handle database connections?

**Answer**: Connection pooling with singleton pattern:

```typescript
// lib/mongodb.ts
let clientPromise: Promise<MongoClient> | undefined;

function createClientPromise(): Promise<MongoClient> {
  const client = new MongoClient(env.MONGODB_URI);
  if (process.env.NODE_ENV === "development") {
    // Reuse connection in development (hot reload)
    if (!global._mongoClientPromise)
      global._mongoClientPromise = client.connect();
    return global._mongoClientPromise;
  }
  return client.connect();
}
```

This prevents connection exhaustion during development hot reloads.

### Q: How do you handle geospatial queries?

**Answer**: MongoDB's `2dsphere` index with `$geoWithin`:

```typescript
// Find providers covering seeker's location
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

Providers store their `coordinates` and `radius_km`. The query finds all providers whose service radius covers the seeker's location.

### Q: Do you use database transactions?

**Answer**: Yes, for critical operations like booking creation:

```typescript
// Atomic capacity check + booking creation
await session.withTransaction(async () => {
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

This prevents race conditions where multiple bookings could exceed provider capacity.

---

## 5. Authentication & Security Questions

### Q: How does authentication work?

**Answer**: NextAuth v4 with two providers:

1. **Google OAuth**: Social login with Google accounts
2. **Credentials**: Email/password with bcrypt hashing

```typescript
// Flow
User clicks "Sign in with Google"
  → Google OAuth flow
  → Check if user exists in DB
  → If new: redirect to /choose-role
  → If existing: create JWT session
```

### Q: How do you protect routes?

**Answer**: Server-side middleware functions:

```typescript
// lib/api/auth.ts
export async function requireSeeker(): Promise<AuthResult> {
  return requireAuth([Role.SEEKER]);
}

// Usage in API route
export const POST = withErrorHandling(async (req: Request) => {
  const session = await requireSeeker(); // Throws if not seeker
  // ... route logic
});
```

### Q: How do you handle password security?

**Answer**:

- **Bcrypt hashing**: Passwords are hashed with bcrypt (10 rounds)
- **No plain text storage**: Only hash is stored
- **Timing-safe comparison**: Prevents timing attacks

```typescript
const isValid = await bcrypt.compare(password, user.passwordHash);
```

### Q: How do you prevent common security vulnerabilities?

**Answer**:

| Vulnerability           | Prevention                                            |
| ----------------------- | ----------------------------------------------------- |
| **SQL Injection**       | Not applicable (MongoDB), but inputs are sanitized    |
| **XSS**                 | React automatically escapes output                    |
| **CSRF**                | NextAuth handles CSRF tokens                          |
| **Timing Attacks**      | `crypto.timingSafeEqual()` for signature verification |
| **Webhook Spoofing**    | HMAC signature verification                           |
| **Unauthorized Access** | Role-based middleware on every protected route        |

### Q: How do you validate webhook signatures?

**Answer**:

```typescript
// Constant-time comparison prevents timing attacks
const expectedSignature = crypto
  .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
  .update(webhookBody)
  .digest("hex");

if (
  !crypto.timingSafeEqual(
    Buffer.from(webhookSignature),
    Buffer.from(expectedSignature),
  )
) {
  return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
}
```

---

## 6. Payment & Escrow Questions

### Q: Explain the escrow system

**Answer**: The escrow system ensures safe payments:

```
1. Seeker pays for order
   ↓
2. Funds held in Razorpay (payment_status: "paid" → "held")
   ↓
3. Provider completes work and delivers
   ↓
4. Seeker confirms with OTP (escrow_started_at set)
   ↓
5. 24-hour cooling period (escrow_release_at set)
   ↓
6. If no complaint: Auto-release to provider via RazorpayX payout
   ─ OR ─
   If complaint raised: Escrow frozen until admin resolves
```

### Q: What is RazorpayX?

**Answer**: RazorpayX is Razorpay's payout product for sending money to bank accounts. I use it to:

1. Create a "Contact" (provider's identity)
2. Create a "Fund Account" (provider's bank details)
3. Send automated payouts when escrow releases

### Q: How do you prevent double payouts?

**Answer**: Multiple idempotency checks:

```typescript
// 1. Check if payout already exists
if (order.payout_id) {
  results.push({ status: "skipped_payout_exists" });
  continue;
}

// 2. Atomic update with condition
await db.collection("orders").updateOne(
  {
    _id: order._id,
    payout_id: { $exists: false }, // Only if no payout yet
  },
  { $set: { payout_id: payout.id } },
);

// 3. Razorpay reference_id (rejects duplicates)
await createRazorpayPayout({
  reference_id: order._id.toString(), // Razorpay rejects if seen before
});
```

### Q: What happens if a payment fails?

**Answer**:

1. Webhook receives `payment.failed` event
2. Payment status updated in database
3. User can retry payment from their dashboard
4. No duplicate payouts; each payment attempt is verified by signature and reconciled via webhooks

### Q: How does the complaint affect escrow?

**Answer**:

- **Complaint raised** → Escrow timer immediately frozen
- **Admin reviews** → 3-way chat with Seeker and Provider
- **Resolution**:
  - `release_payout`: Pay provider (complaint dismissed)
  - `refund_full`: Full refund to seeker (provider at fault)
  - `reject`: Invalid complaint, pay provider

---

## 7. Core Features Questions

### Q: Explain the booking lifecycle

**Answer**:

```
requested → accepted → pickup_proposed → confirmed → invoice_created
    ↓           ↓             ↓              ↓
 rejected    cancelled   reschedule    converted to Order
```

**States explained**:

- `requested`: Seeker requested a booking
- `accepted`: Provider accepted
- `pickup_proposed`: Provider proposed pickup time
- `confirmed`: Both agreed on time
- `invoice_created`: Provider created invoice after pickup
- `reschedule_requested`: Either party wants new time

### Q: Explain the order lifecycle

**Answer**:

```
invoiced → processing → washing → ironing → ready → out_for_delivery → delivered
```

After `delivered`:

- OTP confirmed → Escrow starts 24-hour timer
- No complaint → Auto-release to provider
- Complaint → Freeze and admin review

### Q: How does provider capacity work?

**Answer**: Providers set a `capacity` (max concurrent jobs). Before accepting:

```typescript
const activeJobs =
  bookings.count({ status: active }) + orders.count({ status: active });
if (activeJobs >= provider.capacity) {
  throw new Error("CAPACITY_EXCEEDED");
}
```

This is checked atomically in a transaction to prevent race conditions.

### Q: How does geolocation-based discovery work?

**Answer**:

1. Seeker enters address
2. Google Geocoding API converts to coordinates
3. MongoDB query finds providers whose `radius_km` covers that point
4. Results sorted by distance using Haversine formula
5. Delivery charges calculated based on distance beyond free radius

### Q: How does the complaint system work?

**Answer**:

```
Seeker raises complaint (status: "open")
    ↓
Admin reviews and accepts (status: "accepted", deadline set)
    ↓
Admin adds provider to chat (status: "in_review", legacy status `under_review` still recognized)
    ↓
3-way chat for mediation
    ↓
Admin resolves (status: "resolved" or "rejected")
    ↓
Escrow action executed (refund/release)
```

Note: The 24-hour complaint window is a product rule; the current API does not enforce a hard cutoff yet.

---

## 8. API & Backend Questions

### Q: How are your API routes organized?

**Answer**: Domain-based organization:

```
app/api/
├── admin/          # Admin-only endpoints
│   └── complaints/ # Complaint management
├── auth/           # NextAuth handlers
├── bookings/       # Booking CRUD, chat, schedule
├── complaints/     # Complaint creation, messages
├── cron/           # Scheduled jobs (secured with CRON_SECRET)
├── escrow/         # Manual escrow operations
├── orders/         # Order lifecycle, payment
├── otp/            # OTP send/verify
├── payments/       # Razorpay operations
├── providers/      # Provider search, profile
├── reviews/        # Rating submission
└── webhooks/       # Razorpay webhooks
```

### Q: How do you handle API errors?

**Answer**: Centralized error handling with custom `AppError` class:

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

// Factory functions
Errors.notFound("Booking"); // 404
Errors.unauthorized(); // 401
Errors.validation("Invalid data"); // 400
Errors.conflict("Already exists"); // 409
```

### Q: How do you validate request data?

**Answer**: Zod schemas for runtime validation:

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

// Usage in route
const result = createBookingSchema.safeParse(body);
if (!result.success) {
  throw Errors.validation("Invalid data", result.error.flatten());
}
```

### Q: How do cron jobs work?

**Answer**: Vercel Cron Jobs call API endpoints on schedule:

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/auto-reject-bookings", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/release-payouts", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/no-show", "schedule": "*/5 * * * *" }
  ]
}
```

**Security**: Each cron endpoint requires `Authorization: Bearer ${CRON_SECRET}` header.

**Jobs**:

- `auto-reject-bookings`: Expire pending requests after timeout
- `release-payouts`: Auto-release escrow after 24 hours
- `no-show`: Handle provider no-shows
- `monitor-abuse`: Detect suspicious activity (runs at 2 AM)

---

## 9. Frontend & UI Questions

### Q: What UI framework do you use?

**Answer**: **shadcn/ui** with Tailwind CSS:

- Not a component library you install
- Pre-built components you copy into your codebase
- Full customization control
- Built on Radix UI primitives (accessible)
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

Tailwind's `dark:` prefix handles styling.

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

Benefits: Minimal re-renders, validation, TypeScript integration.

### Q: How do you handle animations?

**Answer**: Framer Motion for smooth animations:

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

- **Page-level**: `loading.tsx` files (Suspense boundaries)
- **Component-level**: `useState` with skeleton loaders
- **Button-level**: Disabled state with spinner icon

---

## 10. Deployment & DevOps Questions

### Q: Where is the app deployed?

**Answer**: **Vercel** - optimal for Next.js:

- Zero-config deployment
- Automatic SSL
- Edge functions
- Preview deployments for PRs
- Built-in analytics
- Cron job support

### Q: How does the deployment pipeline work?

**Answer**:

1. Push code to GitHub
2. Vercel auto-detects changes
3. Builds Next.js application
4. Deploys to serverless functions
5. CDN caches static assets
6. Preview URL for branches, production for main

### Q: How do you manage environment variables?

**Answer**:

- **Development**: `.env.local` file (gitignored)
- **Production**: Vercel Environment Variables dashboard
- **Validation**: Zod schema validates on app startup

```typescript
// lib/env.ts
const envSchema = z.object({
  GOOGLE_ID: z.string().min(1),
  MONGODB_URI: z.string().min(1),
  // ... all required vars
});

export const env = envSchema.parse(process.env);
```

App fails fast if any required variable is missing.

### Q: How do you handle logs?

**Answer**: Structured logging with custom logger:

```typescript
// lib/logger.ts
logger.info("ORDERS", "Order created", { orderId, amount });
logger.error("WEBHOOK", "Signature invalid", error, { paymentId });
```

Logs include: timestamp, category, message, metadata.

---

## 11. Testing & Quality Questions

### Q: How do you ensure code quality?

**Answer**:

1. **TypeScript**: Compile-time type checking
2. **ESLint**: Code style enforcement
3. **Zod validation**: Runtime data validation
4. **Error boundaries**: Graceful error handling

### Q: How do you handle errors in production?

**Answer**:

- **API Routes**: Many routes use `withErrorHandling`; others use explicit `try/catch` with `NextResponse`
- **Frontend**: Error boundaries + toast notifications
- **Global**: `global-error.tsx` for uncaught errors
- **Logging**: All errors logged with context for debugging

---

## 12. Challenges & Solutions

### Q: What was the biggest technical challenge?

**Answer**: **Preventing race conditions in bookings**

**Problem**: Multiple seekers could book the same provider simultaneously, exceeding capacity.

**Solution**: MongoDB transactions with atomic capacity check:

```typescript
await session.withTransaction(async () => {
  const count = await db.collection("bookings").countDocuments(
    { provider_id, status: { $in: activeStatuses } },
    { session }, // Same transaction
  );

  if (count >= capacity) throw new Error("CAPACITY_EXCEEDED");

  await db.collection("bookings").insertOne(booking, { session });
});
```

### Q: How do you handle idempotency in payments?

**Answer**:

1. Check if operation already done before proceeding
2. Use atomic conditional updates
3. Razorpay's `reference_id` rejects duplicate payouts
4. Webhooks can be received multiple times safely

### Q: How do you handle offline/slow networks?

**Answer**:

- Optimistic UI updates with rollback
- Loading states during API calls
- Toast notifications for success/failure
- Retry logic for failed requests

---

## 13. Future Scope

### Q: What features would you add next?

**Answer**:

1. **Real-time notifications**: WebSocket/SSE for instant updates
2. **Mobile app**: React Native for Android/iOS
3. **Provider analytics**: Earnings dashboard, order trends
4. **Subscription plans**: Monthly unlimited laundry packages
5. **Multi-language support**: Hindi, regional languages
6. **Pickup scheduling calendar**: Visual slot picker
7. **Loyalty program**: Points and discounts for frequent users

### Q: How would you scale this for 10x users?

**Answer**:

1. **Database**: MongoDB Atlas with sharding, read replicas
2. **Caching**: Redis for frequently accessed data
3. **CDN**: Cloudflare/Vercel Edge for static assets
4. **Queue**: Background job queue for heavy operations
5. **Microservices**: Split payment/notification services

---

## 14. Quick Technical Terms Glossary

| Term            | Meaning                                                                |
| --------------- | ---------------------------------------------------------------------- |
| **SSR**         | Server-Side Rendering - pages rendered on server                       |
| **SSG**         | Static Site Generation - pages pre-built at build time                 |
| **ISR**         | Incremental Static Regeneration - static pages updated on demand       |
| **JWT**         | JSON Web Token - stateless authentication token                        |
| **Escrow**      | Third-party holds funds until conditions are met                       |
| **Webhook**     | HTTP callback for event notifications                                  |
| **ACID**        | Atomicity, Consistency, Isolation, Durability (transaction properties) |
| **OTP**         | One-Time Password - single-use verification code                       |
| **HMAC**        | Hash-based Message Authentication Code                                 |
| **Idempotency** | Operation produces same result if executed multiple times              |
| **Geospatial**  | Data based on geographic coordinates                                   |
| **Haversine**   | Formula to calculate distance between two coordinates                  |

---

## Known Gaps vs PRD (Be Transparent)

Use these points if you are asked about differences between the PRD and current implementation:

- **24-hour complaint window**: Documented in PRD, but the API does not enforce a strict cutoff yet. A validation check can be added based on `delivered` + `otp_confirmed_at` timestamps.
- **Complaint status normalization**: The core flow uses `open → accepted → in_review → resolved/rejected`, but some endpoints still recognize legacy `under_review` as active.
- **Error handling consistency**: Many API routes use `withErrorHandling`, but some still use explicit `try/catch`. This is a refactor opportunity for consistency.
- **Payment retries**: Each retry creates a new Razorpay order; idempotency is handled at payout and webhook reconciliation, not by reusing order IDs.
- **PRD vs timeline**: PRD has a few future-looking features (like complaint window extension requests) that are not fully wired yet.

## Quick Presentation Tips

1. **Start with the problem**: "Local laundry services lack trust and payment security"
2. **Show the solution**: Live demo of booking → payment → delivery flow
3. **Highlight uniqueness**: Escrow system, 3-way dispute chat, geospatial matching
4. **Talk confidently about tech choices**: Reference the comparison tables above
5. **Mention production-readiness**: Audit logs, idempotency, error handling

**Good luck with your presentation! 🚀**
