# LaundryEase

---

## CHAPTER 1

## INTRODUCTION

Introducing LaundryEase, a comprehensive digital laundry management platform designed for both customers (seekers) and laundry service providers. The application enables customers to effortlessly discover nearby laundry providers, place service orders for washing, drying, and ironing, and track the real-time status of their laundry through every stage—from pickup to delivery. For laundry shop owners and employees, the platform provides robust tools to manage incoming bookings, update order statuses, generate itemized digital invoices, and receive automated payouts through an escrow-backed payment system. With role-based access for customers, providers, and administrators, LaundryEase ensures a seamless, transparent, and trustworthy experience for all users. The platform replaces informal promises and manual record-keeping with a verifiable digital workflow, bringing accountability and convenience to the local laundry service industry.

### 1.1 LaundryEase Management System

The LaundryEase management system is designed to streamline the entire lifecycle of a laundry service transaction, serving three distinct user roles: seekers (customers), providers (laundry shop owners and employees), and administrators (platform operators).

**For Seekers (Customers):**
Customers can register on the platform, verify their identity via email and phone OTP, and search for nearby laundry providers using location-based discovery powered by Google Maps. Once a provider is selected, the customer can request a booking, pay a booking fee through Razorpay, and choose from services such as washing, drying, and ironing. After the provider inspects the items and issues a digital invoice, the customer reviews the itemized bill—including item photos, quantities, unit prices, discounts, and delivery charges—and either approves and pays or rejects with a reason. Throughout the order lifecycle, the customer can track progress through explicit stages: processing, washing, ironing, ready, out for delivery, and delivered. Delivery is confirmed through a one-time password (OTP), after which the payment enters a 24-hour escrow hold before being released to the provider. Customers can also file complaints within 24 hours of delivery, view their complete order and payment history, and leave star-rated reviews for providers.

**For Providers (Shop Owners and Employees):**
Providers register their business, set a service radius and capacity limits, and link their bank account for automated payouts. They receive booking requests from nearby customers, accept or reject them based on availability, and propose pickup time slots. After pickup and item inspection, providers generate detailed invoices with item breakdowns and optional photos. Once the customer pays, the provider advances the order through the laundry workflow stages and completes the transaction by delivering the laundry and collecting the delivery OTP. Payouts are processed automatically after the escrow window, with a 5% platform commission deducted from the subtotal. Providers can also manage their profiles, respond to dispute messages, and view their earnings and payout history.

**For Administrators:**
Administrators oversee the entire platform, managing complaints and disputes through a structured workflow with 3-party chat (seeker, provider, admin). They can issue full or partial refunds, release or hold escrow funds, manage users (suspend, flag, or block accounts), and monitor platform health through operational alerts covering overdue payouts, failure spikes, and complaint backlogs.

### 1.2 Features of Existing Systems

Traditional laundry service management in most local businesses relies on the following methods:

- Customer bookings are handled via phone calls, messaging apps, or walk-in visits to the shop.
- Orders are recorded in paper-based registers, handwritten notebooks, or simple spreadsheets.
- Order progress is communicated informally through verbal updates or phone calls.
- Billing is done manually using printed or handwritten receipts and simple calculators.
- Pricing is often estimated verbally and may vary from one transaction to another.
- Customer history and service records are maintained in physical files or not recorded at all.
- Payment is typically collected in cash at the time of delivery, with no guarantee for either party.
- Some businesses use basic point-of-sale software that handles billing but not order tracking or customer management.

### 1.3 Limitations of Existing Systems

- **No real-time status updates:** Customers have no visibility into the current stage of their laundry and must call the shop to inquire.
- **High risk of manual entry errors:** Handwritten records are prone to mistakes in item counts, pricing, and customer details, leading to misplaced or incorrectly processed orders.
- **Difficulty in managing historical data:** Retrieving past order records, customer preferences, or revenue information from paper logs is time-consuming and unreliable.
- **Lack of automated invoicing:** Generating accurate, itemized invoices requires manual calculation, which is error-prone and slow.
- **No payment security or escrow:** Cash-based transactions offer no guarantee to either party—providers risk non-payment after completing work, and customers risk paying without receiving satisfactory service.
- **No centralized communication:** There is no formal system for handling complaints, disputes, or service feedback between customers and providers.
- **Inability to scale:** Manual systems break down as the number of customers, orders, and staff increases, making it difficult to grow the business.
- **No location-based discovery:** Customers cannot easily find laundry providers that serve their area, and providers cannot define or manage their service coverage.

