# LaundryEase Product Requirements Document

## 1. Executive Summary

LaundryEase is a double-blind logistics and escrow platform connecting Seekers (customers) with Providers (cleaning services). It solves the "trust gap" in local services by holding payment in escrow until service delivery is authenticated via OTP. The system enforces a rigid 7-stage state machine to eliminate ambiguity about order status.

## 2. Goals & Non-Goals

### Goals

- **Eliminate Non-Payment Risk**: Ensure Providers are paid for completed work via Escrow.
- **Eliminate Service Uncertainty**: Provide Seekers with deterministic state tracking (e.g., `Washing`, `Ready`).
- **Enforce Geographic Viability**: Only allow matching within the Provider's economically viable radius.
- **Auditable History**: Maintain an immutable log of every status change and transaction.

### Non-Goals

- **Dynamic Pricing**: We do not algorithmically set prices. Providers define their own rate cards.
- **Instant On-Demand**: We are not a 10-minute pickup service. This is a scheduled workflow.
- **Logistics Fulfillment**: We do not provide delivery riders. Providers manage their own logistics.

## 3. Users & Roles

### Seeker

- **Definition**: Individual consumer requiring laundry services.
- **Capabilities**: Search by location, request bookings, pay invoices, track status, authenticate delivery (OTP).

### Provider

- **Definition**: Independent business or individual operator.
- **Capabilities**: Define service radius/rates, accept/reject bookings, generate invoices, update order state, receive payouts.

### Admin

- **Definition**: Platform operator.
- **Capabilities**: Resolve disputes (escrow release/refund), ban malicious actors.

## 4. Core User Flows

### A. Discovery & Booking (Handshake)

1.  **Search**: Seeker inputs location + deadline. System queries MongoDB for Providers where `distance(Seeker, Provider) <= Provider.radius`.
2.  **Request**: Seeker selects Provider → Requests Slot. State: `requested`.
3.  **Negotiation**: Provider accepts or rejects request. If accepted, State: `accepted` (Wait for Pickup).

### B. Pickup & Contract (Commitment)

1.  **Pickup**: Provider arrives. Verifies items.
2.  **Invoicing**: Provider creates `Invoice` based on actual items collected.
3.  **Escrow**: Seeker pays Invoice via Razorpay. Funds held in Platform Escrow.
4.  **Conversion**: `Booking` converts to `Order`. State: `invoiced`.

### C. Execution & Delivery (Settlement)

1.  **Processing**: Provider updates state: `Washing` → `Ironing` → `Ready`.
2.  **Delivery**: Provider marks `Out for Delivery`.
3.  **Authentication**: Provider delivers. Seeker provides OTP.
4.  **Release**: System verifies OTP. State: `delivered`. Funds moved from Escrow to Payout Queue (T+24h).

## 5. System Requirements

### Functional

- **Geospatial Search**: Must use `$geoWithin` or equivalent accurate distance calculation. Precision: 100m.
- **Booking Management**: Providers must be able to set "Capacity" (max concurrent bookings).
- **Escrow Logic**: System must hold funds. Payouts trigger only on `delivered` state + 24h cooling period.
- **OTP Verification**: Delivery confirmation requires 6-digit OTP generated at `Order` creation.

### Non-Functional

- **Consistency**: Order state must be strongly consistent. No eventual consistency for Payment status.
- **Security**: All PII (Phone, Address) accessible only to connected counterparty during active Booking.
- **Performance**: Search query < 200ms for 50km radius.

## 6. State Management & Lifecycle

### Booking States

| State       | Trigger         | Next Valid States              |
| :---------- | :-------------- | :----------------------------- |
| `requested` | Seeker Request  | `accepted`, `rejected`         |
| `accepted`  | Provider Action | `confirmed` (Pickup)           |
| `rejected`  | Provider Action | Terminal                       |
| `confirmed` | Seeker+Provider | `invoice_created`, `cancelled` |

### Order States (Post-Payment)

| State              | Description                                              |
| :----------------- | :------------------------------------------------------- |
| `invoiced`         | Payment locked in Escrow. Processing starts.             |
| `washing`          | Physical cleaning in progress.                           |
| `ironing`          | Finishing/Pressing.                                      |
| `ready`            | Ready for delivery/pickup.                               |
| `out_for_delivery` | Logistics active.                                        |
| `delivered`        | OTP Verified. Escrow timer starts. Terminal for Service. |

## 7. Data & Integrity Rules

- **Immutable Financials**: Once an Invoice is paid, line items cannot be edited.
- **Location Binding**: A Provider cannot change their location while active Bookings exist (or must handle conflict).
- **Concurrency**: A Provider cannot accept Bookings beyond their defined `Capacity`.

## 8. Security & Abuse Prevention

- **Payment Tokenization**: No raw card data stored. Razorpay tokens only.
- **Escrow Freeze**: Any Dispute/Complaint immediately freezes the Escrow timer.
- **Address Masking**: Seeker coordinates are public to search algorithm, but specific address `line1` is hidden until Booking is `accepted`.

## 9. Observability & Failure Strategy

- **Audit Logs**: All state transitions (`Booking`, `Order`) are timestamped.
- **Orphan Prevention**: Cron job checks for `requested` bookings older than 24h → Auto-expire.
- **Payment Reconciliation**: Daily job to verify `razorpay_order_id` vs Database `payment_status`.

## 10. Out of Scope

- **Laundry Machine IoT Integration**: Manual status updates only.
- **Route Optimization**: No multi-stop routing for providers.
- **Inventory Management**: We don't track Provider detergent stock.

## 11. Success Metrics

- **Dispute Rate**: < 1% of Orders.
- **Completion Rate**: `delivered` / `invoiced` > 98%.
- **Search-to-Booking**: Conversion > 15%.

## 12. Open Questions & Risks

- **Cash Payments**: Currently strictly digital. Risk: Providers accepting Cash bypasses Escrow revenue model.
- **No-Show Handling**: Prerequisite: How to penalize Seeker for no-show at Pickup? (Currently manual).
