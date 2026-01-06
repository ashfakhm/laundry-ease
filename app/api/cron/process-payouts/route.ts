import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { createRazorpayPayout } from "@/lib/razorpay";
import { Order } from "@/types/orders";
import { Provider } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    // Authorization check - CRITICAL for production security
    const authHeader = req.headers.get("authorization");
    if (!process.env.CRON_SECRET) {
      logger.error(
        "CRON",
        "CRON_SECRET not configured - cron endpoint disabled"
      );
      return NextResponse.json(
        { error: "Cron endpoint not configured" },
        { status: 503 }
      );
    }

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
        // Initiate Payout
        const payout = await createRazorpayPayout({
          account_number:
            process.env.RAZORPAYX_ACCOUNT_NUMBER || "7878780080316316", // Specific account if multiple, or from env
          fund_account_id: provider.razorpay_fund_account_id,
          amount: payoutAmountPaise,
          currency: "INR",
          mode: "IMPS", // or NEFT/UPI
          purpose: "payout",
          narration: `Payout for Order #${order._id.toString().slice(-6)}`,
          reference_id: order._id.toString(),
        });

        // Update Order
        await db.collection<Order>("orders").updateOne(
          { _id: order._id },
          {
            $set: {
              payment_status: "released",
              payout_status: "processing", // Razorpay Payouts are async, 'processing' is safe. Hook handles 'processed'.
              payout_id: payout.id,
              platform_commission: commission,
              provider_payout_amount: payoutAmount,
            },
          }
        );

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