### 1.4 Area and Category of the Project Work

The LaundryEase project encompasses several key areas and categories:

- **Information Technology (IT):** The platform is built as a full-stack web application using modern technologies including Next.js, React, TypeScript, and MongoDB, following industry-standard software engineering practices.
- **Web Application Development:** LaundryEase is a responsive web application accessible from both desktop and mobile browsers, with progressive web app (PWA) capabilities.
- **Service Operations Management:** The system digitizes and automates the end-to-end workflow of laundry service operations, from customer discovery and booking through order processing, delivery, and payment settlement.
- **Financial Technology (FinTech):** The platform integrates Razorpay for secure payment processing, escrow management, and automated provider payouts, incorporating commission-aware settlement logic.
- **Geospatial Computing:** Location-based provider discovery, radius-based service matching, and geofence-verified provider arrival use Google Maps APIs and MongoDB geospatial queries.
- **User Experience (UX) Design:** The interface is designed for ease of use across three distinct user roles, with real-time feedback, accessible UI components (shadcn/ui), and smooth animations (Framer Motion).
- **Data Management and Security:** The system enforces strict data validation (Zod schemas), role-based access control, password hashing (bcrypt), CSRF protection, Content Security Policy, rate limiting, and secure OTP-based verification.

---

## CHAPTER 2

## PROBLEM DEFINITION AND METHODOLOGY

### 2.1 Introduction

The local laundry service industry has traditionally operated on informal, trust-based transactions. Customers hand over personal clothing to providers with no documented proof of what was submitted, no visibility into the progress of their order, and no guaranteed timeline for completion. Providers, in turn, invest time, water, electricity, and labor with no assurance that the customer will pay upon delivery, or that disputed claims can be resolved with evidence. This lack of structure results in miscommunication, lost items, billing disputes, and operational inefficiency on both sides.

LaundryEase was conceived to bridge this trust gap by converting the informal laundry transaction into a verifiable, digitally recorded sequence of states—from booking to delivery—backed by an escrow payment system that protects both parties.

### 2.2 Problem Definition

The fundamental problem in the local laundry service industry is the absence of a transparent, accountable system that connects customers and laundry providers through a verifiable workflow.

Specifically, the following problems exist:

1. **Trust deficit:** Customers lack confidence that their clothes will be handled properly, and providers lack confidence that they will be compensated for their work. Neither party has a mechanism to prove what happened during the transaction.

2. **Operational opacity:** There is no standardized method to track the progress of a laundry order. Terms like "in progress" or "almost done" create ambiguity, leading to frequent phone calls and frustration on both sides.

3. **Payment insecurity:** Cash-on-delivery models leave providers vulnerable to non-payment after they have already completed the work. Advance payment models leave customers vulnerable to unsatisfactory service with no recourse.

4. **Discovery failure:** Customers have no reliable way to find laundry providers who actually serve their geographic area. Providers have no way to define, manage, or advertise their service radius.

5. **Dispute resolution vacuum:** When something goes wrong—damaged clothes, missed deadlines, pricing disagreements—there is no evidence trail and no structured process for resolution.

6. **Data loss:** Manual record-keeping means that order histories, customer preferences, revenue trends, and operational metrics are either lost or inaccessible, preventing business growth and improvement.

### 2.3 Objectives

The primary objectives of the LaundryEase project are:

1. **To develop a location-aware platform** that enables customers to discover laundry service providers within their geographic area using radius-based search powered by geospatial queries.

2. **To implement a verifiable order lifecycle** that tracks every laundry order through explicit states (requested → accepted → confirmed → invoiced → processing → washing → ironing → ready → out for delivery → delivered), providing real-time visibility to both customers and providers.

3. **To integrate an escrow-backed payment system** using Razorpay that ensures providers are guaranteed payment before starting work and customers are protected until delivery is confirmed via OTP.

4. **To automate invoicing and billing** so that providers can generate accurate, itemized digital invoices with item photos, quantities, unit prices, discounts, and delivery charges, eliminating manual calculation errors.

5. **To create a structured complaint and dispute resolution system** with a 3-party chat workflow (seeker, provider, admin), evidence attachments, response deadlines, and commission-aware settlement options.

