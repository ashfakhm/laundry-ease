# Product Requirements Document (PRD) - LaundryEase

**Version:** 2.0 (FAANG-Grade, Production-Ready)
**Date:** 2025-12-21
**Status:** Final
**Author:** Ashfakh M

---

## Executive Summary

LaundryEase is a B2C marketplace connecting time-constrained urban professionals with vetted laundry service providers. The platform differentiates through **deadline-guaranteed service**, **escrow-protected payments**, **evidence-backed dispute resolution**, and **privacy-first communication**.

**Target Market:** Urban professionals (25-45) with household income >₹8L/year
**TAM:** ₹15,000 Cr (Indian urban laundry market)
**MVP Launch:** Q1 2026
**Break-even Target:** 18 months post-launch

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Solution Overview](#2-solution-overview)
3. [User Personas](#3-user-personas)
4. [User Journeys & State Machines](#4-user-journeys--state-machines)
5. [Functional Requirements](#5-functional-requirements)
6. [Business Rules Engine](#6-business-rules-engine)
7. [State Transitions & Edge Cases](#7-state-transitions--edge-cases)
8. [Technical Architecture](#8-technical-architecture)
9. [Data Models](#9-data-models)
10. [API Contracts](#10-api-contracts)
11. [Security & Compliance](#11-security--compliance)
12. [Metrics & Success Criteria](#12-metrics--success-criteria)
13. [Risk Matrix](#13-risk-matrix)
14. [Release Plan](#14-release-plan)
15. [Appendix](#15-appendix)

---

## 1. Problem Statement

### 1.1 Current Pain Points

| Pain Point                    | Impact                       | Frequency            |
| :---------------------------- | :--------------------------- | :------------------- |
| Physical shop visits required | 2-4 hours/week lost          | 100% of users        |
| No deadline guarantees        | Missed important events      | 34% report incidents |
| Opaque pricing                | Budget uncertainty           | 67% frustrated       |
| No recourse for damage        | Financial loss               | 12% experienced      |
| Cash-only payments            | Inconvenience, security risk | 78% prefer digital   |

### 1.2 Jobs to Be Done (JTBD)

> "When I have a busy work week, I want my laundry handled without my involvement, so I can focus on higher-priority tasks."

> "When I need specific clothes by a deadline, I want guaranteed delivery, so I never miss important occasions."

> "When something goes wrong with my order, I want fair resolution with evidence, so I'm not left powerless."

---

## 2. Solution Overview

### 2.1 Value Proposition Canvas

| Customer Job       | Pain Reliever                    | Gain Creator                      |
| :----------------- | :------------------------------- | :-------------------------------- |
| Get laundry done   | Doorstep pickup/delivery         | Zero time investment              |
| Meet deadlines     | Deadline-locked bookings         | Penalty-backed guarantees         |
| Know costs upfront | Fixed price lists                | No surprise charges               |
| Resolve disputes   | Photo evidence + Admin mediation | Fair, transparent outcomes        |
| Pay securely       | Escrow system                    | Money protected until satisfied   |
| Maintain Privacy   | Phone/Email Masking              | No spam/harassment from strangers |

### 2.2 Core Differentiators

1. **Deadline-First Architecture:** Every booking is locked to a deadline; system auto-hides providers who can't meet it
2. **AI Video Ingestion (Speed):** Doorstep handover takes <30 seconds via continuous video scan; processing is asynchronous.
3. **Smart Logistics:** Dynamic batching of pickups/deliveries via "Slot Windows" (e.g., 9-11 AM) to maximize provider density.
4. **Escrow + Insurance:** Payments protected by escrow; Items protected by micro-insurance.
5. **Algorithmic Trust:** Provider visibility tied to real-time capacity and historical performance

---

## 3. User Personas

### 3.1 Primary Persona: The Time-Starved Professional (Seeker)

| Attribute                      | Detail                                                      |
| :----------------------------- | :---------------------------------------------------------- |
| **Name**                       | Priya Sharma                                                |
| **Age**                        | 32                                                          |
| **Occupation**                 | Senior Product Manager, Tech Company                        |
| **Income**                     | ₹24L/year                                                   |
| **Location**                   | Bangalore (Koramangala)                                     |
| **Tech Savviness**             | High (daily UPI user, Swiggy/Zepto power user)              |
| **Laundry Frequency**          | 2-3 times/month                                             |
| **Primary Motivation**         | Reclaim weekend time                                        |
| **Willingness to Pay Premium** | Yes, for reliability                                        |
| **Key Frustration**            | "I've lost clothes at local shops with zero accountability" |

### 3.2 Secondary Persona: The Professional Provider

| Attribute              | Detail                                                 |
| :--------------------- | :----------------------------------------------------- |
| **Name**               | Ramesh Kumar                                           |
| **Age**                | 45                                                     |
| **Business**           | 15-year laundry shop owner                             |
| **Staff**              | 3 employees                                            |
| **Current Revenue**    | ₹80K/month                                             |
| **Tech Savviness**     | Medium (WhatsApp, Paytm)                               |
| **Primary Motivation** | Expand customer base without storefront investment     |
| **Key Frustration**    | "Walk-in traffic is declining; I need online presence" |

### 3.3 Tertiary Persona: Platform Admin

| Attribute            | Detail                                                           |
| :------------------- | :--------------------------------------------------------------- |
| **Role**             | Operations Manager                                               |
| **Responsibilities** | Dispute resolution, fraud prevention, provider quality           |
| **KPIs**             | Resolution time <24h, Fraud rate <0.5%, Provider churn <5%/month |

---

## 4. User Journeys & State Machines

### 4.1 Booking State Machine

> **Implementation Note:** Current MVP uses a simplified booking flow. Advanced states (CONFIRMED, NO_SHOW, CANCELLED) are planned for Phase 2.

```
┌─────────────┐
│  REQUESTED  │ ← Seeker submits booking request
└──────┬──────┘
       │
       ├──────────────────────────────┐
       │ Provider Accepts             │ Provider Rejects
       ▼                              ▼
┌─────────────┐                ┌─────────────┐
│  ACCEPTED   │                │  REJECTED   │ → Booking Closed
└──────┬──────┘                └─────────────┘
       │
       │ Provider creates invoice at pickup
       ▼
┌─────────────┐
│   ORDER     │ → Converts to Order (see Order State Machine)
│   CREATED   │
└─────────────┘
```

**Future States (Phase 2):**

- `CONFIRMED`: Pickup time mutually agreed
- `CANCELLED`: Seeker cancellation after acceptance
- `NO_SHOW`: Provider failed to arrive at pickup

### 4.2 Order State Machine (Payment-Status Based)

> **Implementation Note:** Orders track progress via `payment_status` field. Process status tracking is planned for Phase 2.

```
┌─────────────┐
│   UNPAID    │ ← Order created from accepted booking
└──────┬──────┘
       │
       ├──────────────────────────────┐
       │ Seeker Pays                  │ Seeker/Provider Cancels
       ▼                              ▼
┌─────────────┐                ┌─────────────┐
│    PAID     │                │  CANCELLED  │ → cancellation_status set
└──────┬──────┘                └─────────────┘
       │
       │ Delivery Confirmed (OTP verified)
       ▼
┌─────────────┐
│    HELD     │ ← Escrow started (24h window)
└──────┬──────┘    escrow_started_at, escrow_release_at set
       │
       ├──────────────────────────────┐
       │ 24h passes, no complaint     │ Complaint Raised
       ▼                              ▼
┌─────────────┐                ┌─────────────┐
│  RELEASED   │                │  DISPUTED   │ → Complaint created
│  (Complete) │                │  (HELD)     │   Escrow frozen
└─────────────┘                └──────┬──────┘
                                      │ Admin Resolution
                                      ▼
                               ┌─────────────┐
                               │  REFUNDED   │ (if applicable)
                               └─────────────┘
```

**Key Timestamps:**

- `payment_made_at`: When seeker completed payment
- `otp_confirmed_at`: When delivery was confirmed
- `escrow_started_at`: When 24h escrow window began
- `escrow_release_at`: Scheduled auto-release time

### 4.3 Complaint State Machine

> **Implementation Note:** Complaints use simplified status tracking. Resolution outcomes are determined by admin during resolution.

```
┌─────────────┐
│    OPEN     │ ← Seeker raises complaint (within 24h escrow window)
└──────┬──────┘    Escrow automatically frozen
       │
       │ Admin begins review
       ▼
┌─────────────┐
│ IN_PROGRESS │ ← Admin investigating, evidence review
└──────┬──────┘
       │
       │ Admin makes decision
       ▼
┌─────────────┐
│  RESOLVED   │ → Payment action executed
└─────────────┘
```

**Resolution Outcomes (handled externally):**

- Full refund → Order payment_status = 'refunded'
- Partial refund → Manual admin action
- No action → Order payment_status = 'released'
- Provider penalty → Admin user management

---

## 5. Functional Requirements

### 5.1 Authentication & Onboarding

#### FR-AUTH-001: Phone OTP Verification

| Field                   | Value                                                                                                                                                             |
| :---------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Priority**            | P0 (Must Have)                                                                                                                                                    |
| **Description**         | All users must verify phone via 6-digit OTP. **Privacy Note:** Real phone numbers are masked in all P2P communications; use virtual/proxy numbers or in-app VOIP. |
| **OTP Expiry**          | 5 minutes                                                                                                                                                         |
| **Max Attempts**        | 3 per session, then 30-min cooldown                                                                                                                               |
| **Acceptance Criteria** | 1. OTP delivered <10s via Twilio<br>2. Invalid OTP shows clear error<br>3. Resend available after 30s                                                             |

#### FR-AUTH-002: Email Verification

| Field                   | Value                                                           |
| :---------------------- | :-------------------------------------------------------------- |
| **Priority**            | P0                                                              |
| **Description**         | Magic link sent to email; valid for 24 hours                    |
| **Acceptance Criteria** | 1. Link works only once<br>2. Expired link shows re-send option |

#### FR-AUTH-003: Provider Profile Setup

| Field                   | Value                                                                                                                              |
| :---------------------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| **Priority**            | P0                                                                                                                                 |
| **Required Fields**     | Base location (geocoded), Max radius (1-50km), Free delivery distance (0-10km), Extra charge/km (₹0-50), Price list (min 10 items) |
| **Validation**          | All prices must be >₹0; radius must be >free delivery distance                                                                     |
| **Acceptance Criteria** | 1. Cannot accept bookings until profile 100% complete<br>2. Location validated via Google Places API                               |

#### FR-AUTH-004: Seeker Profile Setup

| Field                   | Value                                                                      |
| :---------------------- | :------------------------------------------------------------------------- |
| **Priority**            | P0                                                                         |
| **Required Fields**     | Default location (geocoded)                                                |
| **Acceptance Criteria** | 1. Can edit location anytime<br>2. Location autocomplete via Google Places |

---

### 5.2 Provider Discovery

#### FR-DISC-001: Location-Based Search

| Field                   | Value                                                                               |
| :---------------------- | :---------------------------------------------------------------------------------- |
| **Priority**            | P0                                                                                  |
| **Inputs**              | Seeker location, Required deadline                                                  |
| **Matching Algorithm**  | `distance(seeker, provider.base) <= provider.maxRadius`                             |
| **Acceptance Criteria** | 1. Only matching providers shown<br>2. Results sorted by: Rating > Distance > Price |

#### FR-DISC-002: Availability Filtering

| Field                   | Value                                                                                            |
| :---------------------- | :----------------------------------------------------------------------------------------------- |
| **Priority**            | P0                                                                                               |
| **Logic**               | Hide providers where `activeOrders >= maxCapacity` OR `estimatedCompletionTime > seekerDeadline` |
| **Acceptance Criteria** | 1. Overbooked providers auto-hidden<br>2. Provider can manually mark unavailable                 |

#### FR-DISC-003: Provider Profile View

| Field                   | Value                                                                                             |
| :---------------------- | :------------------------------------------------------------------------------------------------ |
| **Priority**            | P0                                                                                                |
| **Displayed**           | Name, Photo, Rating, Review count, Price list, Delivery charges, Verification tier, Response rate |
| **Acceptance Criteria** | 1. All prices visible before booking<br>2. Reviews paginated (10 per page)                        |

---

### 5.3 Booking Flow

#### FR-BOOK-001: Booking Creation

| Field                   | Value                                                                                                                                |
| :---------------------- | :----------------------------------------------------------------------------------------------------------------------------------- |
| **Priority**            | P0                                                                                                                                   |
| **Inputs**              | Provider ID, Deadline, Pickup location, Estimated items (optional)                                                                   |
| **Payment**             | Booking fee charged immediately (treated as **down payment**).                                                                       |
| **Insurance**           | Optional "Micro-Insurance" add-on (₹10-50) for "No-Questions-Asked" coverage.                                                        |
| **Acceptance Criteria** | 1. Booking fee = max(₹50, 5% of estimated order)<br>2. Payment failure blocks booking<br>3. Fee is deducted from final invoice total |

#### FR-BOOK-002: Provider Accept/Reject

| Field                   | Value                                                                     |
| :---------------------- | :------------------------------------------------------------------------ |
| **Priority**            | P0                                                                        |
| **SLA**                 | Must respond within 2 hours                                               |
| **Auto-Reject**         | If no response in 2h, auto-reject + full refund                           |
| **Acceptance Criteria** | 1. Push + SMS notification to provider<br>2. Accept/Reject buttons in app |

#### FR-BOOK-003: Pickup Scheduling

| Field                   | Value                                                                                                                 |
| :---------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| **Priority**            | P0                                                                                                                    |
| **Flow**                | Provider proposes slot OR "Smart Window" (e.g., 9-11 AM) to allow route batching.                                     |
| **Mode**                | 1. **Handshake:** Physical meet.<br>2. **Drop & Go:** Leave at Security/Concierge (requires photo proof of bag seal). |
| **Constraints**         | Pickup must be ≥2 hours from now, ≤48 hours from booking                                                              |
| **Acceptance Criteria** | 1. Calendar UI shows "Cheaper" slots for Batched Windows<br>2. Both parties receive confirmation                      |

#### FR-BOOK-004: No-Show Detection

| Field                   | Value                                                                     |
| :---------------------- | :------------------------------------------------------------------------ |
| **Priority**            | P0                                                                        |
| **Window**              | Provider has ±30 minutes from confirmed time                              |
| **Trigger**             | If provider doesn't mark "Arrived" within window                          |
| **Consequence**         | Auto-cancel, full refund, provider penalty                                |
| **Acceptance Criteria** | 1. GPS check when marking arrived<br>2. Penalty logged in provider record |

---

### 5.4 Invoice & Order Creation

#### FR-INV-001: Invoice Generation

| Field                   | Value                                                                                                                                            |
| :---------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Priority**            | P0                                                                                                                                               |
| **Location**            | At seeker's doorstep (Physical) OR Asynchronous (Drop & Go).                                                                                     |
| **Method**              | **Video Ingestion (Primary):** Continuous video scan of items. AI/Manual backend extracts items later.<br>**Manual Backup:** Item-by-item entry. |
| **Required per Item**   | Category, Quantity, Price (auto-filled), Photo/Video Frame, Notes                                                                                |
| **"Other" Items**       | Manual price entry allowed; requires photo + justification                                                                                       |
| **AI Data Collection**  | Photos are tagged with manual entries to build dataset for future AI clothing recognition models (MVP: Data collection only).                    |
| **Acceptance Criteria** | 1. Cannot submit without photo per item<br>2. Prices locked from provider profile                                                                |

#### FR-INV-002: Invoice Approval

| Field                   | Value                                                                               |
| :---------------------- | :---------------------------------------------------------------------------------- |
| **Priority**            | P0                                                                                  |
| **Seeker Actions**      | Approve / Reject / Request Edit                                                     |
| **Approve**             | Booking converts to Order; clothes handed over                                      |
| **Reject**              | Clothes returned immediately; booking fee retained by provider                      |
| **Acceptance Criteria** | 1. Seeker sees itemized list with photos<br>2. Cannot leave without explicit action |

---

### 5.5 Order Processing

#### FR-ORD-001: Status Updates

| Field                   | Value                                                                            |
| :---------------------- | :------------------------------------------------------------------------------- |
| **Priority**            | P0                                                                               |
| **Statuses**            | `PICKED_UP` → `WASHING` → `IRONING` → `READY` → `OUT_FOR_DELIVERY` → `DELIVERED` |
| **Provider Action**     | Must update status within 4 hours of actual transition                           |
| **Acceptance Criteria** | 1. Seeker sees real-time status<br>2. Push notification on each update           |

#### FR-ORD-002: Delivery Scheduling

| Field                   | Value                                                                                       |
| :---------------------- | :------------------------------------------------------------------------------------------ |
| **Priority**            | P0                                                                                          |
| **Constraint**          | Delivery date ≤ Original deadline                                                           |
| **Flow**                | Bidirectional negotiation: Provider proposes -> Seeker accepts/counters -> Provider accepts |
| **Acceptance Criteria** | 1. Cannot schedule past deadline<br>2. Seeker can request earlier slot                      |

#### FR-ORD-003: Delivery Confirmation

| Field                   | Value                                                                                |
| :---------------------- | :----------------------------------------------------------------------------------- |
| **Priority**            | P0                                                                                   |
| **Seeker Action**       | Confirm receipt in app                                                               |
| **Evidence**            | Provider must capture delivery photo (GPS-tagged)                                    |
| **Payment**             | Final amount charged; deposited to escrow                                            |
| **Acceptance Criteria** | 1. Order incomplete until seeker confirms<br>2. Auto-reminder if not confirmed in 2h |

---

### 5.6 Payment & Escrow

#### FR-PAY-001: Payment Flow

| Field                   | Value                                                |
| :---------------------- | :--------------------------------------------------- |
| **Priority**            | P0                                                   |
| **Methods**             | UPI, Cards, Net Banking, Wallet                      |
| **Gateway**             | Razorpay (primary), Stripe (backup)                  |
| **Acceptance Criteria** | 1. PCI-DSS compliant<br>2. Failed payment retries 3x |

#### FR-PAY-002: Escrow Hold

| Field                   | Value                                                            |
| :---------------------- | :--------------------------------------------------------------- |
| **Priority**            | P0                                                               |
| **Hold Period**         | 24 hours post-delivery confirmation                              |
| **Release Condition**   | No complaint raised within window                                |
| **Acceptance Criteria** | 1. Provider sees "Pending" status<br>2. Auto-release at 24h mark |

#### FR-PAY-003: Late Delivery Penalty

| Field                   | Value                                                                 |
| :---------------------- | :-------------------------------------------------------------------- |
| **Priority**            | P1                                                                    |
| **Calculation**         | 5% discount per hour late (max 30%)                                   |
| **Application**         | Auto-deducted from final payment                                      |
| **Acceptance Criteria** | 1. Seeker sees discount applied<br>2. Provider sees penalty in payout |

---

### 5.7 Dispute Resolution

#### FR-DISP-001: Complaint Filing

| Field                   | Value                                                           |
| :---------------------- | :-------------------------------------------------------------- |
| **Priority**            | P0                                                              |
| **Window**              | Within 24 hours of delivery                                     |
| **Categories**          | Late Delivery, Damaged Item, Missing Item, Quality Issue, Other |
| **Required**            | Category, Description, Photo evidence (optional but weighted)   |
| **Acceptance Criteria** | 1. Escrow frozen immediately<br>2. Both parties notified        |

#### FR-DISP-002: Resolution Process

| Field                   | Value                                                                |
| :---------------------- | :------------------------------------------------------------------- |
| **Priority**            | P0                                                                   |
| **SLA**                 | Admin first response within 4 hours; resolution within 48 hours      |
| **Channel**             | In-app 3-way chat (Seeker-Provider-Admin)                            |
| **Outcomes**            | Full refund, Partial refund, No action, Provider penalty             |
| **Acceptance Criteria** | 1. Chat history preserved<br>2. Final decision logged with reasoning |

---

## 6. Business Rules Engine

### 6.1 Pricing Rules

| Rule ID | Rule                | Formula                                                            |
| :------ | :------------------ | :----------------------------------------------------------------- |
| PR-001  | Booking Fee         | `max(₹50, estimatedOrder * 0.05)` (Credited towards Order Total)   |
| PR-002  | Delivery Charge     | `distance > freeRadius ? (distance - freeRadius) * extraPerKm : 0` |
| PR-003  | Platform Commission | `orderTotal * 0.10` (Basic), `orderTotal * 0.08` (Premium)         |
| PR-004  | Late Penalty        | `min(hoursLate * 0.05, 0.30) * orderTotal`                         |
| PR-005  | Micro-Insurance     | `basePremium + (declaredValue * 0.01)` (Optional)                  |

### 6.2 Capacity Rules

| Rule ID | Rule                                          | Value                                            |
| :------ | :-------------------------------------------- | :----------------------------------------------- |
| CR-001  | Max Active Orders (Provider)                  | 10 (configurable per provider tier)              |
| CR-002  | Max Concurrent Orders (Seeker, same provider) | 1                                                |
| CR-003  | Max Concurrent Orders (Seeker, total)         | 3                                                |
| CR-004  | Booking Block During Dispute                  | Seeker cannot book until active dispute resolved |

### 6.3 Penalty & Fraud Rules

| Rule ID | Trigger                                 | Consequence                                              |
| :------ | :-------------------------------------- | :------------------------------------------------------- |
| PEN-001 | Provider no-show                        | ₹100 fine + account flag                                 |
| PEN-002 | 3 no-shows in 30 days                   | 7-day suspension                                         |
| PEN-003 | 5 no-shows in 90 days                   | Permanent ban                                            |
| PEN-004 | Seeker false complaint (admin verified) | Warning → Review privilege revoked → Account suspension  |
| PEN-005 | Provider late delivery                  | Auto-discount (PR-004) + rating impact                   |
| FRA-001 | High Velocity Bookings (>3 in 1 hour)   | Account flagged for manual review + Temp hold            |
| FRA-002 | Device ID Mismatch (Provider)           | Force re-login with Facial Verification (Liveness Check) |

### 6.4 Refund Rules

| Scenario                  | Refund Amount                         | Method          | Timeline |
| :------------------------ | :------------------------------------ | :-------------- | :------- |
| Provider rejects booking  | 100% booking fee                      | Original method | 3-5 days |
| Provider no-show          | 100% booking fee                      | Original method | 3-5 days |
| Seeker cancels pre-pickup | 0% (forfeited)                        | N/A             | N/A      |
| Invoice rejected          | 0% booking fee (retained by provider) | N/A             | N/A      |
| Dispute: Full refund      | 100% order amount                     | Original method | 5-7 days |
| Dispute: Partial refund   | Admin-determined %                    | Wallet credit   | Instant  |

---

## 7. State Transitions & Edge Cases

### 7.1 Edge Case Matrix

| Edge Case                                     | System Behavior                                                                       | Rationale                          |
| :-------------------------------------------- | :------------------------------------------------------------------------------------ | :--------------------------------- |
| Seeker unresponsive during pickup             | Provider waits 15 min → marks "Seeker Unavailable" → Booking cancelled, fee forfeited | Prevents provider time waste       |
| Provider emergency mid-order                  | Triggers Emergency Protocol (see §8.1)                                                | Clothes are in provider possession |
| Payment gateway down                          | 3 retries → Manual link via SMS → 24h to pay or clothes returned                      | Ensures order completion           |
| Seeker claims non-delivery                    | Enters Disputed state → GPS/photo evidence reviewed                                   | Prevents fraud                     |
| Both parties unresponsive in dispute          | Admin makes unilateral decision after 72h                                             | Prevents indefinite hold           |
| Provider edits price list during active order | Changes apply to future orders only                                                   | Prevents mid-order surprises       |
| Deadline falls on holiday                     | System warns at booking; provider must accept explicitly                              | Transparency                       |

### 7.2 Timeout Configurations

| Action                     | Timeout                                | Consequence                    |
| :------------------------- | :------------------------------------- | :----------------------------- |
| Provider accept/reject     | 2 hours                                | Auto-reject + refund           |
| Seeker confirm pickup time | 12 hours                               | Booking cancelled + refund     |
| Provider arrive at pickup  | ±30 min of confirmed time              | No-show triggered              |
| Seeker confirm delivery    | 2 hours after provider marks delivered | Auto-confirm (unless disputed) |
| Complaint window           | 24 hours post-delivery                 | Escrow auto-released           |
| Dispute resolution         | 48 hours                               | Admin escalation               |

---

## 8. Technical Architecture

### 8.1 Tech Stack

| Layer          | Technology                    | Justification                                   |
| :------------- | :---------------------------- | :---------------------------------------------- |
| **Frontend**   | Next.js 16.x (App Router)     | SSR for SEO, RSC for performance                |
| **Language**   | TypeScript                    | Type safety, better DX                          |
| **Styling**    | TailwindCSS 4.x + DaisyUI 5.x | Rapid UI development                            |
| **Auth**       | NextAuth.js v4                | OAuth + Credentials support                     |
| **Database**   | MongoDB Atlas                 | Flexible schema, geo-queries                    |
| **Cache**      | Redis (Upstash)               | Session storage, rate limiting                  |
| **Queue**      | BullMQ                        | Background jobs (notifications, escrow release) |
| **Storage**    | AWS S3 / Cloudflare R2        | Photo evidence storage                          |
| **Email**      | Nodemailer + SendGrid         | Transactional emails                            |
| **SMS/Voice**  | Twilio                        | OTP, critical notifications, **Masked calling** |
| **Push**       | Firebase Cloud Messaging      | Real-time updates                               |
| **Payments**   | Razorpay                      | UPI + Cards, escrow support                     |
| **Maps**       | Google Maps API               | Location autocomplete, distance calculation     |
| **Monitoring** | Sentry + Datadog              | Error tracking, APM                             |

### 8.2 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Seeker App  │  │ Provider App │  │  Admin Panel │              │
│  │  (Next.js)   │  │  (Next.js)   │  │  (Next.js)   │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
└─────────┼─────────────────┼─────────────────┼───────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           API LAYER                                 │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                    Next.js API Routes                       │    │
│  │  /api/auth/*  /api/bookings/*  /api/orders/*  /api/admin/* │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│    MongoDB       │ │     Redis        │ │    BullMQ        │
│  (Primary DB)    │ │  (Cache/Session) │ │  (Job Queue)     │
└──────────────────┘ └──────────────────┘ └────────┬─────────┘
                                                   │
                              ┌────────────────────┼────────────────────┐
                              ▼                    ▼                    ▼
                     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
                     │   Twilio     │     │  Razorpay    │     │  SendGrid    │
                     │  (SMS/OTP)   │     │  (Payments)  │     │  (Email)     │
                     └──────────────┘     └──────────────┘     └──────────────┘
```

### 8.3 Background Jobs

| Job                  | Trigger                         | Action                              |
| :------------------- | :------------------------------ | :---------------------------------- |
| `escrow.release`     | 24h after delivery confirmation | Release funds to provider           |
| `booking.autoReject` | 2h after booking creation       | Reject if provider hasn't responded |
| `noShow.check`       | Confirmed pickup time + 30 min  | Flag provider no-show               |
| `notification.retry` | Delivery failure                | Retry up to 3 times                 |
| `dispute.escalate`   | 48h after dispute opened        | Notify senior admin                 |

---

## 9. Data Models

> **Note:** All data models below reflect the **current MVP implementation**. Fields marked as "Phase 2" are planned extensions.

### 9.1 BaseUser

```typescript
interface BaseUser {
  _id?: ObjectId;
  email: string;
  name?: string | null;
  phone?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  passwordHash?: string | null;
  createdAt: Date;
}
```

### 9.2 Seeker

```typescript
interface Seeker extends BaseUser {
  address?: {
    line1: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    landmark?: string;
  } | null;
  outstanding_fees?: number; // Cancellation fees owed
  blocked_until?: Date; // Account block until fees paid
}
```

### 9.3 Provider (ProviderProfile)

```typescript
interface Provider extends BaseUser {
  services?: string[];
  pricing?: number;
  location?: string;
  documents?: string[];
  radius_km?: number; // Service radius
  per_km_rate?: number; // Extra charge per km
  covers_beyond_radius?: boolean;
  businessName?: string;
  bio?: string;
  description?: string;
  pricingRates?: Record<string, number>; // Item-wise pricing
}
```

> **Phase 2 Extension:**

```typescript
interface ProviderExtended extends Provider {
  baseLocation: {
    type: \"Point\";
    coordinates: [number, number];
    address: string;
  };
  tier: \"basic\" | \"verified\" | \"premium\";
  rating: number;
  reviewCount: number;
  completedOrders: number;
  complaintRate: number;
  maxActiveOrders: number;
  currentActiveOrders: number;
  isAvailable: boolean;
}
```

### 9.3 Booking

> **Current Implementation** (MVP)

```typescript
interface Booking {
  _id: ObjectId;
  seeker_id: ObjectId;
  provider_id: ObjectId;
  status: "requested" | "accepted" | "rejected";
  createdAt: Date;
}
```

> **Planned Extension** (Phase 2)

```typescript
interface BookingExtended extends Booking {
  deadline: Date;
  pickupLocation: {
    type: "Point";
    coordinates: [number, number];
    address: string;
  };
  pickupSlot?: {
    proposedBy: "provider" | "seeker";
    dateTime: Date;
    confirmedAt?: Date;
  };
  bookingFee: number;
  bookingFeeStatus: "paid" | "refunded" | "forfeited";
  estimatedItems?: number;
  updatedAt: Date;
  statusHistory: {
    status: string;
    timestamp: Date;
    actor: ObjectId;
  }[];
}
```

### 9.4 Order

> **Current Implementation** (MVP)

```typescript
interface OrderItem {
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface Order {
  _id: ObjectId;
  booking_id: ObjectId;
  seeker_id: ObjectId;
  provider_id: ObjectId;
  items: OrderItem[];
  total_price: number;
  delivery_distance_km?: number;
  delivery_charge: number;
  payment_status: "unpaid" | "paid" | "held" | "released" | "refunded";
  payment_made_at?: Date;
  escrow_started_at?: Date;
  escrow_release_at?: Date;
  otp_confirmed_at?: Date;
  cancellation_status?: "cancelled_by_seeker" | "cancelled_by_provider";
  createdAt: Date;
}
```

> **Planned Extension** (Phase 2) - Process Tracking

```typescript
interface OrderExtended extends Order {
  process_status:
    | "invoiced"
    | "processing"
    | "ready"
    | "out_for_delivery"
    | "delivered";
  lineItems: {
    itemType: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    photoUrl: string;
    notes?: string;
  }[];
  deadline: Date;
  actualDeliveryTime?: Date;
  deliverySlot?: {
    proposedBy: "provider" | "seeker";
    dateTime: Date;
    confirmedAt?: Date;
  };
  deliveryProof?: {
    photoUrl: string;
    gpsCoordinates: [number, number];
    timestamp: Date;
  };
  latePenalty: number;
  platformCommission: number;
  providerPayout: number;
  updatedAt: Date;
  statusHistory: {
    status: string;
    timestamp: Date;
    actor: ObjectId;
  }[];
}
```

### 9.5 Complaint

> **Current Implementation** (MVP)

```typescript
interface Complaint {
  _id: ObjectId;
  order_id: ObjectId;
  seeker_id: ObjectId;
  provider_id: ObjectId;
  complaint_type: string; // e.g., "late_delivery", "damaged_item", "missing_item"
  description: string;
  photos?: string[];
  status: "open" | "in_progress" | "resolved";
  createdAt: Date;
}
```

> **Planned Extension** (Phase 2)

```typescript
interface ComplaintExtended extends Complaint {
  adminId?: ObjectId;
  category:
    | "late_delivery"
    | "damaged_item"
    | "missing_item"
    | "quality_issue"
    | "other";
  resolution?: {
    outcome:
      | "full_refund"
      | "partial_refund"
      | "no_action"
      | "provider_penalty";
    refundAmount?: number;
    reasoning: string;
    resolvedBy: ObjectId;
    resolvedAt: Date;
  };
  chat: {
    senderId: ObjectId;
    message: string;
    timestamp: Date;
  }[];
  updatedAt: Date;
}
```

---

## 10. API Contracts

### 10.1 Core Endpoints (Current Implementation)

#### Authentication & Onboarding

| Method | Endpoint                  | Description               | Auth   |
| :----- | :------------------------ | :------------------------ | :----- |
| POST   | `/api/otp/request`        | Request OTP for phone     | Public |
| POST   | `/api/otp/verify`         | Verify OTP                | Public |
| POST   | `/api/signup/seeker`      | Register as seeker        | Public |
| POST   | `/api/signup/provider`    | Register as provider      | Public |
| POST   | `/api/complete-signup`    | Complete profile setup    | Auth   |
| POST   | `/api/forgot-password`    | Request password reset    | Public |
| POST   | `/api/reset-password`     | Reset password with token | Public |
| GET    | `/api/auth/[...nextauth]` | NextAuth.js handlers      | Public |

#### Provider Discovery

| Method | Endpoint              | Description      | Auth   |
| :----- | :-------------------- | :--------------- | :----- |
| GET    | `/api/providers`      | Search providers | Seeker |
| GET    | `/api/providers/[id]` | Provider detail  | Seeker |

#### Bookings

| Method | Endpoint                    | Description            | Auth     |
| :----- | :-------------------------- | :--------------------- | :------- |
| POST   | `/api/bookings`             | Create booking request | Seeker   |
| GET    | `/api/bookings/provider`    | Get provider bookings  | Provider |
| PATCH  | `/api/bookings/[id]/accept` | Accept booking         | Provider |
| PATCH  | `/api/bookings/[id]/reject` | Reject booking         | Provider |

#### Orders

| Method | Endpoint                            | Description               | Auth     |
| :----- | :---------------------------------- | :------------------------ | :------- |
| POST   | `/api/orders`                       | Create order from booking | Provider |
| GET    | `/api/orders/seeker`                | Get seeker's orders       | Seeker   |
| GET    | `/api/orders/provider`              | Get provider's orders     | Provider |
| POST   | `/api/orders/[id]/pay`              | Pay for order             | Seeker   |
| POST   | `/api/orders/[id]/confirm-delivery` | Confirm delivery (OTP)    | Seeker   |
| POST   | `/api/orders/[id]/cancel`           | Cancel order              | Seeker   |

#### Escrow & Payments

| Method | Endpoint              | Description               | Auth   |
| :----- | :-------------------- | :------------------------ | :----- |
| POST   | `/api/escrow/release` | Release escrow (cron job) | System |

#### Complaints

| Method | Endpoint          | Description    | Auth   |
| :----- | :---------------- | :------------- | :----- |
| POST   | `/api/complaints` | File complaint | Seeker |

#### Profile Management

| Method | Endpoint                | Description             | Auth     |
| :----- | :---------------------- | :---------------------- | :------- |
| GET    | `/api/profile/seeker`   | Get seeker profile      | Seeker   |
| PUT    | `/api/profile/seeker`   | Update seeker profile   | Seeker   |
| GET    | `/api/profile/provider` | Get provider profile    | Provider |
| PUT    | `/api/profile/provider` | Update provider profile | Provider |

#### Admin Panel

| Method | Endpoint                     | Description        | Auth  |
| :----- | :--------------------------- | :----------------- | :---- |
| GET    | `/api/admin/users`           | List all users     | Admin |
| GET    | `/api/admin/complaints`      | List complaints    | Admin |
| PATCH  | `/api/admin/complaints/[id]` | Update complaint   | Admin |
| GET    | `/api/admin/payments`        | Payment management | Admin |
| GET    | `/api/admin/logs`            | System logs        | Admin |

### 10.2 Response Codes

| Code | Meaning                            |
| :--- | :--------------------------------- |
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

## 11. Security & Compliance

### 11.1 Authentication & Authorization

| Requirement        | Implementation                                    |
| :----------------- | :------------------------------------------------ |
| Session Management | JWT with 7-day expiry; refresh token rotation     |
| Password Policy    | Min 8 chars, 1 uppercase, 1 number, 1 special     |
| OTP Security       | Rate limited (3 attempts), 5-min expiry, no reuse |
| Role-Based Access  | Middleware validates role per route               |
| API Rate Limiting  | 100 req/min per user; 1000 req/min per IP         |

### 11.2 Data Protection

| Requirement           | Implementation                           |
| :-------------------- | :--------------------------------------- |
| Encryption at Rest    | MongoDB encryption, S3 SSE               |
| Encryption in Transit | TLS 1.3 everywhere                       |
| PII Handling          | Phone/email hashed in logs; masked in UI |
| Payment Data          | Never stored; tokenized via Razorpay     |
| Photo Storage         | Signed URLs with 1-hour expiry           |

### 11.3 Compliance

| Standard          | Status                             |
| :---------------- | :--------------------------------- |
| PCI-DSS           | Compliant via Razorpay             |
| GDPR              | Data export/deletion API available |
| India IT Act 2000 | Compliant                          |

---

## 12. Metrics & Success Criteria

### 12.1 North Star Metric

**Monthly Completed Orders (MCO)**

- Target: 10,000 MCO by Month 6
- Target: 50,000 MCO by Month 12

### 12.2 Key Performance Indicators

| Metric                       | Definition                    | Target | Measurement |
| :--------------------------- | :---------------------------- | :----- | :---------- |
| **Booking Conversion**       | Bookings → Completed Orders   | >70%   | Weekly      |
| **Provider Acceptance Rate** | Accepted / Total Bookings     | >85%   | Weekly      |
| **On-Time Delivery**         | Delivered ≤ Deadline          | >95%   | Weekly      |
| **Complaint Rate**           | Complaints / Completed Orders | <5%    | Weekly      |
| **Dispute Resolution Time**  | Avg hours to resolve          | <24h   | Weekly      |
| **NPS (Seeker)**             | Net Promoter Score            | >50    | Monthly     |
| **Provider Churn**           | Providers inactive >30 days   | <10%   | Monthly     |
| **Seeker Retention**         | Return users in 30 days       | >40%   | Monthly     |

### 12.3 Guardrail Metrics

| Metric                | Threshold           | Action if Breached      |
| :-------------------- | :------------------ | :---------------------- |
| Fraud Rate            | >1% of transactions | Pause onboarding, audit |
| Payment Failure Rate  | >5%                 | Switch gateway          |
| App Crash Rate        | >1% of sessions     | Hotfix deploy           |
| Support Ticket Volume | >100/day            | Scale support team      |

---

## 13. Risk Matrix

| Risk                            | Probability | Impact   | Mitigation                                         |
| :------------------------------ | :---------- | :------- | :------------------------------------------------- |
| Provider supply shortage        | Medium      | High     | Aggressive onboarding incentives; referral bonuses |
| Payment gateway downtime        | Low         | Critical | Dual gateway setup (Razorpay + Stripe)             |
| Fraudulent providers            | Medium      | High     | ID verification; escrow; review monitoring         |
| Seeker abuse (false complaints) | Medium      | Medium   | Complaint pattern detection; privilege revocation  |
| Competitor entry                | High        | Medium   | Focus on deadline guarantee as differentiator      |
| Regulatory changes              | Low         | Medium   | Legal review quarterly                             |

---

## 14. Release Plan

### 14.1 MVP Scope (v1.0) - Implementation Status

| Feature                            | PRD Status  | Code Status |
| :--------------------------------- | :---------- | :---------- |
| Seeker registration & auth         | ✅ In Scope | ✅ Done     |
| Provider registration & profile    | ✅ In Scope | ✅ Done     |
| Provider discovery & search        | ✅ In Scope | ✅ Done     |
| Booking flow (basic)               | ✅ In Scope | ✅ Done     |
| Booking flow (scheduling, no-show) | ✅ In Scope | 🚧 Phase 2  |
| Invoice/Order creation             | ✅ In Scope | ✅ Done     |
| Order payment                      | ✅ In Scope | 🚧 In Progress (Pending Integration) |
| Delivery confirmation (OTP)        | ✅ In Scope | ✅ Done     |
| Escrow hold & auto-release         | ✅ In Scope | 🚧 Partial (Missing Logic) |
| Complaint filing                   | ✅ In Scope | ✅ Done     |
| Admin complaint management         | ✅ In Scope | ✅ Done     |
| Admin payment management           | ✅ In Scope | ✅ Done     |
| Admin user management              | ✅ In Scope | ✅ Done     |
| Order process tracking (wash/iron) | ✅ In Scope | 🚧 Phase 2  |
| Booking fee system                 | ✅ In Scope | 🚧 Phase 2  |
| Late delivery penalties            | ✅ In Scope | 🚧 Phase 2  |
| AI clothing detection              | ❌ Post-MVP | ❌ Post-MVP |
| Route optimization                 | ❌ Post-MVP | ❌ Post-MVP |
| Subscription plans                 | ❌ Post-MVP | ❌ Post-MVP |
| Native mobile apps                 | ❌ Post-MVP | ❌ Post-MVP |

### 14.2 Timeline

| Phase                   | Duration    | Deliverables                             |
| :---------------------- | :---------- | :--------------------------------------- |
| **Phase 1: Foundation** | Weeks 1-4   | Auth, User management, Provider profiles |
| **Phase 2: Core Flow**  | Weeks 5-8   | Booking, Invoicing, Order management     |
| **Phase 3: Payments**   | Weeks 9-10  | Razorpay integration, Escrow logic       |
| **Phase 4: Disputes**   | Weeks 11-12 | Complaint system, Admin resolution       |
| **Phase 5: Polish**     | Weeks 13-14 | Notifications, Edge cases, Testing       |
| **Phase 6: Launch**     | Week 15     | Soft launch (Bangalore only)             |

### 14.3 Critical Implementation Gaps (Pre-Launch)

> [!IMPORTANT]
> The following items are marked as "Done" in previous versions but require immediate engineering attention to meet FAANG-grade standards.

| Component | Current State | Required Action |
| :--- | :--- | :--- |
| **Payment Gateway** | Logic placeholders exist | Install `razorpay` SDK; Implement `/api/orders/[id]/pay`; Handle webhooks |
| **Escrow Logic** | Basic timer exists | Implement `releaseEscrowPayment` validations (check for open complaints); specific freeze logic |
| **Admin Controls** | Read-only views | Add generic "Refund" and "Penalty" modification actions in Admin API |


---

## 15. Appendix

### 15.1 Glossary

| Term     | Definition                                           |
| :------- | :--------------------------------------------------- |
| Booking  | Pre-order commitment with deadline and booking fee   |
| Order    | Confirmed service after invoice approval             |
| Escrow   | Funds held by platform until complaint window closes |
| No-Show  | Provider failure to arrive at confirmed pickup time  |
| Deadline | Maximum date by which laundry must be delivered      |

### 15.2 References

- [Razorpay Escrow API Docs](https://razorpay.com/docs/)
- [Twilio SMS API](https://www.twilio.com/docs/sms)
- [MongoDB Geospatial Queries](https://www.mongodb.com/docs/manual/geospatial-queries/)
- [NextAuth.js Documentation](https://next-auth.js.org/)

### 15.3 Revision History

| Version | Date       | Author       | Changes                                      |
| :------ | :--------- | :----------- | :------------------------------------------- |
| 1.0     | 2025-12-21 | Product Team | Initial draft                                |
| 2.0     | 2025-12-21 | Product Team | FAANG-grade rewrite with full specifications |

---

**Document Status:** ✅ Approved for Development

**Sign-off:**

- [ ] Product Lead
- [ ] Engineering Lead
- [ ] Design Lead
- [ ] Legal Review
