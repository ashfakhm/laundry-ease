# Product Requirements Document: LaundryEase

**Version:** 4.0  
**Last Updated:** 2026-01-06  
**Status:** Production-Ready  
**Author:** Engineering Team

---

## 1. Problem Statement

### The Core Problem

Urban professionals in India lose 2-4 hours per week to laundry logistics. This time cost compounds: a ₹24L/year employee loses ₹15,000+ annually in opportunity cost to laundry errands alone.

Traditional laundry services fail in five predictable ways:

| Failure Mode                   | Measured Impact                    | Affected Population   |
| ------------------------------ | ---------------------------------- | --------------------- |
| Physical shop visits required  | 2-4 hours/week lost                | 100% of users         |
| No deadline guarantees         | 34% report missed events           | Working professionals |
| Opaque pricing                 | 67% frustrated by surprise charges | All customers         |
| Zero accountability for damage | 12% experienced loss               | All customers         |
| Cash-only operations           | 78% prefer digital payment         | Urban demographic     |

### Why This Matters Now

India's urban laundry market is ₹15,000 Cr. The demographic shift toward dual-income households and the post-COVID normalization of doorstep services creates a timing window for a well-engineered solution.

### Success Criteria

This product succeeds if:

1. **Booking conversion rate** exceeds 70% (booking → completed order)
2. **Provider acceptance rate** exceeds 85%
3. **On-time delivery rate** exceeds 95%
4. **Complaint rate** stays below 5%
5. **Dispute resolution** averages under 24 hours

---

## 2. Goals and Non-Goals

### Goals

1. **Eliminate seeker travel** — 100% doorstep pickup and delivery
2. **Guarantee deadlines** — Provider commits to completion date; penalties for late delivery
3. **Protect payments** — Escrow holds funds until seeker confirms satisfaction
4. **Enable fair dispute resolution** — Photo evidence + admin mediation
5. **Provide predictable pricing** — All costs visible before booking

### Non-Goals (Explicitly Out of Scope)

1. **AI-powered clothing detection** — Manual itemization for MVP; dataset collection for future
2. **Route optimization** — Providers manage their own logistics
3. **Subscription models** — Per-order pricing only
4. **Native mobile apps** — PWA via Next.js; native apps post-PMF
5. **Multi-city operations** — Bangalore only for launch
6. **Real-time chat** — Async messaging sufficient for dispute resolution

---

## 3. User Personas

### Primary: The Time-Starved Professional (Seeker)

| Attribute                  | Value                                                       |
| -------------------------- | ----------------------------------------------------------- |
| Age                        | 25-45                                                       |
| Income                     | ₹8L+/year                                                   |
| Location                   | Tier-1 Indian cities                                        |
| Tech comfort               | High (daily UPI, Swiggy/Zepto user)                         |
| Laundry frequency          | 2-3 times/month                                             |
| Primary motivation         | Reclaim personal time                                       |
| Willingness to pay premium | Yes, for reliability                                        |
| Key frustration            | "I've lost clothes at local shops with zero accountability" |

**Job to be Done:**  
"When I have a busy week, I want my laundry handled without my involvement, so I can focus on higher-priority work."

### Secondary: The Professional Provider

| Attribute          | Value                                                  |
| ------------------ | ------------------------------------------------------ |
| Age                | 30-55                                                  |
| Business type      | Established laundry shop (5+ years)                    |
| Staff              | 2-5 employees                                          |
| Current revenue    | ₹50K-150K/month                                        |
| Tech comfort       | Medium (WhatsApp, Paytm)                               |
| Primary motivation | Expand customer base without storefront investment     |
| Key frustration    | "Walk-in traffic is declining; I need online presence" |

**Job to be Done:**  
"When I have spare capacity, I want to fill it with reliable customers, so I can grow revenue without new physical locations."

### Tertiary: Platform Admin