6. **To provide role-based dashboards** for seekers, providers, and administrators, each tailored to their specific operational needs and responsibilities.

7. **To establish platform health monitoring** through automated alerts, cron-based anomaly detection, and operational metrics that ensure reliable, uninterrupted service.

### 2.4 Motivation

The motivation for LaundryEase stems from observing repeated failures in local laundry service transactions:

- A customer drops off clothes and receives a vague promise: "It will be ready by Thursday." Thursday arrives with no update, no call, and no accountability.
- A provider completes a large order only to have the customer dispute the price at delivery, with no documented agreement to reference.
- A provider damages a garment but there is no photographic evidence of the item's original condition, and the dispute devolves into a "he said, she said" scenario.
- A small laundry business wants to grow but cannot track how many orders it processes, what its revenue trends are, or which customers are repeat users.

These problems are not technology problems—they are trust and process problems. LaundryEase is motivated by the belief that a well-designed digital workflow, backed by escrow payments and explicit state tracking, can turn local laundry services from informal gambles into reliable, professional transactions.

The growing penetration of smartphones and digital payment systems (like UPI through Razorpay) in India makes this the right time to introduce such a platform, as both customers and providers are increasingly comfortable with digital tools.

### 2.5 Methodology

The development of LaundryEase follows an **iterative, component-driven methodology** combining elements of Agile development and domain-driven design:

1. **Requirements Gathering:**
   - Identified core user roles (seeker, provider, admin) and their pain points through problem analysis.
   - Defined the booking-to-delivery lifecycle as a finite state machine with explicit, validated transitions.
   - Established non-negotiable constraints: payment before work, OTP-verified delivery, escrow-backed settlement.

2. **System Architecture:**
   - Adopted **Next.js (App Router)** as a full-stack framework for server-side rendering, API routes, and React-based UI in a single codebase.
   - Selected **MongoDB** for its flexible document model and native geospatial query support (2dsphere indexes for radius-based provider search).
   - Integrated **Razorpay** for payment capture, escrow, and automated provider payouts via RazorpayX.

3. **Iterative Development:**
   - Built features incrementally: authentication → provider profiles → booking flow → invoice generation → order tracking → payment/escrow → complaints → admin tools.
   - Each feature was developed with server-side validation (Zod schemas), role-based access control, and comprehensive error handling.

4. **Testing Strategy:**
   - **Unit tests** with Vitest for business logic (cancellation policies, payout calculations, state transitions).
   - **End-to-end tests** with Playwright for critical user journeys (booking lifecycle, complaint flow, settlement chain).
   - **In-memory MongoDB** (mongodb-memory-server) for isolated database testing.

5. **Quality Gates:**
   - Automated CI/CD pipeline with TypeScript type checking, ESLint linting, unit tests, and production builds as mandatory gates before deployment.
   - Documentation sync checks to ensure system documentation matches the actual codebase.

6. **Deployment:**
   - Deployed on **Vercel** for serverless execution with automatic scaling.
   - Cron jobs scheduled via Vercel Cron for auto-rejection of stale bookings, no-show detection, and payout processing.

### 2.6 Scope

**In Scope:**

- User registration and authentication with email and phone verification (magic links, OTP).
- Location-based provider discovery using Google Maps geocoding and MongoDB geospatial queries.
- Complete booking lifecycle: request, accept/reject, pickup scheduling, reschedule, cancellation with fee policies (including seeker-initiated cancellation at `invoice_created` stage with mandatory booking fee forfeiture).
- Invoice generation with itemized breakdowns, item photos, discounts, and delivery charges.
- Order lifecycle tracking through explicit process states (washing, ironing, ready, out for delivery, delivered).
- Escrow-backed payment system with booking fees, invoice payments, OTP-verified delivery, and timed payout release.
- Complaint and dispute resolution with real-time 3-party Socket.IO chat, typing indicators, evidence attachments, and admin-mediated settlement.
- Real-time order chat between seekers and providers on active orders via Socket.IO (`order:<id>` rooms), with JWT-authenticated connections, typing indicators, push-based message delivery, message persistence in the `order_chats` MongoDB collection, support for voice notes, multiple photo attachments, and message deletion capabilities.
- Provider bank account integration and automated payouts via RazorpayX with 5% platform commission.
- Review and rating system (1–5 stars) post-delivery.
- Admin dashboard for user management, complaint triage, payment oversight, and operational monitoring.
- Automated cron jobs for stale booking rejection, no-show detection, and email outbox processing.
- Security features: rate limiting, CSP, CSRF protection, password policies, and role-based access control.

