import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { createRazorpayPayout } from "@/lib/razorpay";
import { Order } from "@/types/orders";
import { Provider } from "@/lib/db";
import { logger } from "@/lib/logger";
import { releaseEscrowPayment } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    // Authorization check - CRITICAL for production security
    const authHeader = req.headers.get("authorization");
    if (!env.CRON_SECRET) {
      logger.error(
        "CRON",
        "CRON_SECRET not configured - cron endpoint disabled"
      );
      return NextResponse.json(
        { error: "Cron endpoint not configured" },
        { status: 503 }
      );
    }

    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // CRITICAL: Require RAZORPAYX_ACCOUNT_NUMBER - validated in env.ts schema

    const { db } = await getDb();
    const now = new Date();

    // 1. Find orders ready for release
    const eligibleOrders = await db
      .collection<Order>("orders")
      .find({
        payment_status: "held",
        escrow_release_at: { $lte: now },
        // Ensure no open complaints
        // We can do a lookup or just rely on a separate query check per order for safety
      })
      .toArray();

    const results = [];

    for (const order of eligibleOrders) {
      // IDEMPOTENCY CHECK: Skip if payout already exists for this order
      if (order.payout_id) {
        results.push({
          orderId: order._id,
          status: "skipped_payout_exists",
          existingPayoutId: order.payout_id,
        });
        continue;
      }

      // Check for complaints (Safety Check)
      const openComplaint = await db.collection("complaints").findOne({
        order_id: order._id,
        status: { $in: ["open", "in_progress"] },
      });

      if (openComplaint) {
        results.push({ orderId: order._id, status: "blocked_by_complaint" });
        continue;
      }

      // Get Provider details for Fund Account
      const provider = await db
        .collection<Provider>("providers")
        .findOne({ _id: order.provider_id });

      if (!provider || !provider.razorpay_fund_account_id) {
        // Log error: Provider has no bank details
        logger.error(
          "CRON",
          `Provider ${order.provider_id} has no fund account linked. Payout failed for Order ${order._id}`
        );
        results.push({ orderId: order._id, status: "failed_no_fund_account" });
        continue;
      }

      // Calculate Payout Amount
      // 5% Commission
      const totalAmount = order.total_price;
      const commission = Math.round(totalAmount * 0.05 * 100) / 100; // Round to 2 decimal places
      const payoutAmount = totalAmount - commission;

      // Razorpay needs amount in paise (integer)
      const payoutAmountPaise = Math.round(payoutAmount * 100);

      try {
        // CRITICAL: Release Escrow FIRST (before initiating payout)
        // This ensures escrow checks (complaints, etc.) are enforced
        const escrowReleased = await releaseEscrowPayment(order._id);
        if (!escrowReleased) {
          // Escrow release failed (likely due to complaint or already released)
          results.push({ orderId: order._id, status: "escrow_release_failed" });
          continue;
        }

        // Initiate Payout (only after escrow is released)
        const payout = await createRazorpayPayout({
          account_number: env.RAZORPAYX_ACCOUNT_NUMBER,
          fund_account_id: provider.razorpay_fund_account_id,
          amount: payoutAmountPaise,
          currency: "INR",
          mode: "IMPS", // or NEFT/UPI
          purpose: "payout",
          narration: `Payout for Order #${order._id.toString().slice(-6)}`,
          reference_id: order._id.toString(),
        });

        // Update Order with payout details (payment_status already set to "released" by releaseEscrowPayment)
        // IDEMPOTENCY: Only update if payout_id doesn't exist (prevents overwriting existing payouts)
        const updateResult = await db.collection<Order>("orders").updateOne(
          { 
            _id: order._id,
            payout_id: { $exists: false }, // Only update if payout_id doesn't exist (idempotent)
          },
          {
            $set: {
              payout_status: "processing", // Razorpay Payouts are async, 'processing' is safe. Hook handles 'processed'.
              payout_id: payout.id,
              payout_initiated_at: new Date(),
              platform_commission: commission,
              provider_payout_amount: payoutAmount,
            },
          }
        );

        if (updateResult.matchedCount === 0) {
          // Payout was created but DB update failed (race condition) or already exists
          // Log warning but don't fail - payout_id already exists from previous run
          logger.warn("CRON", `Payout ID already exists for order (idempotent skip)`, {
            orderId: order._id,
            payoutId: payout.id,
          });
        }

        results.push({
          orderId: order._id,
          status: "payout_initiated",
          payoutId: payout.id,
        });
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        logger.error("CRON", `Payout error for Order ${order._id}`, err);
        results.push({
          orderId: order._id,
          status: "failed_razorpay_error",
          message: errorMessage,
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    logger.error("CRON", "Process payouts cron error", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
