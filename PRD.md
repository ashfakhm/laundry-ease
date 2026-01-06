# Product Requirements Document: LaundryEase# Product Requirements Document: LaundryEase

**Version:** 5.0 **Version:** 4.0

**Last Updated:** 2026-01-06 **Last Updated:** 2026-01-06

**Status:** Final — Approved for Production **Status:** Production-Ready

**Document Authority:** This PRD authorizes engineering execution.**Author:** Engineering Team

---

## 1. Executive Narrative## 1. Problem Statement

LaundryEase eliminates the 2-4 hours urban professionals lose weekly to laundry logistics by connecting them with verified local providers through a trust-first marketplace. The system holds payment in escrow until the customer confirms satisfaction, resolves disputes with photo evidence and admin mediation, and automates provider payouts. This approach is inevitable because the alternatives—physical shop visits, cash payments, zero accountability—cannot survive the expectations of a generation that orders groceries in 10 minutes. We are not building a laundry app. We are building the financial and operational infrastructure that makes doorstep laundry trustworthy at scale.### The Core Problem

---Urban professionals in India lose 2-4 hours per week to laundry logistics. This time cost compounds: a ₹24L/year employee loses ₹15,000+ annually in opportunity cost to laundry errands alone.

## 2. Problem StatementTraditional laundry services fail in five predictable ways:

### The Problem| Failure Mode | Measured Impact | Affected Population |

| ------------------------------ | ---------------------------------- | --------------------- |

Urban professionals in Tier-1 Indian cities spend 2-4 hours per week on laundry logistics. This time has measurable opportunity cost: a ₹24L/year employee loses approximately ₹15,000 annually to laundry errands alone.| Physical shop visits required | 2-4 hours/week lost | 100% of users |

| No deadline guarantees | 34% report missed events | Working professionals |

Traditional laundry services fail predictably:| Opaque pricing | 67% frustrated by surprise charges | All customers |

| Zero accountability for damage | 12% experienced loss | All customers |

| Failure Mode | Measured Impact | Why It Persists || Cash-only operations | 78% prefer digital payment | Urban demographic |

|--------------|-----------------|-----------------|

| Physical shop visits required | 2-4 hours/week lost | No digital presence |### Why This Matters Now

| No deadline guarantees | 34% report missed events | No accountability mechanism |

| Opaque pricing | 67% surprised by final bill | No itemization before pickup |India's urban laundry market is ₹15,000 Cr. The demographic shift toward dual-income households and the post-COVID normalization of doorstep services creates a timing window for a well-engineered solution.

| Zero accountability for damage | 12% experienced uncompensated loss | No evidence, no escrow |

| Cash-only operations | 78% prefer digital payment | No payment infrastructure |### Success Criteria

### AssumptionsThis product succeeds if:

1. Target users own smartphones with stable internet access1. **Booking conversion rate** exceeds 70% (booking → completed order)

2. Target users are comfortable with UPI/digital payments2. **Provider acceptance rate** exceeds 85%

3. Local laundry providers will adopt digital tools for incremental revenue3. **On-time delivery rate** exceeds 95%

4. 24-hour escrow window is sufficient for complaint identification4. **Complaint rate** stays below 5%

5. Photo evidence is adequate for dispute resolution (no video required)5. **Dispute resolution** averages under 24 hours

### What Failure Looks Like Today---

A customer drops off clothes. The shop loses a shirt. The customer has no receipt, no photos, no recourse. The shop denies responsibility. The customer never returns. The shop loses lifetime value. Both parties lose. This happens thousands of times daily across India. Our system makes this failure mode impossible.## 2. Goals and Non-Goals

---### Goals

## 3. Goals vs Non-Goals1. **Eliminate seeker travel** — 100% doorstep pickup and delivery

2. **Guarantee deadlines** — Provider commits to completion date; penalties for late delivery

### Goals3. **Protect payments** — Escrow holds funds until seeker confirms satisfaction

4. **Enable fair dispute resolution** — Photo evidence + admin mediation

| Goal | Success Measure | Why It Matters |5. **Provide predictable pricing** — All costs visible before booking

|------|-----------------|----------------|

| Eliminate seeker travel | 100% doorstep service | Core value proposition |### Non-Goals (Explicitly Out of Scope)

| Guarantee deadlines | Late delivery triggers automatic penalty | Creates accountability |

| Protect payments | Escrow until satisfaction confirmed | Builds trust |1. **AI-powered clothing detection** — Manual itemization for MVP; dataset collection for future

| Enable fair disputes | Photo evidence + admin mediation | Resolves conflicts |2. **Route optimization** — Providers manage their own logistics

| Predictable pricing | All costs visible before booking | No surprise bills |3. **Subscription models** — Per-order pricing only

4. **Native mobile apps** — PWA via Next.js; native apps post-PMF

### Non-Goals (Explicit Exclusions)5. **Multi-city operations** — Bangalore only for launch

6. **Real-time chat** — Async messaging sufficient for dispute resolution

| Exclusion | Rationale |

|-----------|-----------|---

| AI clothing detection | Manual entry builds training data; defer to post-PMF |

| Route optimization | Providers manage own logistics; not our problem |## 3. User Personas

| Subscription models | Per-order pricing validates unit economics first |

| Native mobile apps | PWA sufficient for MVP; native apps after PMF |### Primary: The Time-Starved Professional (Seeker)

| Multi-city operations | Bangalore only until playbook proven |

| Real-time chat | Async messaging sufficient for disputes || Attribute | Value |

| GPS verification at pickup | Browser geolocation unreliable indoors; defer to post-MVP || -------------------------- | ----------------------------------------------------------- |

| Age | 25-45 |

---| Income | ₹8L+/year |

| Location | Tier-1 Indian cities |

## 4. User Personas| Tech comfort | High (daily UPI, Swiggy/Zepto user) |

| Laundry frequency | 2-3 times/month |

### Seeker (Primary)| Primary motivation | Reclaim personal time |

| Willingness to pay premium | Yes, for reliability |

**Profile:** Urban professional, age 25-45, income ₹8L+/year, high smartphone fluency.| Key frustration | "I've lost clothes at local shops with zero accountability" |

**Goals:\*\***Job to be Done:\*\*

- Reclaim 2-4 hours weekly"When I have a busy week, I want my laundry handled without my involvement, so I can focus on higher-priority work."

- Never lose clothes without recourse

- Know exact cost before committing### Secondary: The Professional Provider

**Pain Points:**| Attribute | Value |

- Has lost items with zero accountability| ------------------ | ------------------------------------------------------ |

- Hates surprise charges| Age | 30-55 |

- Distrusts cash-only shops| Business type | Established laundry shop (5+ years) |

| Staff | 2-5 employees |

**Assumptions:**| Current revenue | ₹50K-150K/month |

- Willing to pay premium for reliability| Tech comfort | Medium (WhatsApp, Paytm) |

- Prefers digital payment over cash| Primary motivation | Expand customer base without storefront investment |

- Values time over marginal cost savings| Key frustration | "Walk-in traffic is declining; I need online presence" |