**Out of Scope:**

- The platform does **not** provide logistics or delivery riders; providers handle their own pickup and delivery.
- The platform does **not** set or control pricing; providers define their own rate cards and fees.
- Instant or on-demand pickup within minutes is not supported; the system is designed for scheduled, reliable service.
- Native mobile applications (iOS/Android) are not included in the current version; the platform is a responsive web application.
- Algorithmic pricing, dynamic surge pricing, or AI-based service recommendations are not part of the current scope.

---

## CHAPTER 3

## ANALYSIS

### 3.1 Requirement Analysis

Requirement analysis is the systematic process of identifying, documenting, and validating the needs of a proposed system through observation of current practices, analysis of user workflows, and evaluation of technical constraints. For LaundryEase, the requirement analysis was conducted by examining the operational workflows of local laundry businesses, identifying pain points experienced by both customers and service providers, and studying the capabilities and gaps of existing solutions.

The analysis identified two primary user groups with distinct but interconnected needs:

**Customers (Seekers)** require the ability to:

- Discover laundry providers who serve their geographic area.
- Place orders with clear service selection (wash, dry, iron).
- Track the real-time status of their laundry through each processing stage.
- Review itemized invoices before committing payment.
- Confirm delivery through a secure verification mechanism.
- File complaints and receive resolution within a defined timeframe.
- Access their complete order and payment history.

**Service Providers** require the ability to:

- Define their service area, capacity, and pricing.
- Receive and manage booking requests with fee-gated acceptance.
- Inspect items and generate itemized digital invoices with optional photos.
- Advance orders through processing stages with validated state transitions.
- Receive guaranteed, automated payouts after delivery confirmation.
- Respond to complaints through a structured mediation channel.
- View earnings, payout history, and customer reviews.

**Platform Administrators** require the ability to:

- Monitor all bookings, orders, and transactions across the platform.
- Resolve disputes through a structured complaint workflow with evidence.
- Manage user accounts (suspend, flag, block).
- Oversee payment operations and intervene in payout failures.
- Receive automated alerts for operational anomalies.

### 3.2 Existing System

The existing system in the local laundry service industry is predominantly manual and unstructured. In the current workflow:

1. **Service Discovery:** Customers find laundry shops through word-of-mouth, local advertisements, or by physically visiting shops in their neighborhood. There is no digital mechanism for a customer to determine which providers serve their specific location.

2. **Order Placement:** Customers bring clothes to the shop or call to arrange a pickup. The order details are recorded in a notebook or ledger, often with minimal item-level detail. There is no standardized format, and items may be miscounted or mislabeled.

3. **Pricing and Billing:** Pricing is communicated verbally and may vary between customers or even between visits. Bills are calculated manually using paper and pen or a basic calculator. Receipts, if provided, are handwritten and lack itemization.

4. **Order Tracking:** There is no systematic tracking of order progress. Customers who want an update must call the shop or visit in person. The shop staff may not know the exact stage of any given order without physically checking.

5. **Payment:** Payment is collected in cash at the time of delivery. There is no advance commitment, no escrow mechanism, and no digital record of the transaction. Disputes about pricing or payment are resolved informally, often unfairly.

6. **Record Keeping:** Historical data—past orders, customer preferences, revenue figures—is either stored in physical files that degrade over time or not maintained at all. This makes it impossible to analyze business trends or resolve retroactive disputes.

7. **Complaints:** When service quality issues arise, there is no formal process. Customers may argue at the counter, post on social media, or simply stop patronizing the business. There is no evidence trail and no mediation mechanism.

### 3.3 Proposed System

The proposed system, LaundryEase, is a full-stack web application that digitizes and automates the entire laundry service workflow from customer discovery to payment settlement. It addresses every limitation of the existing manual system through the following architecture:

1. **Location-Based Discovery:** Customers enter their location, and the system returns only providers whose defined service radius covers that coordinate. This is powered by MongoDB geospatial queries (2dsphere indexes) and Google Maps geocoding, ensuring that customers see only providers who can actually serve them.

