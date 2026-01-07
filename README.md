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

1. Install dependencies.
2. Configure environment variables for the database and payments.
3. Run the development server.

If you need exact variable names or scripts, check `package.json` and `lib/env.ts`.

## 9. Project Status & Direction

Stable:

- Role-based flows (seeker/provider/admin)
- Location-based provider discovery
- Booking → invoicing → escrow → delivery confirmation loop

Intentionally not finished yet:

- Full dispute resolution experience (evidence capture exists; policy and tooling need hardening)
- Cancellation and no-show handling that enforces penalties consistently
- Provider field UX polish (mobile-first ergonomics)