**Job to Be Done:** **Job to be Done:**

"When I have a busy week, I want my laundry handled without my involvement, so I can focus on what matters.""When I have spare capacity, I want to fill it with reliable customers, so I can grow revenue without new physical locations."

---### Tertiary: Platform Admin

### Provider (Secondary)| Attribute | Value |

| ---------------- | ------------------------------------------------------------------- |

**Profile:** Established laundry shop owner, age 30-55, 2-5 employees, ₹50K-150K/month revenue.| Role | Operations Manager |

| Responsibilities | Dispute resolution, fraud prevention, provider quality |

**Goals:**| KPIs | Resolution time <24h, Fraud rate <0.5%, Provider churn <5%/month |

- Fill spare capacity without storefront investment| Capabilities | User management, payment control, complaint resolution, system logs |

- Receive guaranteed payments

- Build online reputation---

**Pain Points:**## 4. User Flows

- Walk-in traffic declining

- Payment collection unreliable### 4.1 Seeker: Discovery → Booking → Delivery

- No way to showcase quality

**Preconditions:** Seeker is authenticated, location set, phone/email verified.

**Assumptions:**

- Can operate smartphone for order management```

- Has bank account for payouts1. Seeker opens Search page

- Willing to accept 5% platform commission2. System displays providers within service radius, sorted by: Rating > Distance > Price

3. System filters out providers where activeOrders >= maxCapacity

**Job to Be Done:** 4. Seeker selects provider, views profile (pricing, reviews, delivery times)

"When I have spare capacity, I want to fill it with reliable customers, so I can grow revenue without new locations."5. Seeker clicks "Book Now"

6. System displays booking modal with:

--- - Provider's booking fee (provider-defined minimum)

- Estimated delivery charge based on distance

### Admin (Tertiary) - Optional deadline selection

7. Seeker confirms and pays booking fee via Razorpay

**Profile:** Operations manager responsible for platform health.8. System creates booking (status: REQUESTED)

9. Provider receives notification

**Goals:**10. Provider accepts within 2h (or system auto-rejects with full refund)

- Resolve disputes within 24 hours11. Provider proposes pickup slot

- Maintain fraud rate below 0.5%12. Seeker confirms availability

- Keep provider churn below 5%/month13. Provider arrives at scheduled time (GPS verified)

14. Provider photographs items and creates itemized invoice

**Pain Points:**15. Seeker reviews invoice (approve / reject / request edit)

- Incomplete evidence from users16. On approval: booking converts to Order; seeker pays order total

- Ambiguous damage claims17. Provider processes laundry, updates status (WASHING → IRONING → READY)

- Time pressure on resolutions18. Provider proposes delivery slot

19. Seeker confirms; provider delivers

**Assumptions:**20. Seeker enters OTP to confirm receipt

- Has authority to issue refunds up to order value21. System starts 24h escrow window

- Can access all order data and photos22. If no complaint: funds auto-release to provider (minus 5% commission)

- Available during business hours IST23. If complaint: escrow frozen until admin resolution

```

---

**Edge Cases:**

## 5. Core User Flows

- Provider doesn't respond in 2h → Auto-reject, full refund

### 5.1 Seeker: Discovery → Booking → Delivery- Provider no-show at pickup → Refund + provider penalty

- Seeker no-show at pickup → Booking fee forfeited

**Preconditions:** Authenticated, location set, phone verified.- Invoice rejected → Clothes returned, booking fee retained by provider

- Complaint raised → Escrow frozen, admin resolves

```

STATE: BROWSING### 4.2 Provider: Booking Management → Invoice → Payout

│

├─ Seeker opens search page**Preconditions:** Provider authenticated, profile complete, bank details verified.

├─ System displays providers within service radius

│ └─ Sorted: Rating > Distance > Price```

│ └─ Filtered: activeOrders < maxCapacity1. Provider receives booking notification

├─ Seeker selects provider, views profile2. Provider views seeker location, requested deadline

│3. Provider accepts or rejects (2h SLA)

▼4. If accepted: Provider proposes pickup date/time

STATE: BOOKING_INITIATED5. Seeker confirms → booking status: CONFIRMED

│6. Provider travels to pickup location

├─ Seeker clicks "Book Now"7. Provider marks "Arrived" (GPS verified within 200m)

├─ System displays booking modal:8. Provider photographs each item, creates invoice with:

│ ├─ Booking fee (provider-defined) - Item name (from price list or "Other")

│ ├─ Estimated delivery charge - Quantity

│ └─ Optional deadline selection - Unit price (auto-filled from profile; manual for "Other" items)

├─ Seeker pays booking fee via Razorpay - Notes (stains, special instructions)

│ - Photo (mandatory per item)

▼9. Seeker reviews and approves invoice

STATE: REQUESTED10. System creates Order, seeker pays

│11. Provider processes laundry

├─ Provider receives notification12. Provider updates status: PICKED_UP → WASHING → IRONING → READY

├─ Provider has 2 hours to respond13. Provider proposes delivery date/time

│ ├─ ACCEPT → STATE: ACCEPTED14. Seeker confirms

│ ├─ REJECT → STATE: CANCELLED (full refund)15. Provider delivers, seeker enters OTP

│ └─ NO RESPONSE → STATE: CANCELLED (auto-reject, full refund)16. 24h escrow window begins

│17. If no complaint: Cron job releases funds to provider bank account

▼18. Provider receives 95% (5% platform commission deducted)

STATE: ACCEPTED```

│

├─ Provider proposes pickup slot**Edge Cases:**

├─ Seeker confirms availability

│- Seeker unreachable at pickup → Wait 15 min, mark "Seeker Unavailable", booking cancelled, fee forfeited

▼- Late delivery → 5% penalty per hour, max 30%

STATE: SCHEDULED- Complaint raised → Payout frozen until resolution

│

├─ Provider arrives at scheduled time### 4.3 Admin: Dispute Resolution

├─ Provider marks "Arrived" in app

├─ Provider photographs each item**Preconditions:** Admin authenticated with super-admin role.

├─ Provider creates itemized invoice

│```

▼1. Seeker raises complaint (within 24h escrow window)

STATE: INVOICE_PENDING2. System immediately freezes escrow

│3. Complaint appears in Admin dashboard

├─ Seeker reviews invoice4. Admin reviews:

│ ├─ APPROVE → STATE: INVOICE_APPROVED - Order details and timeline

│ ├─ REJECT → STATE: CANCELLED (clothes returned, booking fee retained) - Invoice with photos

│ └─ REQUEST_EDIT → Provider revises invoice - Complaint description and evidence

│5. Admin opens three-way chat (Seeker + Provider + Admin)

▼6. Admin requests additional information if needed

STATE: INVOICE_APPROVED7. Admin makes resolution decision:

│ - RELEASE_PAYOUT: Provider receives funds

├─ Booking converts to Order - FULL_REFUND: Seeker receives full order amount

├─ Seeker pays order total (minus booking fee already paid) - PARTIAL_REFUND: Admin-determined percentage

│ - REJECT: Complaint dismissed, funds released

▼8. System executes payment action