2. **Structured Booking Workflow:** Customers request bookings through the platform. A ₹50 booking fee, paid via Razorpay, gates provider acceptance—ensuring commitment from both sides. Providers accept or reject requests based on their current capacity (configurable limit). Pickup time slots are proposed, negotiated, and confirmed digitally with a minimum 2-hour advance notice.

3. **Digital Invoice Generation:** After pickup and physical inspection of items, providers create itemized invoices through the platform. Each invoice includes item names, quantities, unit prices, optional item photos, discounts, delivery charges, and a calculated total. Customers review the complete invoice and approve or reject it with a reason before any payment is captured.

4. **Escrow-Backed Payment:** When a customer approves and pays an invoice, the funds are captured through Razorpay and held in escrow. The payment is released to the provider only after the customer confirms delivery via a one-time password (OTP) with a 10-minute validity window. After OTP confirmation, the payment enters a 24-hour escrow hold window before payout processing begins. A 5% platform commission is calculated on the pre-discount subtotal and deducted automatically.

5. **Explicit Order Lifecycle:** Each order progresses through validated states: invoiced → processing → washing → ironing → ready → out for delivery → delivered. State transitions are enforced server-side; no state can be skipped or reversed. Both customers and providers see the same timeline of progress.

6. **Complaint and Dispute Resolution:** Customers can file complaints within 24 hours of delivery, immediately freezing the escrow. Administrators triage complaints through a state machine (open → accepted → in_review → resolved/rejected) with a 3-party chat system. Resolution options include full payout release, full refund of the distributable amount, partial split settlement, or complaint rejection—all commission-aware.

7. **Real-Time Order Chat:** Once an order is created (after invoice payment), seekers and providers can exchange messages in real time via Socket.IO. The chat operates on `order:<id>` rooms with JWT-authenticated connections and DB-verified participant authorization. Messages are persisted in the `order_chats` MongoDB collection and pushed live to all connected participants — no polling required. The system supports text, voice notes, up to 5 photo attachments per message, and a three-tier message deletion system (for me, for everyone, admin hard delete). The provider messages inbox, order-status page, and seeker order detail page all embed the order chat interface.

8. **Automated Payouts:** Provider bank accounts are linked and verified through Razorpay. Upon escrow release, payouts are initiated automatically via RazorpayX with idempotent processing, failure tracking, and admin manual intervention capability.

9. **Automated Background Operations:** Cron jobs handle stale booking auto-rejection (2-hour timeout), no-show detection (30 minutes past confirmed pickup), and email outbox processing with exponential backoff retry.

### 3.4 Requirement Specification

The LaundryEase system provides a comprehensive interface for managing laundry service operations digitally. The functional and non-functional requirements of the proposed system are specified below.

#### 3.4.1 Functional Requirements