| Attribute        | Value                                                               |
| ---------------- | ------------------------------------------------------------------- |
| Role             | Operations Manager                                                  |
| Responsibilities | Dispute resolution, fraud prevention, provider quality              |
| KPIs             | Resolution time <24h, Fraud rate <0.5%, Provider churn <5%/month    |
| Capabilities     | User management, payment control, complaint resolution, system logs |

---

## 4. User Flows

### 4.1 Seeker: Discovery → Booking → Delivery

**Preconditions:** Seeker is authenticated, location set, phone/email verified.

```
1. Seeker opens Search page
2. System displays providers within service radius, sorted by: Rating > Distance > Price
3. System filters out providers where activeOrders >= maxCapacity
4. Seeker selects provider, views profile (pricing, reviews, delivery times)
5. Seeker clicks "Book Now"
6. System displays booking modal with:
   - Provider's booking fee (provider-defined minimum)
   - Estimated delivery charge based on distance
   - Optional deadline selection
7. Seeker confirms and pays booking fee via Razorpay
8. System creates booking (status: REQUESTED)
9. Provider receives notification
10. Provider accepts within 2h (or system auto-rejects with full refund)
11. Provider proposes pickup slot
12. Seeker confirms availability
13. Provider arrives at scheduled time (GPS verified)
14. Provider photographs items and creates itemized invoice
15. Seeker reviews invoice (approve / reject / request edit)
16. On approval: booking converts to Order; seeker pays order total
17. Provider processes laundry, updates status (WASHING → IRONING → READY)
18. Provider proposes delivery slot
19. Seeker confirms; provider delivers
20. Seeker enters OTP to confirm receipt
21. System starts 24h escrow window
22. If no complaint: funds auto-release to provider (minus 5% commission)
23. If complaint: escrow frozen until admin resolution
```

**Edge Cases:**

- Provider doesn't respond in 2h → Auto-reject, full refund
- Provider no-show at pickup → Refund + provider penalty
- Seeker no-show at pickup → Booking fee forfeited
- Invoice rejected → Clothes returned, booking fee retained by provider
- Complaint raised → Escrow frozen, admin resolves

### 4.2 Provider: Booking Management → Invoice → Payout

**Preconditions:** Provider authenticated, profile complete, bank details verified.

```
1. Provider receives booking notification
2. Provider views seeker location, requested deadline
3. Provider accepts or rejects (2h SLA)
4. If accepted: Provider proposes pickup date/time
5. Seeker confirms → booking status: CONFIRMED
6. Provider travels to pickup location
7. Provider marks "Arrived" (GPS verified within 200m)
8. Provider photographs each item, creates invoice with:
   - Item name (from price list or "Other")
   - Quantity
   - Unit price (auto-filled from profile; manual for "Other" items)
   - Notes (stains, special instructions)
   - Photo (mandatory per item)
9. Seeker reviews and approves invoice
10. System creates Order, seeker pays
11. Provider processes laundry
12. Provider updates status: PICKED_UP → WASHING → IRONING → READY
13. Provider proposes delivery date/time
14. Seeker confirms
15. Provider delivers, seeker enters OTP
16. 24h escrow window begins
17. If no complaint: Cron job releases funds to provider bank account
18. Provider receives 95% (5% platform commission deducted)
```

**Edge Cases:**

- Seeker unreachable at pickup → Wait 15 min, mark "Seeker Unavailable", booking cancelled, fee forfeited
- Late delivery → 5% penalty per hour, max 30%
- Complaint raised → Payout frozen until resolution

### 4.3 Admin: Dispute Resolution

**Preconditions:** Admin authenticated with super-admin role.

```
1. Seeker raises complaint (within 24h escrow window)
2. System immediately freezes escrow
3. Complaint appears in Admin dashboard
4. Admin reviews:
   - Order details and timeline
   - Invoice with photos
   - Complaint description and evidence
5. Admin opens three-way chat (Seeker + Provider + Admin)
6. Admin requests additional information if needed
7. Admin makes resolution decision:
   - RELEASE_PAYOUT: Provider receives funds
   - FULL_REFUND: Seeker receives full order amount
   - PARTIAL_REFUND: Admin-determined percentage
   - REJECT: Complaint dismissed, funds released
8. System executes payment action
9. Chat is permanently closed
10. Resolution logged for fraud pattern detection
```