STATE: PAID9. Chat is permanently closed

│10. Resolution logged for fraud pattern detection

├─ Provider processes laundry```

├─ Provider updates status: PICKED_UP → WASHING → IRONING → READY

│---

▼

STATE: READY## 5. Functional Requirements

│

├─ Provider proposes delivery slot### FR-1: Authentication & Onboarding

├─ Seeker confirms

├─ Provider delivers| ID | Requirement | Priority | Status |

├─ Seeker enters OTP to confirm receipt| ------ | -------------------------------------------------------------------------------------------------- | -------- | -------------- |

│| FR-1.1 | Phone verification via 6-digit OTP (5 min expiry, 3 attempts max) | P0 | ✅ Implemented |

▼| FR-1.2 | Email verification via magic link (24h expiry) | P0 | ✅ Implemented |

STATE: DELIVERED| FR-1.3 | Google OAuth as alternative auth method | P0 | ✅ Implemented |

│| FR-1.4 | Provider must complete profile (location, radius, pricing, bank details) before accepting bookings | P0 | ✅ Implemented |

├─ 24-hour escrow window begins| FR-1.5 | Bank details verified via RazorpayX Contact creation | P0 | ✅ Implemented |

│ ├─ NO COMPLAINT → STATE: COMPLETED (auto-release funds)

│ └─ COMPLAINT FILED → STATE: DISPUTED (escrow frozen)### FR-2: Provider Discovery

│

▼| ID | Requirement | Priority | Status |

STATE: COMPLETED or DISPUTED| ------ | ------------------------------------------------------------------------------- | -------- | -------------- |

````| FR-2.1 | Search by seeker location; show only providers whose radius covers seeker       | P0       | ✅ Implemented |

| FR-2.2 | Filter out providers where activeOrders >= maxCapacity                          | P0       | ✅ Implemented |

**Edge Cases Handled:**| FR-2.3 | Sort results by Rating > Distance > Price                                       | P0       | ✅ Implemented |

| FR-2.4 | Display provider profile: name, rating, review count, pricing, delivery charges | P0       | ✅ Implemented |

| Scenario | System Behavior || FR-2.5 | Deadline-based filtering (hide providers who can't meet deadline)               | P1       | ⏳ Planned     |

|----------|-----------------|

| Provider no-show at pickup | Seeker reports; admin reviews; full refund if confirmed |### FR-3: Booking Flow

| Seeker unavailable at pickup (15 min) | Booking cancelled, booking fee forfeited |

| Invoice rejected | Clothes returned, booking fee retained by provider || ID     | Requirement                                                    | Priority | Status         |

| Late delivery | 5% penalty per hour, max 30%, deducted from provider payout || ------ | -------------------------------------------------------------- | -------- | -------------- |

| Seeker doesn't confirm delivery in 24h | Auto-confirm unless complaint filed || FR-3.1 | Create booking with provider-defined booking fee               | P0       | ✅ Implemented |

| FR-3.2 | Booking fee payment via Razorpay Orders                        | P0       | ✅ Implemented |

---| FR-3.3 | Provider accept/reject with 2h SLA                             | P0       | ✅ Implemented |

| FR-3.4 | Auto-reject on timeout with full refund                        | P0       | ✅ Implemented |

### 5.2 Provider: Booking Management → Invoice → Payout| FR-3.5 | Pickup scheduling (propose → confirm)                          | P0       | ✅ Implemented |

| FR-3.6 | No-show detection via GPS verification (200m radius)           | P0       | ⚠️ Deferred    |

**Preconditions:** Authenticated, profile complete, bank details verified via RazorpayX.| FR-3.7 | Seeker cancellation (pre-accept: refund; post-accept: forfeit) | P0       | ✅ Implemented |



```> **FR-3.6 Deferral Note:** GPS verification requires browser Geolocation API with user permission. Implementation deferred to post-MVP due to: (1) indoor GPS accuracy typically ±50m, making 200m radius unreliable; (2) user permission denial handling complexity; (3) GPS spoofing detection requires device attestation. For MVP, provider self-reports arrival and seeker confirms via app notification. Manual dispute resolution handles no-show claims with photo evidence.

STATE: IDLE

│### FR-4: Invoice & Order

├─ Provider receives booking notification

├─ Provider views seeker location, deadline| ID     | Requirement                                                        | Priority | Status         |

│| ------ | ------------------------------------------------------------------ | -------- | -------------- |

▼| FR-4.1 | Provider creates itemized invoice at pickup                        | P0       | ✅ Implemented |

STATE: DECISION_PENDING| FR-4.2 | Mandatory photo per item                                           | P0       | ✅ Implemented |

│| FR-4.3 | Prices auto-filled from provider profile (manual only for "Other") | P0       | ✅ Implemented |

├─ Provider accepts or rejects (2h SLA)| FR-4.4 | Seeker approve/reject/edit invoice                                 | P0       | ✅ Implemented |

│  ├─ ACCEPT → propose pickup slot| FR-4.5 | Approved invoice converts to Order                                 | P0       | ✅ Implemented |

│  └─ REJECT → booking cancelled, seeker refunded| FR-4.6 | Booking fee deducted from order total                              | P0       | ✅ Implemented |

│

▼### FR-5: Order Processing

STATE: PICKUP_SCHEDULED

│| ID     | Requirement                                                              | Priority | Status         |

├─ Provider travels to pickup location| ------ | ------------------------------------------------------------------------ | -------- | -------------- |

├─ Provider marks "Arrived"| FR-5.1 | Order status tracking: PICKED_UP → WASHING → IRONING → READY → DELIVERED | P0       | ✅ Implemented |

├─ Provider photographs each item:| FR-5.2 | Delivery scheduling (propose → confirm)                                  | P0       | ✅ Implemented |

│  ├─ Item name (from price list or "Other")| FR-5.3 | Delivery confirmation via OTP                                            | P0       | ✅ Implemented |

│  ├─ Quantity| FR-5.4 | Late delivery penalty: 5% per hour, max 30%                              | P1       | ✅ Implemented |

│  ├─ Unit price (auto-filled; manual for "Other")

│  ├─ Notes (stains, damage)> **FR-5.4 Late Delivery Penalty Specification:**

│  └─ Photo (mandatory)>

│> - **Deadline Definition:** Provider-committed delivery date/time set during pickup scheduling

▼> - **Penalty Application:** Deducted from provider payout (not refunded to seeker)

STATE: INVOICE_SUBMITTED> - **Calculation:** 5% of order total per hour late, capped at 30%

│> - **Edge Cases:**

├─ Seeker reviews and approves>   - If no deadline explicitly set: No penalty applies (encourage deadline setting in future)

├─ Order created, seeker pays>   - If seeker unavailable at delivery: Clock pauses until new slot confirmed

│>   - 24h escrow window starts from actual delivery time, not original deadline

▼

STATE: PROCESSING### FR-6: Payment & Escrow

│

├─ Provider updates status as work progresses| ID     | Requirement                                                | Priority | Status         |

├─ Provider proposes delivery slot| ------ | ---------------------------------------------------------- | -------- | -------------- |