- **User Registration and Authentication:** Multi-step registration with email and phone OTP verification, Google OAuth support, and password policy enforcement (minimum 8 characters, 1 uppercase, 1 number, 1 special character). Magic link email authentication as an alternative login method.
- **Role-Based Access Control:** Three distinct roles (seeker, provider, admin) with role-specific dashboards, API authorization, and data visibility rules.
- **Location-Based Provider Discovery:** Geospatial search using customer coordinates to find providers within their defined service radius. Results include provider ratings, reviews, and service details.
- **Booking Management:** Full booking lifecycle with states (requested, accepted, rejected, pickup_proposed, reschedule_requested, confirmed, invoice_created, completed, cancelled). Booking fee payment (₹50) gates provider acceptance.
- **Pickup Scheduling:** Provider-proposed pickup slots with minimum 2-hour advance notice, customer confirmation, and reschedule support without cancellation.
- **Invoice Generation:** Itemized digital invoices with item name, quantity, unit price, optional item photos, provider-applied discounts, delivery charges, and calculated totals. Customer review with approve/reject workflow.
- **Payment Processing:** Razorpay integration for booking fee payment, invoice payment capture, HMAC-SHA256 signature verification, and webhook-based payment confirmation.
- **Escrow Management:** Post-delivery OTP confirmation triggers 24-hour escrow hold. Automatic release after cooling period unless a complaint is filed.
- **Order Lifecycle Tracking:** Validated state progression (invoiced → processing → washing → ironing → ready → out for delivery → delivered) with server-side transition enforcement.
- **Delivery Verification:** OTP-based delivery confirmation with 10-minute validity window, ensuring both parties agree on handoff.
- **Complaint System:** 24-hour filing window post-delivery, immediate escrow freeze, admin-mediated 3-party chat with evidence attachments, and commission-aware settlement (full release, full refund, partial split, rejection).
- **Automated Payouts:** RazorpayX-based provider payouts with 5% platform commission, idempotent processing, failure tracking, and admin manual intervention.
- **Review System:** Post-delivery star ratings (1–5) with optional text comments, aggregated to provider profile.
- **Cancellation Policies:** Seeker cancels within 2 hours of booking creation → full refund of booking fee. Seeker cancels after 2-hour window (statuses: accepted, pickup_proposed, reschedule_requested, confirmed) → booking fee forfeited as compensation to provider. Seeker cancels at `invoice_created` stage (before paying the invoice) → booking fee always forfeited regardless of time window, because the provider has already physically collected and catalogued items. Provider cancellation at any pre-arrival stage → full refund to seeker. Post-pickup-slot-time cancellation blocked for seekers except at `invoice_created` stage (where the slot is necessarily in the past). Once an invoice is paid and an order is created, cancellation is permanently blocked for both parties.
- **Real-Time Order Chat:** Seekers and providers can exchange messages on active orders in real time via Socket.IO (`order:<id>` rooms). Messages are persisted in the `order_chats` MongoDB collection and pushed live to connected participants. Features include typing indicators, voice notes, up to 5 photo attachments per message, and the ability to delete messages. The provider messages inbox aggregates recent order chats. The provider order-status page and seeker order detail page embed inline chat panels.
- **Notification System:** Email notifications for booking updates, invoice creation, payment confirmations, delivery OTP, and complaint status changes via email outbox with retry.
- **Admin Operations:** User management (suspend, flag, block), complaint triage, manual payout intervention, and operational health monitoring with automated alerts.
- **Cron Automation:** Auto-rejection of stale bookings (2-hour timeout), no-show detection (30 minutes past pickup), and email outbox batch processing.

#### 3.4.2 Non-Functional Requirements

- **Usability:** The interface must be intuitive and accessible for users with varying levels of technical proficiency. Responsive design must support desktop, tablet, and mobile viewports.
- **Performance:** API responses must complete within acceptable latency. Client-side data fetching uses SWR for caching and revalidation to minimize redundant network requests.
- **Security:** The system must enforce Content Security Policy (CSP), CSRF/origin validation, bcrypt password hashing (10 salt rounds), rate limiting on sensitive endpoints (auth, admin, cron), and HMAC-SHA256 payment signature verification.
- **Scalability:** The architecture must support a growing number of users, orders, and concurrent operations through serverless deployment (Vercel), MongoDB indexing (30+ indexes including geospatial), and stateless API design.
- **Reliability:** Transactional emails must be delivered through an outbox pattern with exponential backoff retry (up to 5 attempts). Payout processing must be idempotent with lock-based concurrency control and stale lock recovery.
- **Data Integrity:** All monetary calculations must use Decimal.js to prevent floating-point errors. Invoice immutability is enforced after payment. State transitions are validated server-side with atomic database operations.
- **Availability:** The platform must be accessible at all times through serverless infrastructure with automatic scaling and zero-downtime deployments.
- **Observability:** Structured JSON logging (Pino), application performance monitoring (Datadog/dd-trace), StatsD metrics, and cron job tracking provide full operational visibility.

#### 3.4.3 Environmental Details

| Component            | Technology                                      |
| -------------------- | ----------------------------------------------- |
| **IDE**              | Visual Studio Code                              |
| **Framework**        | Next.js 16.1.6 (App Router)                     |
| **Language**         | TypeScript 5                                    |
| **Frontend**         | React 19.2.4                                    |
| **Styling**          | Tailwind CSS 4.2.1 + shadcn/ui                  |
| **UI Components**    | Radix UI primitives + Lucide React icons        |
| **Animations**       | Framer Motion 12.35.2                           |
| **Database**         | MongoDB 7.1 (native driver)                     |
| **Authentication**   | NextAuth v5.0.0-beta (Auth.js, JWT sessions)    |
| **Payments**         | Razorpay 2.9.6 + RazorpayX                      |
| **Maps & Location**  | Google Maps APIs + use-places-autocomplete      |
| **SMS**              | Twilio 5.12.2                                   |
| **Email**            | Nodemailer 8.0.2                                |
| **Image Hosting**    | Cloudinary 2.9.0                                |
| **Validation**       | Zod 4.3.6                                       |
| **Forms**            | React Hook Form 7.71.2                          |
| **Real-Time**        | Socket.IO 4.8.3 (server + client)               |
| **Data Fetching**    | SWR 2.4.1                                       |
| **Logging**          | Pino 10.3.1                                     |
| **Financial Math**   | Decimal.js 10.6.0                               |
| **APM**              | Datadog (dd-trace 5.89.0 + hot-shots 14.1.1)    |
| **Unit Testing**     | Vitest 4.0.18                                   |
| **E2E Testing**      | Playwright 1.58.2                               |
| **Deployment**       | Vercel (serverless)                             |
| **Version Control**  | Git + GitHub                                    |
| **Operating System** | Windows / Linux / macOS                         |
| **Browser Support**  | Chrome, Edge, Firefox, Safari (modern versions) |

