# LaundryEase — Product Requirements Document

## 1. Executive Summary

LaundryEase turns a local laundry job into a verifiable contract.

It does that by splitting the transaction into two moments:

- a **handshake** (booking) where both sides agree to a slot without moving money, and
- a **commitment** (paid invoice) where the seeker locks funds in escrow and the provider begins work.

From commitment to delivery, the system advances through explicit states and releases escrow only after OTP-confirmed handoff.

## 2. Goals & Non-Goals

### Goals

- **Remove payment ambiguity**
  Providers should never wonder whether they’ll get paid after they’ve consumed time, utilities, and labor.

- **Replace status guessing with recorded facts**
  Seekers should see the job as a timeline of states, not a chat thread.

- **Prevent unviable matches at the source**
  The search experience should surface only providers who deliberately cover the seeker’s location.

- **Create an auditable transaction trail**
  The platform must record state transitions and payment events so support can resolve edge cases with evidence.

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

- resolve disputes and complaints
- enforce abuse policy (e.g., bans, freezes)
- decide escrow outcomes when the normal path breaks

## 4. Core User Flows

### A. Discovery & Booking (Handshake)

1. **Search**
   Seeker provides a location. The system returns providers whose service radius covers that coordinate.

2. **Request**
   Seeker requests a slot from a chosen provider.

3. **Accept / Reject**
   Provider accepts to proceed or rejects to end the attempt.

Outcome: both sides agree to a slot, but no commitment exists yet.

### B. Pickup, Invoice, and Escrow (Commitment)

1. **Pickup and inspection**
   Provider verifies the actual items.

2. **Invoice creation**
   Provider issues an invoice based on the inspected items.

3. **Payment into escrow**
   Seeker pays. The system holds funds in escrow.

4. **Order activation**
   The job becomes an active order. Work begins.

### C. Execution, Delivery, and Settlement

1. **Lifecycle progression**
   Provider advances the order through explicit states (e.g., washing → ironing → ready → out for delivery).

2. **Delivery**
   Provider delivers to the seeker.

3. **OTP confirmation**
   Seeker shares a one-time code to confirm handoff.

4. **Escrow release**
   The system verifies OTP and releases funds to the provider payout flow (with any configured cooling period).

## 5. System Requirements

### Functional Requirements

- **Geospatial discovery**
  The system must support radius-based matching with practical precision.

- **Capacity enforcement**
  Providers must define a maximum number of concurrent active jobs. The system must block acceptance beyond that capacity.

- **Invoice immutability after payment**
  Once the seeker pays, invoice line items must not change.

- **Escrow gating**
  Work must start only after escrow holds the paid invoice amount.

- **OTP delivery authentication**
  Delivery must require a one-time code.

### Non-Functional Requirements

- **Consistency**
  Order state and payment state must not drift.

- **Data minimization**
  The system should reveal personal details only when needed to complete the job.

- **Search latency target**
  Provider discovery should feel immediate under normal load.

## 6. State Management & Lifecycle

### Booking (Handshake) States

| State       | Meaning                       | Allowed Next States               |
| ----------- | ----------------------------- | --------------------------------- |
| `requested` | Seeker requested a slot       | `accepted`, `rejected`, `expired` |
| `accepted`  | Provider accepted the request | `confirmed`, `cancelled`          |
| `rejected`  | Provider rejected the request | terminal                          |
| `confirmed` | parties agreed on pickup/slot | `invoice_created`, `cancelled`    |
| `expired`   | request timed out             | terminal                          |

### Order (Commitment → Settlement) States

| State              | Meaning                            |
| ------------------ | ---------------------------------- |
| `invoiced`         | invoice paid; funds held in escrow |
| `washing`          | cleaning in progress               |
| `ironing`          | finishing in progress              |
| `ready`            | ready for delivery or pickup       |
| `out_for_delivery` | provider is actively delivering    |
| `delivered`        | OTP verified; service complete     |

Rules:

- The system must enforce valid transitions.
- The system must time-stamp every transition and record the actor.

## 7. Data & Integrity Rules

- **Immutable financial record**
  Paid invoices must remain unchanged. Adjustments require a new invoice or an explicit admin action.

- **Capacity is a hard constraint**
  The provider cannot accept a booking that would exceed configured capacity.

- **Location changes during active work require protection**
  Provider location and radius updates must not break active commitments.

## 8. Security & Abuse Prevention

- **Tokenized payments**
  Store payment references, not raw card data.

- **Escrow freeze on dispute**
  Any complaint or dispute must halt settlement timers until the admin decides the outcome.

- **Progress requires authorization**
  Only the provider assigned to the order can advance lifecycle states.

- **Selective disclosure of PII**
  The system should hide full address details until a booking reaches a state where fulfillment requires them.

## 9. Observability & Failure Strategy

- **Audit log**
  Capture: entity, previous state, next state, actor, timestamp, and correlated payment identifiers.

- **Expiry and cleanup**
  Automatically expire stale booking requests to avoid orphaned intent.

- **Payment reconciliation**
  Regularly reconcile payment provider records against internal payment state.

## 10. Out of Scope

- IoT integration with machines
- Multi-stop route optimization
- Provider inventory management (supplies)

## 11. Success Metrics

- **Completion reliability**: delivered / invoiced
- **Dispute rate**: disputes per invoiced order
- **Time-to-clarity**: reduction in seeker-to-provider status calls/messages (proxy via support/contact rates)

## 12. Environment Setup & Configuration

### Required Environment Variables

LaundryEase requires the following environment variables to be configured (see `.env.example` for template):

**Authentication & OAuth:**
- `GOOGLE_ID` - Google OAuth client ID
- `GOOGLE_SECRET` - Google OAuth client secret
- `NEXTAUTH_SECRET` - Secret for NextAuth JWT signing (generate: `openssl rand -base64 32`)
- `NEXTAUTH_URL` - Application base URL (optional, defaults to localhost:3000)

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

**Google Maps:**
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Google Maps API key (requires Maps JavaScript API, Places API, Geocoding API)

**Security:**
- `CRON_SECRET` - Secret for securing cron job endpoints (generate: `openssl rand -base64 32`)

**Optional:**
- `NEXT_PUBLIC_BASE_URL` - Public application URL for email links
- `NEXT_PUBLIC_APP_URL` - Alternative application URL
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name (for image uploads)
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret

### Setup Instructions

1. Copy `.env.example` to `.env.local`
2. Fill in all required variables with actual values
3. Ensure all external services (Razorpay, Twilio, Google Cloud) are configured
4. Run MongoDB setup script if needed: `npm run setup:geospatial-index` (if script exists)
5. Start the development server: `npm run dev`

See `README.md` for detailed setup instructions.

## 13. Open Questions & Risks

- **Cash payments**
  If providers accept cash outside escrow, the trust contract breaks and the platform loses its enforcement mechanism.

- **No-show policy**
  The system needs a consistent rule for seeker no-shows at pickup and provider no-shows at delivery.

- **Cancellation semantics**
  We need explicit policy for who can cancel at each state and what happens to escrow when cancellation occurs.