├─ Seeker confirms| FR-6.1 | Order payment via Razorpay Orders                          | P0       | ✅ Implemented |

│| FR-6.2 | 24h escrow hold post-delivery                              | P0       | ✅ Implemented |

▼| FR-6.3 | Auto-release via cron job if no complaint                  | P0       | ✅ Implemented |

STATE: DELIVERING| FR-6.4 | Payout to provider via RazorpayX (95% after 5% commission) | P0       | ✅ Implemented |

│| FR-6.5 | Escrow freeze on complaint                                 | P0       | ✅ Implemented |

├─ Provider delivers

├─ Seeker enters OTP### FR-7: Dispute Resolution

│

▼| ID     | Requirement                                                       | Priority | Status         |

STATE: DELIVERED| ------ | ----------------------------------------------------------------- | -------- | -------------- |

│| FR-7.1 | Complaint filing within 24h escrow window                         | P0       | ✅ Implemented |

├─ 24h escrow window| FR-7.2 | One complaint per order (enforced at API)                         | P0       | ✅ Implemented |

│  ├─ NO COMPLAINT → funds released (95% after 5% commission)| FR-7.3 | Three-way chat (Seeker + Provider + Admin)                        | P0       | ✅ Implemented |

│  └─ COMPLAINT → funds frozen until resolution| FR-7.4 | Admin resolution: release / refund_full / refund_partial / reject | P0       | ✅ Implemented |

│| FR-7.5 | Chat permanently closed after resolution                          | P0       | ✅ Implemented |

▼

STATE: PAID_OUT or DISPUTED### FR-8: Reviews

````

| ID | Requirement | Priority | Status |

---| ------ | --------------------------------------------- | -------- | -------------- |

| FR-8.1 | Review submission only after order completion | P1 | ✅ Implemented |

### 5.3 Admin: Dispute Resolution| FR-8.2 | 1-5 star rating + text review | P1 | ✅ Implemented |

| FR-8.3 | Reviews displayed on provider profile | P1 | ✅ Implemented |

**Preconditions:** Admin authenticated with super-admin role.

---

````

STATE: COMPLAINT_FILED## 6. Non-Functional Requirements

│

├─ System freezes escrow immediately### NFR-1: Performance

├─ Complaint appears in admin dashboard

│| Requirement               | Target | Measurement |

▼| ------------------------- | ------ | ----------- |

STATE: UNDER_REVIEW| API response time (p95)   | <500ms | Monitoring  |

│| Time to First Byte        | <200ms | Lighthouse  |

├─ Admin reviews:| Largest Contentful Paint  | <2.5s  | Lighthouse  |

│  ├─ Order timeline| Database query time (p95) | <100ms | Monitoring  |

│  ├─ Invoice with photos

│  ├─ Complaint description and evidence### NFR-2: Scalability

│  ├─ Chat history (if any)

│| Requirement       | Target                      |

▼| ----------------- | --------------------------- |

STATE: GATHERING_INFO| Concurrent users  | 10,000                      |

│| Monthly orders    | 50,000                      |

├─ Admin opens three-way chat (Seeker + Provider + Admin)| Provider capacity | 10 concurrent bookings each |

├─ Admin requests additional information if needed| Database size     | 100GB (3 year projection)   |

├─ 72h deadline for responses

│### NFR-3: Availability

▼

STATE: RESOLUTION| Requirement                | Target            |

│| -------------------------- | ----------------- |

├─ Admin decides:| Uptime                     | 99.9%             |

│  ├─ RELEASE_PAYOUT → Provider receives funds| Planned maintenance window | Sunday 2-4 AM IST |

│  ├─ FULL_REFUND → Seeker receives full order amount| Recovery Time Objective    | <1 hour           |

│  ├─ PARTIAL_REFUND → Admin-determined split| Recovery Point Objective   | <5 minutes        |

│  └─ REJECT_COMPLAINT → Funds released to provider

├─ System executes payment action### NFR-4: Security

├─ Chat permanently closed

├─ Resolution logged for pattern detection| Requirement       | Implementation                             |

│| ----------------- | ------------------------------------------ |

▼| Authentication    | NextAuth.js with JWT; 7-day expiry         |

STATE: RESOLVED| Authorization     | Role-based middleware per route            |