#### 3.4.4 Hardware Requirements

##### 3.4.4.1 Client & Server Requirements

**Development Machine (Client):**

| Component        | Minimum Requirement               |
| ---------------- | --------------------------------- |
| Processor        | Intel Core i3 or equivalent       |
| Memory (RAM)     | 4 GB or above                     |
| Storage          | 10 GB free disk space             |
| Display          | 1366 × 768 resolution or higher   |
| Internet         | Stable broadband connection       |
| Operating System | Windows 10+ / macOS 12+ / Linux   |
| Browser          | Chrome 90+, Edge 90+, Firefox 90+ |

**Server (Production — Vercel Serverless):**

| Component | Specification                              |
| --------- | ------------------------------------------ |
| Compute   | Vercel serverless functions (auto-scaling) |
| Database  | MongoDB Atlas (cloud-hosted, replica set)  |
| CDN       | Vercel Edge Network (global distribution)  |
| Storage   | Cloudinary CDN for image assets            |
| SSL/TLS   | Automatic HTTPS via Vercel                 |

**Mobile Device (End User):**

| Component        | Minimum Requirement                |
| ---------------- | ---------------------------------- |
| Operating System | Android 8.0+ / iOS 13+             |
| Memory (RAM)     | 2 GB or above                      |
| Storage          | 100 MB free space                  |
| Internet         | Mobile data (3G or above) or Wi-Fi |
| Browser          | Updated Chrome, Safari, or Firefox |

#### 3.4.5 Software Requirements

##### 3.4.5.1 Web Application Requirements

| Layer                   | Technology                        | Purpose                                                                                                                 |
| ----------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Framework**           | Next.js 16.1.6 (App Router)       | Full-stack React framework with SSR, SSG, and API routes                                                                |
| **Frontend**            | React 19.2.4 + TypeScript 5       | Type-safe, component-driven user interface                                                                              |
| **Styling**             | Tailwind CSS 4 + shadcn/ui        | Utility-first CSS with accessible component library                                                                     |
| **Database**            | MongoDB 7.1 (native driver)       | Document-based NoSQL database with geospatial query support                                                             |
| **Authentication**      | NextAuth v5 (Auth.js beta)        | Google OAuth + email/password credentials with JWT sessions                                                             |
| **Payment Gateway**     | Razorpay + RazorpayX              | Payment capture, escrow holds, signature verification, and automated provider payouts                                   |
| **Maps & Geocoding**    | Google Maps APIs                  | Places Autocomplete, Geocoding, Maps JavaScript API for location-based discovery                                        |
| **SMS Service**         | Twilio                            | Phone OTP delivery for verification and delivery confirmation                                                           |
| **Email Service**       | Nodemailer                        | Transactional emails (OTP, magic links, password reset, delivery codes) via outbox queue                                |
| **Image CDN**           | Cloudinary                        | Upload, transform, and serve images for invoices, profiles, and complaint evidence                                      |
| **Schema Validation**   | Zod 4                             | Runtime type validation for API inputs and data integrity                                                               |
| **Form Management**     | React Hook Form                   | Performant, declarative form state handling                                                                             |
| **Real-Time Messaging** | Socket.IO 4.8.3 (server + client) | Bidirectional WebSocket communication for live order/complaint chat with typing indicators, voice, photos, and deletion |
| **Client Caching**      | SWR                               | Stale-while-revalidate data fetching with automatic cache invalidation                                                  |
| **Financial Math**      | Decimal.js                        | Arbitrary-precision decimal arithmetic for monetary calculations                                                        |
| **Logging**             | Pino                              | Structured JSON logging with secret redaction                                                                           |
| **APM & Metrics**       | Datadog (dd-trace + StatsD)       | Application performance monitoring, distributed tracing, and custom metrics                                             |
| **Unit Testing**        | Vitest + mongodb-memory-server    | Fast unit tests with in-memory database isolation                                                                       |
| **E2E Testing**         | Playwright                        | Cross-browser end-to-end testing for critical user journeys                                                             |
| **CI/CD**               | GitHub Actions + Vercel           | Automated quality gates (typecheck, lint, test, build) and serverless deployment                                        |