---

## 5. Functional Requirements

### FR-1: Authentication & Onboarding

| ID     | Requirement                                                                                        | Priority | Status         |
| ------ | -------------------------------------------------------------------------------------------------- | -------- | -------------- |
| FR-1.1 | Phone verification via 6-digit OTP (5 min expiry, 3 attempts max)                                  | P0       | ✅ Implemented |
| FR-1.2 | Email verification via magic link (24h expiry)                                                     | P0       | ✅ Implemented |
| FR-1.3 | Google OAuth as alternative auth method                                                            | P0       | ✅ Implemented |
| FR-1.4 | Provider must complete profile (location, radius, pricing, bank details) before accepting bookings | P0       | ✅ Implemented |
| FR-1.5 | Bank details verified via RazorpayX Contact creation                                               | P0       | ✅ Implemented |

### FR-2: Provider Discovery

| ID     | Requirement                                                                     | Priority | Status         |
| ------ | ------------------------------------------------------------------------------- | -------- | -------------- |
| FR-2.1 | Search by seeker location; show only providers whose radius covers seeker       | P0       | ✅ Implemented |
| FR-2.2 | Filter out providers where activeOrders >= maxCapacity                          | P0       | ✅ Implemented |
| FR-2.3 | Sort results by Rating > Distance > Price                                       | P0       | ✅ Implemented |
| FR-2.4 | Display provider profile: name, rating, review count, pricing, delivery charges | P0       | ✅ Implemented |
| FR-2.5 | Deadline-based filtering (hide providers who can't meet deadline)               | P1       | ⏳ Planned     |

### FR-3: Booking Flow

| ID     | Requirement                                                    | Priority | Status         |
| ------ | -------------------------------------------------------------- | -------- | -------------- |
| FR-3.1 | Create booking with provider-defined booking fee               | P0       | ✅ Implemented |
| FR-3.2 | Booking fee payment via Razorpay Orders                        | P0       | ✅ Implemented |
| FR-3.3 | Provider accept/reject with 2h SLA                             | P0       | ✅ Implemented |
| FR-3.4 | Auto-reject on timeout with full refund                        | P0       | ✅ Implemented |
| FR-3.5 | Pickup scheduling (propose → confirm)                          | P0       | ✅ Implemented |
| FR-3.6 | No-show detection via GPS verification (200m radius)           | P0       | ⚠️ Deferred    |
| FR-3.7 | Seeker cancellation (pre-accept: refund; post-accept: forfeit) | P0       | ✅ Implemented |

> **FR-3.6 Deferral Note:** GPS verification requires browser Geolocation API with user permission. Implementation deferred to post-MVP due to: (1) indoor GPS accuracy typically ±50m, making 200m radius unreliable; (2) user permission denial handling complexity; (3) GPS spoofing detection requires device attestation. For MVP, provider self-reports arrival and seeker confirms via app notification. Manual dispute resolution handles no-show claims with photo evidence.

### FR-4: Invoice & Order

| ID     | Requirement                                                        | Priority | Status         |
| ------ | ------------------------------------------------------------------ | -------- | -------------- |
| FR-4.1 | Provider creates itemized invoice at pickup                        | P0       | ✅ Implemented |
| FR-4.2 | Mandatory photo per item                                           | P0       | ✅ Implemented |
| FR-4.3 | Prices auto-filled from provider profile (manual only for "Other") | P0       | ✅ Implemented |
| FR-4.4 | Seeker approve/reject/edit invoice                                 | P0       | ✅ Implemented |
| FR-4.5 | Approved invoice converts to Order                                 | P0       | ✅ Implemented |
| FR-4.6 | Booking fee deducted from order total                              | P0       | ✅ Implemented |

### FR-5: Order Processing

| ID     | Requirement                                                              | Priority | Status         |
| ------ | ------------------------------------------------------------------------ | -------- | -------------- |
| FR-5.1 | Order status tracking: PICKED_UP → WASHING → IRONING → READY → DELIVERED | P0       | ✅ Implemented |
| FR-5.2 | Delivery scheduling (propose → confirm)                                  | P0       | ✅ Implemented |
| FR-5.3 | Delivery confirmation via OTP                                            | P0       | ✅ Implemented |
| FR-5.4 | Late delivery penalty: 5% per hour, max 30%                              | P1       | ✅ Implemented |

> **FR-5.4 Late Delivery Penalty Specification:**
>
> - **Deadline Definition:** Provider-committed delivery date/time set during pickup scheduling
> - **Penalty Application:** Deducted from provider payout (not refunded to seeker)
> - **Calculation:** 5% of order total per hour late, capped at 30%
> - **Edge Cases:**
>   - If no deadline explicitly set: No penalty applies (encourage deadline setting in future)
>   - If seeker unavailable at delivery: Clock pauses until new slot confirmed
>   - 24h escrow window starts from actual delivery time, not original deadline

### FR-6: Payment & Escrow

| ID     | Requirement                                                | Priority | Status         |
| ------ | ---------------------------------------------------------- | -------- | -------------- |
| FR-6.1 | Order payment via Razorpay Orders                          | P0       | ✅ Implemented |
| FR-6.2 | 24h escrow hold post-delivery                              | P0       | ✅ Implemented |
| FR-6.3 | Auto-release via cron job if no complaint                  | P0       | ✅ Implemented |
| FR-6.4 | Payout to provider via RazorpayX (95% after 5% commission) | P0       | ✅ Implemented |
| FR-6.5 | Escrow freeze on complaint                                 | P0       | ✅ Implemented |

### FR-7: Dispute Resolution

| ID     | Requirement                                                       | Priority | Status         |
| ------ | ----------------------------------------------------------------- | -------- | -------------- |
| FR-7.1 | Complaint filing within 24h escrow window                         | P0       | ✅ Implemented |
| FR-7.2 | One complaint per order (enforced at API)                         | P0       | ✅ Implemented |
| FR-7.3 | Three-way chat (Seeker + Provider + Admin)                        | P0       | ✅ Implemented |
| FR-7.4 | Admin resolution: release / refund_full / refund_partial / reject | P0       | ✅ Implemented |
| FR-7.5 | Chat permanently closed after resolution                          | P0       | ✅ Implemented |

### FR-8: Reviews

| ID     | Requirement                                   | Priority | Status         |
| ------ | --------------------------------------------- | -------- | -------------- |
| FR-8.1 | Review submission only after order completion | P1       | ✅ Implemented |
| FR-8.2 | 1-5 star rating + text review                 | P1       | ✅ Implemented |
| FR-8.3 | Reviews displayed on provider profile         | P1       | ✅ Implemented |

---

## 6. Non-Functional Requirements

### NFR-1: Performance

| Requirement               | Target | Measurement |
| ------------------------- | ------ | ----------- |
| API response time (p95)   | <500ms | Monitoring  |
| Time to First Byte        | <200ms | Lighthouse  |
| Largest Contentful Paint  | <2.5s  | Lighthouse  |
| Database query time (p95) | <100ms | Monitoring  |

### NFR-2: Scalability

| Requirement       | Target                      |
| ----------------- | --------------------------- |
| Concurrent users  | 10,000                      |
| Monthly orders    | 50,000                      |
| Provider capacity | 10 concurrent bookings each |
| Database size     | 100GB (3 year projection)   |

### NFR-3: Availability

| Requirement                | Target            |
| -------------------------- | ----------------- |
| Uptime                     | 99.9%             |
| Planned maintenance window | Sunday 2-4 AM IST |
| Recovery Time Objective    | <1 hour           |
| Recovery Point Objective   | <5 minutes        |

### NFR-4: Security

| Requirement       | Implementation                             |
| ----------------- | ------------------------------------------ |
| Authentication    | NextAuth.js with JWT; 7-day expiry         |
| Authorization     | Role-based middleware per route            |
| Password policy   | 8+ chars, 1 uppercase, 1 number, 1 special |
| OTP security      | Rate limited (3 attempts), 5 min expiry    |
| API rate limiting | 100 req/min per user                       |
| Payment data      | Never stored; Razorpay tokenization        |
| Bank details      | Masked in API responses                    |
| Cron endpoints    | Bearer token authentication                |

### NFR-5: Compliance

| Standard                       | Status                         |
| ------------------------------ | ------------------------------ |
| PCI-DSS                        | Compliant via Razorpay         |
| India IT Act 2000              | Compliant                      |
| GDPR (for future EU expansion) | Data export/deletion API ready |

---

## 7. Edge Cases & Failure Handling

### Booking Stage

| Scenario                              | System Behavior               | Rationale                                  |
| ------------------------------------- | ----------------------------- | ------------------------------------------ |
| Provider doesn't respond in 2h        | Auto-reject, full refund      | Prevents seeker blocking                   |
| Seeker cancels after provider accepts | Booking fee forfeited         | Compensates provider for reserved capacity |
| Provider cancels after accepting      | Full refund, provider flagged | Protects seeker, tracks reliability        |

### Pickup Stage

| Scenario                           | System Behavior                                    | Rationale                     |
| ---------------------------------- | -------------------------------------------------- | ----------------------------- |
| Provider no-show (GPS check fails) | Auto-cancel, full refund, provider penalty         | Enforces reliability          |
| Seeker unavailable for 15 min      | Booking cancelled, fee forfeited                   | Compensates provider's travel |
| Invoice rejected by seeker         | Clothes returned, booking fee retained by provider | Provider did show up          |

### Delivery Stage

| Scenario                      | System Behavior                                                             | Rationale                                           |
| ----------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------- |
| Late delivery                 | 5% penalty per hour, max 30%                                                | Automatic accountability                            |
| Seeker doesn't confirm in 24h | Auto-confirm (unless complaint raised)                                      | Aligns with escrow window; prevents indefinite hold |
| Payment gateway down          | 3 retries (exponential backoff: 1s, 5s, 25s), SMS fallback link, 24h to pay | Ensures completion                                  |

> **Auto-Confirm Rationale:** Changed from 2h to 24h to align with escrow window. If seeker doesn't confirm within 24h and hasn't filed a complaint, the delivery is auto-confirmed. This matches the escrow release timeline and gives seekers adequate time to inspect items.

### Dispute Stage

| Scenario                         | System Behavior                           | Rationale                  |
| -------------------------------- | ----------------------------------------- | -------------------------- |
| Both parties unresponsive        | Admin unilateral decision after 72h       | Prevents indefinite freeze |
| Complaint raised after 24h       | Rejected (escrow already released)        | Clear window enforcement   |
| Provider disputes admin decision | Appeal process (manual, admin discretion) | Fairness                   |

---

## 8. Metrics & Success Criteria

### North Star Metric

**Monthly Completed Orders (MCO)**

- Month 6 target: 10,000
- Month 12 target: 50,000

### Key Performance Indicators

| Metric                   | Definition                    | Target | Frequency |
| ------------------------ | ----------------------------- | ------ | --------- |
| Booking Conversion       | Bookings → Completed Orders   | >70%   | Weekly    |
| Provider Acceptance Rate | Accepted / Total Bookings     | >85%   | Weekly    |
| On-Time Delivery         | Delivered ≤ Deadline          | >95%   | Weekly    |
| Complaint Rate           | Complaints / Completed Orders | <5%    | Weekly    |
| Dispute Resolution Time  | Avg hours to resolve          | <24h   | Weekly    |
| NPS (Seeker)             | Net Promoter Score            | >50    | Monthly   |
| Provider Churn           | Inactive >30 days             | <10%   | Monthly   |
| Seeker Retention         | Return users in 30 days       | >40%   | Monthly   |

### Guardrail Metrics

| Metric                | Threshold | Action if Breached      |
| --------------------- | --------- | ----------------------- |
| Fraud Rate            | >1%       | Pause onboarding, audit |
| Payment Failure Rate  | >5%       | Investigate gateway     |
| App Crash Rate        | >1%       | Hotfix deploy           |
| Support Ticket Volume | >100/day  | Scale support team      |

---

## 9. Technical Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │ Seeker App │  │Provider App│  │Admin Panel │                │
│  │ (Next.js)  │  │ (Next.js)  │  │ (Next.js)  │                │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘                │
└────────┼───────────────┼───────────────┼────────────────────────┘
         │               │               │
         ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API LAYER                                │
│  Route Handlers • NextAuth • Zod Validation • RBAC Middleware  │
└─────────────────────────────────────────────────────────────────┘
         │
         ├──────────────────┬───────────────────┬─────────────────┐
         ▼                  ▼                   ▼                 ▼
  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   ┌──────────┐
  │  MongoDB    │    │  Razorpay   │    │ Cloudinary  │   │  Twilio  │
  │  Atlas      │    │ + RazorpayX │    │             │   │          │
  └─────────────┘    └─────────────┘    └─────────────┘   └──────────┘
         │
         ▼
  ┌─────────────┐
  │ Cron Jobs   │
  │ (Vercel)    │
  └─────────────┘
```

### Background Jobs

| Job                    | Trigger      | Action                                        |
| ---------------------- | ------------ | --------------------------------------------- |
| `auto-reject-bookings` | Every 5 min  | Reject bookings >2h old without response      |
| `no-show-check`        | Every 5 min  | Flag providers who missed pickup window       |
| `escrow-auto-release`  | Every 15 min | Release funds 24h after delivery confirmation |
| `monitor-abuse`        | Daily        | Flag users with suspicious patterns           |

### Data Models

**Core Entities:**

- `Seeker`: Customer profile, address, verification status
- `Provider`: Business profile, pricing, bank details, capacity
- `Booking`: Pre-order commitment, fee payment, scheduling
- `Order`: Confirmed service, items, payment, escrow state
- `Complaint`: Dispute details, chat messages, resolution

**Key Relationships:**

```
Seeker 1──────N Booking N──────1 Provider
                  │
                  ▼
              Order 1──────1 Complaint (optional)
```

---

## 10. API Contracts

### Core Endpoints

| Method | Endpoint                             | Description            | Auth     |
| ------ | ------------------------------------ | ---------------------- | -------- |
| POST   | `/api/bookings`                      | Create booking         | Seeker   |
| POST   | `/api/bookings/[id]/accept`          | Accept booking         | Provider |
| POST   | `/api/bookings/[id]/reject`          | Reject booking         | Provider |
| POST   | `/api/bookings/[id]/schedule`        | Propose/confirm pickup | Both     |
| POST   | `/api/bookings/[id]/invoice`         | Create invoice         | Provider |
| POST   | `/api/bookings/[id]/invoice/review`  | Approve/reject invoice | Seeker   |
| POST   | `/api/orders/[id]/payment/init`      | Initialize payment     | Seeker   |
| POST   | `/api/orders/[id]/payment/verify`    | Verify payment         | System   |
| POST   | `/api/orders/[id]/status`            | Update order status    | Provider |
| POST   | `/api/orders/[id]/confirm-delivery`  | OTP confirmation       | Seeker   |
| POST   | `/api/complaints`                    | File complaint         | Seeker   |
| POST   | `/api/admin/complaints/[id]/resolve` | Resolve dispute        | Admin    |

### Cron Endpoints

All cron endpoints require `Authorization: Bearer <CRON_SECRET>` header.

| Method | Endpoint                         | Schedule     | Description                             |
| ------ | -------------------------------- | ------------ | --------------------------------------- |
| GET    | `/api/cron/auto-reject-bookings` | Every 5 min  | Reject bookings >2h without response    |
| GET    | `/api/cron/no-show`              | Every 5 min  | Flag providers who missed pickup window |
| GET    | `/api/cron/release-payouts`      | Every 15 min | Release escrow 24h after delivery       |
| GET    | `/api/cron/process-payouts`      | Every 15 min | Execute RazorpayX payouts to providers  |
| GET    | `/api/cron/monitor-abuse`        | Daily 2 AM   | Flag users with suspicious patterns     |

### Response Codes

| Code | Meaning                            |
| ---- | ---------------------------------- |
| 200  | Success                            |
| 201  | Created                            |
| 400  | Validation error                   |
| 401  | Unauthorized                       |
| 403  | Forbidden (role mismatch)          |
| 404  | Resource not found                 |
| 409  | Conflict (e.g., duplicate booking) |
| 429  | Rate limited                       |
| 500  | Server error                       |

---

## 11. Implementation Status

### Completed (Production-Ready)

| Component          | Files                                              | Notes                           |
| ------------------ | -------------------------------------------------- | ------------------------------- |
| Authentication     | `app/api/auth/`, `lib/otp.ts`                      | NextAuth + OTP + Magic Link     |
| Provider Discovery | `app/api/providers/`                               | Capacity filtering active       |
| Booking Flow       | `app/api/bookings/`                                | Full lifecycle with auto-reject |
| Invoice/Order      | `app/api/bookings/[id]/invoice/`                   | Photo upload via Cloudinary     |
| Payment            | `lib/razorpay.ts`                                  | Orders + Signature verification |
| Escrow             | `lib/db.ts`, `cron/escrow-auto-release.ts`         | 24h hold, auto-release          |
| Disputes           | `app/api/complaints/`, `app/api/admin/complaints/` | Three-way chat, resolution      |
| Payouts            | `app/api/cron/process-payouts/`                    | RazorpayX integration           |

### Planned (Post-MVP)

| Feature                           | Rationale for Deferral                                |
| --------------------------------- | ----------------------------------------------------- |
| Deadline-based provider filtering | Field exists; filtering logic deferred for simplicity |
| Dynamic robots.txt/sitemap.ts     | Static files sufficient for launch                    |
| JSON-LD structured data           | SEO optimization post-PMF                             |
| Native mobile apps                | PWA sufficient for MVP validation                     |
| AI clothing detection             | Manual entry builds training dataset                  |

---

## 12. Risks & Mitigations

| Risk                            | Probability | Impact   | Mitigation                                             |
| ------------------------------- | ----------- | -------- | ------------------------------------------------------ |
| Provider supply shortage        | Medium      | High     | Aggressive onboarding incentives; referral bonuses     |
| Payment gateway downtime        | Low         | Critical | Fallback payment link via SMS                          |
| Fraudulent providers            | Medium      | High     | ID verification; escrow; review monitoring             |
| Seeker abuse (false complaints) | Medium      | Medium   | Pattern detection; privilege revocation                |
| Competitor entry                | High        | Medium   | Focus on escrow + dispute resolution as differentiator |

---

## 13. Appendix

### Glossary

| Term     | Definition                                           |
| -------- | ---------------------------------------------------- |
| Booking  | Pre-order commitment with deadline and booking fee   |
| Order    | Confirmed service after invoice approval             |
| Escrow   | Funds held by platform until complaint window closes |
| No-Show  | Provider failure to arrive at confirmed pickup time  |
| Deadline | Maximum date by which laundry must be delivered      |

### Revision History

| Version | Date       | Changes                                         |
| ------- | ---------- | ----------------------------------------------- |
| 1.0     | 2025-12-21 | Initial draft                                   |
| 2.0     | 2025-12-21 | Full specifications                             |
| 3.0     | 2025-12-29 | Implementation audit                            |
| 3.4     | 2026-01-04 | Codebase verification, false claims corrected   |
| 4.0     | 2026-01-06 | FAANG-grade rewrite, streamlined for production |

---

**Document Status:** ✅ Approved for Production

**Sign-off:**

- [x] Engineering Lead
- [ ] Product Lead
- [ ] Design Lead