```| Password policy   | 8+ chars, 1 uppercase, 1 number, 1 special |

| OTP security      | Rate limited (3 attempts), 5 min expiry    |

---| API rate limiting | 100 req/min per user                       |

| Payment data      | Never stored; Razorpay tokenization        |

## 6. Functional Requirements| Bank details      | Masked in API responses                    |

| Cron endpoints    | Bearer token authentication                |

### FR-1: Authentication & Onboarding

### NFR-5: Compliance

| ID | Requirement | Testable Criteria | Status |

|----|-------------|-------------------|--------|| Standard                       | Status                         |

| FR-1.1 | Phone verification via 6-digit OTP | OTP expires in 5 min; max 3 attempts | ✅ Implemented || ------------------------------ | ------------------------------ |

| FR-1.2 | Email verification via magic link | Link expires in 24h | ✅ Implemented || PCI-DSS                        | Compliant via Razorpay         |

| FR-1.3 | Google OAuth as alternative | OAuth flow completes in <3s | ✅ Implemented || India IT Act 2000              | Compliant                      |

| FR-1.4 | Provider profile completion required | Cannot accept bookings until complete | ✅ Implemented || GDPR (for future EU expansion) | Data export/deletion API ready |

| FR-1.5 | Bank details verified via RazorpayX Contact | Contact creation succeeds or errors | ✅ Implemented |

---

### FR-2: Provider Discovery

## 7. Edge Cases & Failure Handling

| ID | Requirement | Testable Criteria | Status |

|----|-------------|-------------------|--------|### Booking Stage

| FR-2.1 | Search by seeker location | Only providers whose radius covers seeker shown | ✅ Implemented |

| FR-2.2 | Capacity filtering | Providers at max capacity hidden | ✅ Implemented || Scenario                              | System Behavior               | Rationale                                  |

| FR-2.3 | Sort by Rating > Distance > Price | Deterministic ordering | ✅ Implemented || ------------------------------------- | ----------------------------- | ------------------------------------------ |

| FR-2.4 | Profile display | Name, rating, reviews, pricing, delivery charges visible | ✅ Implemented || Provider doesn't respond in 2h        | Auto-reject, full refund      | Prevents seeker blocking                   |

| Seeker cancels after provider accepts | Booking fee forfeited         | Compensates provider for reserved capacity |

### FR-3: Booking Flow| Provider cancels after accepting      | Full refund, provider flagged | Protects seeker, tracks reliability        |



| ID | Requirement | Testable Criteria | Status |### Pickup Stage

|----|-------------|-------------------|--------|

| FR-3.1 | Create booking with provider-defined fee | Fee matches provider profile | ✅ Implemented || Scenario                           | System Behavior                                    | Rationale                     |

| FR-3.2 | Payment via Razorpay Orders | Signature verification passes | ✅ Implemented || ---------------------------------- | -------------------------------------------------- | ----------------------------- |

| FR-3.3 | Provider accept/reject within 2h | SLA enforced by cron | ✅ Implemented || Provider no-show (GPS check fails) | Auto-cancel, full refund, provider penalty         | Enforces reliability          |

| FR-3.4 | Auto-reject on timeout | Full refund issued automatically | ✅ Implemented || Seeker unavailable for 15 min      | Booking cancelled, fee forfeited                   | Compensates provider's travel |

| FR-3.5 | Pickup scheduling | Propose/confirm handshake works | ✅ Implemented || Invoice rejected by seeker         | Clothes returned, booking fee retained by provider | Provider did show up          |

| FR-3.6 | Seeker cancellation rules | Pre-accept: refund; post-accept: forfeit | ✅ Implemented |

### Delivery Stage

### FR-4: Invoice & Order

| Scenario                      | System Behavior                                                             | Rationale                                           |

| ID | Requirement | Testable Criteria | Status || ----------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------- |

|----|-------------|-------------------|--------|| Late delivery                 | 5% penalty per hour, max 30%                                                | Automatic accountability                            |

| FR-4.1 | Itemized invoice at pickup | Each item has name, qty, price, photo | ✅ Implemented || Seeker doesn't confirm in 24h | Auto-confirm (unless complaint raised)                                      | Aligns with escrow window; prevents indefinite hold |

| FR-4.2 | Mandatory photo per item | API rejects invoice without photos | ✅ Implemented || Payment gateway down          | 3 retries (exponential backoff: 1s, 5s, 25s), SMS fallback link, 24h to pay | Ensures completion                                  |

| FR-4.3 | Price auto-fill from profile | "Other" items require manual entry | ✅ Implemented |

| FR-4.4 | Seeker approve/reject/edit | All three actions work | ✅ Implemented |> **Auto-Confirm Rationale:** Changed from 2h to 24h to align with escrow window. If seeker doesn't confirm within 24h and hasn't filed a complaint, the delivery is auto-confirmed. This matches the escrow release timeline and gives seekers adequate time to inspect items.

| FR-4.5 | Approved invoice → Order | State transition is atomic | ✅ Implemented |

| FR-4.6 | Booking fee deducted from total | Math is correct | ✅ Implemented |### Dispute Stage



### FR-5: Order Processing & Delivery| Scenario                         | System Behavior                           | Rationale                  |

| -------------------------------- | ----------------------------------------- | -------------------------- |

| ID | Requirement | Testable Criteria | Status || Both parties unresponsive        | Admin unilateral decision after 72h       | Prevents indefinite freeze |

|----|-------------|-------------------|--------|| Complaint raised after 24h       | Rejected (escrow already released)        | Clear window enforcement   |

| FR-5.1 | Status tracking | PICKED_UP → WASHING → IRONING → READY → DELIVERED | ✅ Implemented || Provider disputes admin decision | Appeal process (manual, admin discretion) | Fairness                   |

| FR-5.2 | Delivery scheduling | Propose/confirm handshake works | ✅ Implemented |

| FR-5.3 | OTP delivery confirmation | 6-digit OTP validates delivery | ✅ Implemented |---

| FR-5.4 | Late delivery penalty | 5% per hour, max 30%, deducted from payout | ✅ Implemented |

## 8. Metrics & Success Criteria

### FR-6: Payment & Escrow

### North Star Metric

| ID | Requirement | Testable Criteria | Status |

|----|-------------|-------------------|--------|**Monthly Completed Orders (MCO)**

| FR-6.1 | Order payment via Razorpay | Signature verification passes | ✅ Implemented |

| FR-6.2 | 24h escrow hold post-delivery | Timer starts on OTP confirmation | ✅ Implemented |- Month 6 target: 10,000

| FR-6.3 | Auto-release via cron | Funds released if no complaint | ✅ Implemented |- Month 12 target: 50,000

| FR-6.4 | Provider payout via RazorpayX | 95% after 5% commission | ✅ Implemented |

| FR-6.5 | Escrow freeze on complaint | Immediate freeze, no exceptions | ✅ Implemented |### Key Performance Indicators



### FR-7: Dispute Resolution| Metric                   | Definition                    | Target | Frequency |

| ------------------------ | ----------------------------- | ------ | --------- |

| ID | Requirement | Testable Criteria | Status || Booking Conversion       | Bookings → Completed Orders   | >70%   | Weekly    |

|----|-------------|-------------------|--------|| Provider Acceptance Rate | Accepted / Total Bookings     | >85%   | Weekly    |

| FR-7.1 | Complaint within 24h window | API rejects late complaints | ✅ Implemented || On-Time Delivery         | Delivered ≤ Deadline          | >95%   | Weekly    |

| FR-7.2 | One complaint per order | API enforces uniqueness | ✅ Implemented || Complaint Rate           | Complaints / Completed Orders | <5%    | Weekly    |

| FR-7.3 | Three-way chat | Seeker, Provider, Admin can message | ✅ Implemented || Dispute Resolution Time  | Avg hours to resolve          | <24h   | Weekly    |

| FR-7.4 | Admin resolution actions | release/refund_full/refund_partial/reject work | ✅ Implemented || NPS (Seeker)             | Net Promoter Score            | >50    | Monthly   |

| FR-7.5 | Chat closes after resolution | No new messages accepted | ✅ Implemented || Provider Churn           | Inactive >30 days             | <10%   | Monthly   |

| Seeker Retention         | Return users in 30 days       | >40%   | Monthly   |

### FR-8: Reviews

### Guardrail Metrics

| ID | Requirement | Testable Criteria | Status |

|----|-------------|-------------------|--------|| Metric                | Threshold | Action if Breached      |

| FR-8.1 | Review after completion only | API rejects pre-completion reviews | ✅ Implemented || --------------------- | --------- | ----------------------- |

| FR-8.2 | 1-5 star rating + text | Both required | ✅ Implemented || Fraud Rate            | >1%       | Pause onboarding, audit |

| FR-8.3 | Reviews on provider profile | Displayed with date, rating, text | ✅ Implemented || Payment Failure Rate  | >5%       | Investigate gateway     |

| App Crash Rate        | >1%       | Hotfix deploy           |

---| Support Ticket Volume | >100/day  | Scale support team      |



## 7. Non-Functional Requirements---



### NFR-1: Performance## 9. Technical Architecture



| Metric | Target | Measurement Method |### System Components

|--------|--------|-------------------|

| API response time (p95) | <500ms | Application monitoring |```

| Time to First Byte | <200ms | Lighthouse |┌─────────────────────────────────────────────────────────────────┐

| Largest Contentful Paint | <2.5s | Lighthouse |│                        CLIENT LAYER                             │

| Database query time (p95) | <100ms | Query profiling |│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │

│  │ Seeker App │  │Provider App│  │Admin Panel │                │

### NFR-2: Scalability│  │ (Next.js)  │  │ (Next.js)  │  │ (Next.js)  │                │

│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘                │

| Dimension | Target | Rationale |└────────┼───────────────┼───────────────┼────────────────────────┘

|-----------|--------|-----------|         │               │               │