### 3.5 Feasibility Study

A feasibility study evaluates whether the proposed system can be successfully developed, deployed, and operated within practical constraints. The LaundryEase project is assessed across three dimensions: technical, economic, and operational.

#### 3.5.1 Technical Feasibility

LaundryEase is technically feasible. The project is built entirely on mature, well-documented, open-source technologies with large developer communities and active maintenance:

- **Next.js** and **React** are industry-standard frameworks used by companies like Netflix, Uber, and Airbnb, ensuring long-term support and extensive ecosystem resources.
- **MongoDB** provides native geospatial indexing (2dsphere) that directly supports the radius-based provider discovery feature, eliminating the need for custom spatial algorithms.
- **Razorpay** offers a production-ready payment API with built-in support for order creation, payment capture, refunds, and automated payouts (RazorpayX), including test mode for development.
- **Twilio** and **Nodemailer** provide reliable, API-based SMS and email delivery with well-established SDKs.
- **Vercel** supports zero-configuration deployment of Next.js applications with serverless functions, automatic scaling, and built-in cron scheduling.

All required APIs and services offer free development tiers or test modes, allowing the entire system to be developed and tested without production costs. The development team's proficiency in JavaScript/TypeScript, React, and MongoDB makes the technical skills requirement manageable. Therefore, the project is technically feasible.

#### 3.5.2 Economic Feasibility

LaundryEase is economically feasible. The development and operational costs are minimal relative to the value delivered:

- **Development tools** (VS Code, Git, Node.js) are free and open-source.
- **Frameworks and libraries** (Next.js, React, Tailwind CSS, shadcn/ui, Zod, Vitest, Playwright) are open-source with no licensing fees.
- **Cloud services** offer free or low-cost tiers appropriate for initial deployment:
  - MongoDB Atlas: free tier (512 MB storage) suitable for development and early production.
  - Vercel: free tier for hobby projects with serverless function support.
  - Cloudinary: free tier (25 GB storage, 25 GB bandwidth).
  - Razorpay: no platform fee; charges only per-transaction commission.
  - Twilio: pay-as-you-go SMS pricing.
- **Revenue model**: The platform collects a 5% commission on each completed transaction, providing a sustainable revenue stream that scales with usage.
- **Operational savings**: By eliminating paper-based record-keeping, reducing phone call overhead, preventing billing errors, and automating payout calculations, the platform reduces operational costs for laundry businesses.

The low development cost, free-tier cloud infrastructure, and transaction-based revenue model make the project economically viable and self-sustaining.

#### 3.5.3 Operational Feasibility

LaundryEase is operationally feasible. The system is designed for adoption by users with varying levels of technical expertise:

- **For customers (seekers):** The booking and order tracking interface follows familiar e-commerce patterns (search, select, book, pay, track, confirm). No specialized knowledge is required beyond basic smartphone and web browser usage.
- **For providers:** The dashboard provides a straightforward workflow (accept booking → inspect items → create invoice → process order → deliver → collect OTP). Providers already manage these steps manually; the platform simply digitizes and organizes them.
- **For administrators:** The admin panel provides structured workflows for complaint resolution, user management, and payment oversight, with automated alerts that surface issues requiring attention without manual monitoring.
- **Automated operations** reduce human intervention: stale bookings are auto-rejected after 2 hours, no-show providers are auto-detected after 30 minutes, transactional emails are retried automatically with exponential backoff, and payouts are processed without manual initiation.
- **Observability infrastructure** (structured logging, APM, cron tracking, operational alerts) ensures that system health issues are detected and surfaced proactively, enabling rapid response.

Since the application aligns with real business workflows, requires no specialized training, and includes automated safeguards against common operational failures, the project is operationally feasible.
