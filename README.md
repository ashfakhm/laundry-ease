# LaundryEase

Laundry is an act of trust. You hand your most personal possessions to a stranger, hoping they return clean. Often, they don’t in time. Providers do the work, incurring costs, hoping to get paid. Often, they aren’t. This friction breaks the local service economy. LaundryEase exists to solve this specific "Trust Gap" by replacing handshake agreements with deterministic state and escrow-backed security.

## What This Product Is

A double-blind logistics and escrow operating system for independent laundry providers.

## The Problem

- **Asymmetric Risk**: Seekers risk damaged/lost clothes; Providers risk non-payment for completed labor.
- **State Ambiguity**: "Dropped off" is not a workflow. Without granular states (`Washing`, `Ironing`), users panic and call providers, killing productivity.
- **Logistics Blindness**: Distance is not just geometry; it is cost. Existing tools ignore the delivery margin.
- **Trust Failure**: Reviews are retroactive. We need safety _during_ the transaction.

## Core Principles

1.  **Escrow is Truth**: Financial commitment precedes physical work. Payment is held in neutral custody until the cycle completes.
2.  **State is Law**: If it isn't in the system, it didn't happen. Every physical action (Pickup, Wash, Fold, Deliver) must have a digital twin.
3.  **Proximity is Economics**: We only match parties where the unit economics of delivery work. We do not show providers who cannot afford to drive to you.
4.  **No Hidden Magic**: We do not "optimize" routing with AI. We give Providers explicit controls over their radius and pricing.

## How the System Works (Mental Model)

The system operates in five rigid stages. It does not allow skipping.

1.  **Geospatial Discovery**: The Seeker's location is indexed. We query a geospatial grid to find Providers whose service radius explicitly covers that coordinate.
2.  **Negotiation & Booking**: The Seeker requests a slot. The Provider accepts or rejects. This is a handshake. No money moves yet.
3.  **Invoicing & Escrow**: The Provider assesses the clothes and generates an `Invoice`. The Seeker pays. The system holds the funds (Escrow). The contract is now live.
4.  **Execution Lifecycle**: The Provider pushes the Booking through granular states: `Processing` → `Washing` → `Ironing` → `Ready`.
5.  **Release & Settlement**: Delivery is authenticated via OTP. The system releases the Escrow funds to the Provider.

## Key Capabilities

- **Geospatial Indexing**: MongoDB `$geoWithin` queries for precise service availability.
- **Escrow-Based Payments**: Razorpay integration that holds funds in a suspense account until delivery OTP verification.
- **Granular Lifecycle Tracking**: 7-stage state machine for transparent order progress.
- **Role-Based Workspaces**: Strict separation of concerns between `Seeker`, `Provider`, and `Admin`.

## What This Product Refuses to Do

- **We do not set prices**: We are not a gig-economy algo. Providers are independent businesses; they set their own rates and fees.
- **We do not mediate disputes with AI**: Conflict resolution is a human admin function. We build the evidence log; humans render the verdict.
- **We do not hide the provider**: This is not "Uber for Laundry". You know exactly who is washing your clothes.

## Who This Is For / Not For

- **For**: Professional local laundry businesses and serious independent operators who value payment security and workflow clarity.
- **For**: Busy Seekers who are tired of chasing vendors for status updates.
- **Not For**: Gig-workers looking for "instant jobs". This requires a business setup.
- **Not For**: Users expecting "instant on-demand" pickup in 10 minutes. This is scheduled service.

## Project Status & Direction

The Core functionality (Auth, Geospatial Search, Booking Flow, Escrow) is **Stable**.
The focus is now on hardening the "Edge Cases" (Dispute Resolution, Cancellation flows) and improving the mobile responsive experience for Providers in the field.