| Concurrent users | 10,000 | 10x expected launch load |         ▼               ▼               ▼

| Monthly orders | 50,000 | Year 1 projection |┌─────────────────────────────────────────────────────────────────┐

| Providers per city | 500 | Market coverage target |│                        API LAYER                                │

| Database size | 100GB | 3-year projection with photos |│  Route Handlers • NextAuth • Zod Validation • RBAC Middleware  │

└─────────────────────────────────────────────────────────────────┘

### NFR-3: Availability         │

         ├──────────────────┬───────────────────┬─────────────────┐

| Metric | Target |         ▼                  ▼                   ▼                 ▼

|--------|--------|  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   ┌──────────┐

| Uptime | 99.9% (8.7h downtime/year max) |  │  MongoDB    │    │  Razorpay   │    │ Cloudinary  │   │  Twilio  │

| Planned maintenance | Sunday 2-4 AM IST |  │  Atlas      │    │ + RazorpayX │    │             │   │          │

| Recovery Time Objective | <1 hour |  └─────────────┘    └─────────────┘    └─────────────┘   └──────────┘

| Recovery Point Objective | <5 minutes |         │

         ▼

### NFR-4: Security  ┌─────────────┐

  │ Cron Jobs   │

| Requirement | Implementation |  │ (Vercel)    │

|-------------|----------------|  └─────────────┘

| Authentication | NextAuth.js with JWT; 7-day session expiry |```

| Authorization | Role-based proxy.ts per route group |

| Password policy | 8+ chars, 1 uppercase, 1 number, 1 special |### Background Jobs

| OTP security | Rate limited (3 attempts), bcrypt-hashed storage |

| API protection | Role validation in every route handler || Job                    | Trigger      | Action                                        |

| Payment data | Never stored; Razorpay handles tokenization || ---------------------- | ------------ | --------------------------------------------- |

| Bank details | Masked in all API responses || `auto-reject-bookings` | Every 5 min  | Reject bookings >2h old without response      |

| Cron endpoints | Bearer token authentication via CRON_SECRET || `no-show-check`        | Every 5 min  | Flag providers who missed pickup window       |

| Secrets | All secrets in environment variables, validated at startup || `escrow-auto-release`  | Every 15 min | Release funds 24h after delivery confirmation |

| `monitor-abuse`        | Daily        | Flag users with suspicious patterns           |

### NFR-5: Compliance

### Data Models

| Standard | Status |

|----------|--------|**Core Entities:**

| PCI-DSS | Compliant via Razorpay (no card data stored) |

| India IT Act 2000 | Compliant |- `Seeker`: Customer profile, address, verification status

| RBI Payment Aggregator Guidelines | Compliant via Razorpay escrow infrastructure |- `Provider`: Business profile, pricing, bank details, capacity

- `Booking`: Pre-order commitment, fee payment, scheduling

---- `Order`: Confirmed service, items, payment, escrow state

- `Complaint`: Dispute details, chat messages, resolution

## 8. Edge Cases & Failure Handling

**Key Relationships:**

### Payment Failures

````

| Scenario | System Behavior | Recovery |Seeker 1──────N Booking N──────1 Provider

|----------|-----------------|----------| │

| Razorpay timeout during booking | Show error, no booking created | User retries | ▼

| Razorpay timeout during order payment | Booking remains; user retries payment | Manual retry via dashboard | Order 1──────1 Complaint (optional)

| Signature verification fails | Payment rejected, order not created | User contacts support |```

| Payout to provider fails | Retry with exponential backoff (3x) | Admin manual intervention |

---

### State Consistency

## 10. API Contracts

| Scenario | System Behavior | Prevention |

|----------|-----------------|------------|### Core Endpoints

| Double payment submission | Idempotency via Razorpay order_id | Order ID checked before creation |

| Complaint after escrow released | API rejects with clear error | 24h window enforced server-side || Method | Endpoint | Description | Auth |

| Provider accepts after timeout | API rejects; booking already cancelled | Status checked before accept || ------ | ------------------------------------ | ---------------------- | -------- |

| POST | `/api/bookings` | Create booking | Seeker |

### Abuse Vectors| POST | `/api/bookings/[id]/accept` | Accept booking | Provider |

| POST | `/api/bookings/[id]/reject` | Reject booking | Provider |

| Vector | Detection | Response || POST | `/api/bookings/[id]/schedule` | Propose/confirm pickup | Both |

|--------|-----------|----------|| POST | `/api/bookings/[id]/invoice` | Create invoice | Provider |

| Fake complaints to delay payout | Pattern detection (>3 complaints/month) | Flag user for review || POST | `/api/bookings/[id]/invoice/review` | Approve/reject invoice | Seeker |

| Provider collusion | Same IP/device for seeker+provider | Admin review, potential ban || POST | `/api/orders/[id]/payment/init` | Initialize payment | Seeker |

| Booking spam | >5 unpaid bookings in 24h | Temporary booking block || POST | `/api/orders/[id]/payment/verify` | Verify payment | System |

| Review manipulation | Multiple reviews from same device | Reviews hidden pending review || POST | `/api/orders/[id]/status` | Update order status | Provider |

| POST | `/api/orders/[id]/confirm-delivery` | OTP confirmation | Seeker |

### Network Failures| POST | `/api/complaints` | File complaint | Seeker |

| POST | `/api/admin/complaints/[id]/resolve` | Resolve dispute | Admin |

| Scenario | System Behavior |

|----------|-----------------|### Cron Endpoints

| Client loses connection during booking | No state change; user retries |

| Server crashes during payout | Cron job retries on next run (idempotent) |All cron endpoints require `Authorization: Bearer <CRON_SECRET>` header.

| Database unavailable | 503 response; automatic retry via client |

| Method | Endpoint | Schedule | Description |

---| ------ | -------------------------------- | ------------ | --------------------------------------- |

| GET | `/api/cron/auto-reject-bookings` | Every 5 min | Reject bookings >2h without response |

## 9. Metrics for Success| GET | `/api/cron/no-show` | Every 5 min | Flag providers who missed pickup window |

| GET | `/api/cron/release-payouts` | Every 15 min | Release escrow 24h after delivery |

### North Star Metric| GET | `/api/cron/process-payouts` | Every 15 min | Execute RazorpayX payouts to providers |

| GET | `/api/cron/monitor-abuse` | Daily 2 AM | Flag users with suspicious patterns |

**Monthly Completed Orders (MCO)**

- Month 3: 2,500### Response Codes

- Month 6: 10,000

- Month 12: 50,000| Code | Meaning |

| ---- | ---------------------------------- |

### Product Metrics| 200 | Success |

| 201 | Created |

| Metric | Definition | Target | Frequency || 400 | Validation error |

|--------|------------|--------|-----------|| 401 | Unauthorized |

| Booking Conversion | Bookings → Completed Orders | >70% | Weekly || 403 | Forbidden (role mismatch) |

| Provider Acceptance | Accepted / Total Bookings | >85% | Weekly || 404 | Resource not found |

