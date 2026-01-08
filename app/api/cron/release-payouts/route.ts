import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getHeldOrdersPastEscrowDate, releaseEscrowPayment } from "@/lib/db";
import { createRazorpayPayout } from "@/lib/razorpay";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic"; // Ensure not cached

export async function GET(req: Request) {
  // Verify Cron Secret - CRITICAL for production security
  const authHeader = req.headers.get("authorization");
  if (!env.CRON_SECRET) {
    logger.error("CRON", "CRON_SECRET not configured - cron endpoint disabled");
    return NextResponse.json(
      { error: "Cron endpoint not configured" },
      { status: 503 }
    );
  }

  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orders = await getHeldOrdersPastEscrowDate();
    const results = [];

    const { db } = await getDb();

    for (const order of orders) {
      try {
        // IDEMPOTENCY CHECK: Skip if payout already exists for this order
        if (order.payout_id) {
          results.push({
            orderId: order._id,
            status: "skipped_payout_exists",
            existingPayoutId: order.payout_id,
          });
          continue;
        }

        // 1. Complaint Check (Double Check)
        const activeComplaint = await db.collection("complaints").findOne({
          order_id: order._id,
          status: { $in: ["open", "in_progress", "investigating", "escalated"] },
        });

        if (activeComplaint) {
          results.push({ orderId: order._id, status: "skipped_complaint" });
          continue;
        }

        // 2. Get Provider Fund Account
        const provider = await db
          .collection("providers")
          .findOne({ _id: order.provider_id });
        if (!provider || !provider.razorpay_fund_account_id) {
          logger.warn("CRON", `Provider ${order.provider_id} has no fund account`, {
            orderId: order._id,
          });
          results.push({
            orderId: order._id,
            status: "skipped_no_fund_account",
          });
          continue;
        }

        // 3. CRITICAL: Release Escrow FIRST (before initiating payout)
        // This ensures we don't initiate payout if escrow release fails
        const released = await releaseEscrowPayment(order._id);
        if (!released) {
          // Escrow release failed (likely due to complaint or already released)
          results.push({ orderId: order._id, status: "escrow_release_failed" });
          continue;
        }

        // 4. Calculate Payout Amount
        // Use stored amount if available, otherwise fallback to calculation (ItemTotal * 0.95 + DeliveryCharge)
        const payoutAmount =
          order.provider_payout_amount ||
          order.total_price * 0.95 + (order.delivery_charge || 0);
        const amountInPaise = Math.round(payoutAmount * 100);

        // 5. Trigger Razorpay Payout (only after escrow is released)
        // IDEMPOTENCY: Razorpay uses reference_id to prevent duplicate payouts
        // We use the Fund Account ID linked to the Bank Account
        const payout = await createRazorpayPayout({
          account_number: env.RAZORPAYX_ACCOUNT_NUMBER,
          fund_account_id: provider.razorpay_fund_account_id,
          amount: amountInPaise,
          currency: "INR",
          mode: "NEFT", // Safe default
          purpose: "payout",
          narration: `Payout for Order ${order._id}`,
          reference_id: order._id.toString(), // For idempotency tracking - Razorpay will reject duplicates
        });

        // 6. Update DB with payout details (atomic - only if payout_id doesn't exist)
        // IDEMPOTENCY: Only update if payout_id is not already set (prevents overwriting existing payouts)
        const updateResult = await db.collection("orders").updateOne(
          { 
            _id: order._id,
            payout_id: { $exists: false }, // Only update if payout_id doesn't exist (idempotent)
          },
          {
            $set: {
              payout_status: "processing", // Razorpay payouts are async, so "processing" is accurate
              payout_id: payout.id,
              payout_initiated_at: new Date(),
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
          status: "payout_success",
          payoutId: payout.id,
        });
      } catch (innerError: unknown) {
        const errorMessage =
          innerError instanceof Error ? innerError.message : "Unknown error";
        logger.error(
          "CRON",
          `Error processing payout for order ${order._id}`,
          innerError
        );
        results.push({
          orderId: order._id,
          status: "failed",
          error: errorMessage,
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
    logger.error("CRON", "Cron payout error", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