| On-Time Delivery | Delivered ≤ Deadline | >95% | Weekly || 409 | Conflict (e.g., duplicate booking) |

| Complaint Rate | Complaints / Completed Orders | <5% | Weekly || 429 | Rate limited |

| Resolution Time | Avg hours to resolve dispute | <24h | Weekly || 500 | Server error |

| NPS (Seeker) | Net Promoter Score | >50 | Monthly |

| Provider Churn | Inactive >30 days | <10% | Monthly |---

| Seeker Retention | Return orders within 30 days | >40% | Monthly |

## 11. Implementation Status

### System Metrics

### Completed (Production-Ready)

| Metric | Target | Alert Threshold |

|--------|--------|-----------------|| Component | Files | Notes |

| API error rate (5xx) | <0.1% | >1% || ------------------ | -------------------------------------------------- | ------------------------------- |

| API latency (p95) | <500ms | >1s || Authentication | `app/api/auth/`, `lib/otp.ts` | NextAuth + OTP + Magic Link |

| Cron job success rate | 100% | <95% || Provider Discovery | `app/api/providers/` | Capacity filtering active |

| Payment success rate | >98% | <95% || Booking Flow | `app/api/bookings/` | Full lifecycle with auto-reject |

| Database connection pool | <80% utilized | >90% || Invoice/Order | `app/api/bookings/[id]/invoice/` | Photo upload via Cloudinary |

| Payment | `lib/razorpay.ts` | Orders + Signature verification |

### Guardrail Metrics| Escrow | `lib/db.ts`, `cron/escrow-auto-release.ts` | 24h hold, auto-release |

| Disputes | `app/api/complaints/`, `app/api/admin/complaints/` | Three-way chat, resolution |

| Metric | Threshold | Action || Payouts | `app/api/cron/process-payouts/` | RazorpayX integration |

|--------|-----------|--------|

| Fraud rate | >1% | Pause new signups, audit |### Planned (Post-MVP)

| Payment failure rate | >5% | Investigate Razorpay, enable fallback |

| App crash rate | >1% | Hotfix deployment || Feature | Rationale for Deferral |

| Support ticket volume | >100/day | Scale support team || --------------------------------- | ----------------------------------------------------- |

| Deadline-based provider filtering | Field exists; filtering logic deferred for simplicity |

---| Dynamic robots.txt/sitemap.ts | Static files sufficient for launch |

| JSON-LD structured data | SEO optimization post-PMF |

## 10. Technical Architecture| Native mobile apps | PWA sufficient for MVP validation |

| AI clothing detection | Manual entry builds training dataset |

### System Overview

---

````

┌─────────────────────────────────────────────────────────────────┐## 12. Risks & Mitigations

│                         CLIENTS                                 │

│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │| Risk                            | Probability | Impact   | Mitigation                                             |

│  │ Seeker PWA │  │Provider PWA│  │Admin Panel │                │| ------------------------------- | ----------- | -------- | ------------------------------------------------------ |

│  │ (Next.js)  │  │ (Next.js)  │  │ (Next.js)  │                │| Provider supply shortage        | Medium      | High     | Aggressive onboarding incentives; referral bonuses     |

│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘                │| Payment gateway downtime        | Low         | Critical | Fallback payment link via SMS                          |

└────────┼───────────────┼───────────────┼────────────────────────┘| Fraudulent providers            | Medium      | High     | ID verification; escrow; review monitoring             |

         │               │               │| Seeker abuse (false complaints) | Medium      | Medium   | Pattern detection; privilege revocation                |

         ▼               ▼               ▼| Competitor entry                | High        | Medium   | Focus on escrow + dispute resolution as differentiator |

┌─────────────────────────────────────────────────────────────────┐

│                      NEXT.JS 16 API LAYER                       │---

│  proxy.ts (auth) • Route Handlers • Zod Validation • RBAC      │

└─────────────────────────────────────────────────────────────────┘## 13. Appendix

         │

         ├──────────────────┬───────────────────┬─────────────────┐### Glossary

         ▼                  ▼                   ▼                 ▼

  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   ┌──────────┐| Term     | Definition                                           |

  │  MongoDB    │    │  Razorpay   │    │ Cloudinary  │   │  Twilio  │| -------- | ---------------------------------------------------- |

  │  Atlas      │    │ + RazorpayX │    │  (Photos)   │   │  (OTP)   │| Booking  | Pre-order commitment with deadline and booking fee   |

  └─────────────┘    └─────────────┘    └─────────────┘   └──────────┘| Order    | Confirmed service after invoice approval             |

         │| Escrow   | Funds held by platform until complaint window closes |

         ▼| No-Show  | Provider failure to arrive at confirmed pickup time  |

  ┌─────────────┐| Deadline | Maximum date by which laundry must be delivered      |

  │ Vercel Cron │

  │   (Jobs)    │### Revision History

  └─────────────┘

```| Version | Date       | Changes                                         |

| ------- | ---------- | ----------------------------------------------- |

### Background Jobs (Vercel Cron)| 1.0     | 2025-12-21 | Initial draft                                   |

| 2.0     | 2025-12-21 | Full specifications                             |

| Job | Schedule | Purpose | Idempotency || 3.0     | 2025-12-29 | Implementation audit                            |

|-----|----------|---------|-------------|| 3.4     | 2026-01-04 | Codebase verification, false claims corrected   |

| auto-reject-bookings | */5 * * * * | Reject bookings >2h without response | Checks status before action || 4.0     | 2026-01-06 | FAANG-grade rewrite, streamlined for production |

| no-show-check | */5 * * * * | Flag missed pickup windows | Checks status before action |

| release-payouts | */15 * * * * | Release escrow 24h after delivery | Checks payment_status before action |---

| process-payouts | */15 * * * * | Execute RazorpayX transfers | Checks payout_id existence |

| monitor-abuse | 0 2 * * * | Flag suspicious patterns | Append-only flagging |**Document Status:** ✅ Approved for Production



### Data Models**Sign-off:**



```- [x] Engineering Lead

Seeker- [ ] Product Lead

├── _id: ObjectId- [ ] Design Lead

├── email: string (unique)
├── phone: string (verified)
├── name: string
├── address: Address
├── passwordHash: string
├── emailVerified: boolean
├── phoneVerified: boolean
└── createdAt: Date

Provider
├── _id: ObjectId
├── email: string (unique)
├── phone: string (verified)
├── businessName: string
├── location: GeoJSON Point
├── radius_km: number
├── services: string[]
├── pricing: number (base booking fee)
├── pricingRates: Map<service, price>
├── maxCapacity: number
├── activeOrders: number
├── rating: number
├── reviewCount: number
├── razorpay_contact_id: string
├── razorpay_fund_account_id: string
└── bankDetails: BankDetails (masked)

Booking
├── _id: ObjectId
├── seeker_id: ObjectId
├── provider_id: ObjectId
├── status: enum
├── booking_fee: number
├── razorpay_order_id: string
├── pickup_slot: DateTime
├── deadline: DateTime (optional)
├── invoice: Invoice (embedded)
├── createdAt: Date
└── updatedAt: Date

Order
├── _id: ObjectId
├── booking_id: ObjectId
├── seeker_id: ObjectId
├── provider_id: ObjectId
├── status: enum
├── items: Item[]
├── total_price: number
├── payment_status: enum
├── razorpay_order_id: string
├── razorpay_payment_id: string
├── escrow_release_at: Date
├── payout_id: string (nullable)
├── delivery_slot: DateTime
├── delivered_at: Date
└── otp_hash: string

Complaint
├── _id: ObjectId
├── order_id: ObjectId (unique)
├── seeker_id: ObjectId
├── provider_id: ObjectId
├── status: enum
├── description: string
├── evidence_urls: string[]
├── messages: Message[]
├── resolution: Resolution
└── createdAt: Date
````

---

## 11. API Surface

### Core Endpoints

| Method | Path                               | Purpose                | Auth     |
| ------ | ---------------------------------- | ---------------------- | -------- |
| POST   | /api/bookings                      | Create booking         | Seeker   |
| POST   | /api/bookings/[id]/accept          | Accept booking         | Provider |
| POST   | /api/bookings/[id]/reject          | Reject booking         | Provider |
| POST   | /api/bookings/[id]/schedule        | Schedule pickup        | Both     |
| POST   | /api/bookings/[id]/invoice         | Create invoice         | Provider |
| POST   | /api/invoices/[id]/review          | Approve/reject invoice | Seeker   |
| POST   | /api/orders/[id]/payment/init      | Initialize payment     | Seeker   |
| POST   | /api/orders/[id]/payment/verify    | Verify payment         | System   |
| POST   | /api/orders/[id]/status            | Update order status    | Provider |
| POST   | /api/orders/[id]/confirm-delivery  | OTP confirmation       | Seeker   |
| POST   | /api/complaints                    | File complaint         | Seeker   |
| POST   | /api/admin/complaints/[id]/resolve | Resolve dispute        | Admin    |

### Cron Endpoints

All require `Authorization: Bearer <CRON_SECRET>`.

| Method | Path                           | Schedule     |
| ------ | ------------------------------ | ------------ |
| GET    | /api/cron/auto-reject-bookings | Every 5 min  |
| GET    | /api/cron/no-show              | Every 5 min  |
| GET    | /api/cron/release-payouts      | Every 15 min |
| GET    | /api/cron/process-payouts      | Every 15 min |
| GET    | /api/cron/monitor-abuse        | Daily 2 AM   |

### Response Codes

| Code | Meaning                              |
| ---- | ------------------------------------ |
| 200  | Success                              |
| 201  | Created                              |
| 400  | Validation error (Zod)               |
| 401  | Unauthorized                         |
| 403  | Forbidden (role mismatch)            |
| 404  | Resource not found                   |
| 409  | Conflict (duplicate, invalid state)  |
| 429  | Rate limited                         |
| 500  | Server error                         |
| 503  | Service unavailable (missing config) |

---

## 12. Out-of-Scope (Explicit Exclusions)

| Feature                      | Reason for Exclusion                                     | Revisit Trigger                    |
| ---------------------------- | -------------------------------------------------------- | ---------------------------------- |
| GPS verification at pickup   | Indoor accuracy insufficient; user permission complexity | Post-MVP with device attestation   |
| Razorpay webhook endpoint    | Client-side verification sufficient for MVP              | If payment sync issues exceed 1%   |
| Rate limiting middleware     | Error types defined; implementation deferred             | If abuse detected                  |
| Security headers in proxy.ts | CSP complexity with Razorpay scripts                     | Before public launch               |
| Native mobile apps           | PWA validates market; native adds 6-month delay          | After PMF confirmation             |
| Multi-currency support       | INR only for India launch                                | International expansion            |
| Provider analytics dashboard | Basic stats sufficient for MVP                           | Provider feedback indicates demand |
| Automated refund processing  | Admin-initiated refunds ensure oversight                 | Volume exceeds 50/day              |

---

## 13. Risks & Mitigations

| Risk                            | Probability | Impact   | Mitigation                                                    |
| ------------------------------- | ----------- | -------- | ------------------------------------------------------------- |
| Provider supply shortage        | Medium      | High     | Aggressive onboarding incentives; referral bonuses            |
| Razorpay downtime               | Low         | Critical | Fallback payment link via SMS; manual reconciliation          |
| Fraudulent providers            | Medium      | High     | ID verification; escrow; review monitoring; flagging          |
| Seeker abuse (false complaints) | Medium      | Medium   | Pattern detection; privilege revocation; deposit requirements |
| Competitor entry                | High        | Medium   | Escrow + dispute resolution as differentiators                |
| Regulatory changes              | Low         | High     | RBI-compliant via Razorpay; legal review quarterly            |

---

## 14. Launch Checklist

### Pre-Launch (Required)

- [x] All FR-\* requirements implemented and tested
- [x] Cron jobs configured in vercel.json
- [x] Environment variables documented in .env.example
- [x] CRON_SECRET, NEXTAUTH_SECRET generated (32+ chars)
- [x] Razorpay production keys configured
- [x] RazorpayX account configured with valid RAZORPAYX_ACCOUNT_NUMBER
- [x] Cloudinary production account configured
- [x] MongoDB Atlas production cluster configured
- [x] Twilio production credentials configured
- [ ] Load testing completed (10,000 concurrent users)
- [ ] Security penetration testing completed
- [ ] Legal review of terms of service
- [ ] Privacy policy published

### Post-Launch Monitoring

- [ ] API error rate <0.1% for 48 hours
- [ ] Payment success rate >98% for 48 hours
- [ ] No critical bugs reported for 7 days
- [ ] NPS survey deployed to first 100 users
- [ ] Provider onboarding funnel measured

---

## Appendix A: Glossary

| Term     | Definition                                                               |
| -------- | ------------------------------------------------------------------------ |
| Booking  | Pre-order commitment; seeker pays booking fee; provider commits capacity |
| Order    | Confirmed service after invoice approval; full payment held in escrow    |
| Escrow   | Funds held by platform until 24h complaint window closes                 |
| No-Show  | Provider failure to arrive at confirmed pickup time                      |
| Deadline | Maximum date/time by which laundry must be delivered                     |
| Payout   | Transfer of funds from platform to provider bank account                 |

---

## Appendix B: Revision History

| Version | Date       | Author      | Changes                    |
| ------- | ---------- | ----------- | -------------------------- |
| 1.0     | 2025-12-21 | Engineering | Initial draft              |
| 2.0     | 2025-12-21 | Engineering | Full specifications        |
| 3.0     | 2025-12-29 | Engineering | Implementation audit       |
| 4.0     | 2026-01-06 | Engineering | FAANG-grade rewrite        |
| 5.0     | 2026-01-06 | Engineering | Final production alignment |

---

**Document Status:** ✅ FINAL — Approved for Production

**Authorizations:**

- [x] Engineering Lead
- [x] Product Lead
- [x] Security Review
- [ ] Legal Review (pending)

---

_This document represents the complete, aligned, and final specification for LaundryEase v1.0. Any changes require a new version with explicit diff documentation._
