import { NextRequest } from "next/server";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { razorpay } from "@/lib/razorpay";
import { startCronRun, completeCronRun } from "@/lib/cron-tracking";
import { successResponse, errorResponse } from "@/lib/api/response";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { withTransaction } from "@/lib/db/transaction";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return errorResponse(
      new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
    );
  }

  const run = await startCronRun("reconciliation");

  try {
    const { db } = await getDb();
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Find orders locally marked as unpaid, created effectively between 1h and 24h ago
    // We skip very recent orders to avoid race conditions with normal webhooks
    const unpaidOrders = await db
      .collection("orders")
      .find({
        payment_status: "unpaid",
        createdAt: {
          $gte: twentyFourHoursAgo,
          $lt: oneHourAgo,
        },
        razorpay_order_id: { $exists: true, $ne: null },
      })
      .toArray();

    const results = {
      totalUnpaidChecked: unpaidOrders.length,
      correctedCount: 0,
      errors: 0,
      correctedIds: [] as string[],
      totalPayoutsChecked: 0,
      payoutsCorrected: 0,
      payoutsFailed: 0,
    };

    for (const order of unpaidOrders) {
      try {
        if (!order.razorpay_order_id) continue;

        // Fetch order details from Razorpay
        // We use the Razorpay Node SDK instance from lib/razorpay
        const rzpOrder = await razorpay.orders.fetch(order.razorpay_order_id);

        // Check if Razorpay says it's paid
        // Status can be 'paid' or 'attempted' (with payments)
        // Ideally 'paid' means fully paid.
        if (rzpOrder.status === "paid" && rzpOrder.amount_paid) {
          // Verify amount matches (to avoid partial payment edge cases logic for now)
          // Razorpay amount is in paise
          if (Number(rzpOrder.amount_paid) >= Number(rzpOrder.amount)) {
            // It is paid!
            // We need to fetch the successful payment ID to link it
            const rzpPayments = await razorpay.orders.fetchPayments(
              order.razorpay_order_id,
            );
            const successPayment = rzpPayments.items.find(
              (p: { status: string }) => p.status === "captured",
            );

            if (successPayment) {
              const paymentId = successPayment.id;

              await withTransaction(async (session) => {
                // 1. Update Order
                await db.collection("orders").updateOne(
                  { _id: order._id },
                  {
                    $set: {
                      payment_status: "paid",
                      razorpay_payment_id: paymentId,
                      updatedAt: new Date(),
                      reconciled_at: new Date(),
                      reconciliation_method: "cron",
                    },
                  },
                  { session },
                );

                // 2. Link payment to booking (do NOT mutate bookingFeeStatus
                //    here — booking fee is a separate domain from order payment)
                await db.collection("bookings").updateOne(
                  { razorpay_order_id: order.razorpay_order_id },
                  {
                    $set: {
                      razorpay_payment_id: paymentId,
                      updatedAt: new Date(),
                    },
                  },
                  { session },
                );
              });

              results.correctedCount++;
              results.correctedIds.push(order._id.toString());
              logger.info(
                "CRON_RECONCILIATION",
                `Auto-corrected order ${order._id}`,
                {
                  razorpayOrderId: order.razorpay_order_id,
                  paymentId,
                },
              );
            }
          }
        }
      } catch (err) {
        logger.error(
          "CRON_RECONCILIATION",
          `Error processing order ${order._id}`,
          err,
        );
        results.errors++;
      }
    }

    // --- PHASE 2: ORPHANED PAYOUT RECONCILIATION ---
    const strandedPayoutOrders = await db
      .collection("orders")
      .find({
        payout_status: "processing",
        payout_id: { $exists: true, $ne: null },
        updatedAt: { $lt: oneHourAgo }, // Payout processing for > 1 hour
      })
      .toArray();

    results.totalPayoutsChecked = strandedPayoutOrders.length;

    for (const order of strandedPayoutOrders) {
      if (!order.payout_id) continue;

      try {
        // @ts-expect-error - Razorpay Node SDK lacks full Typescript support for RazorpayX Payouts
        const rzpPayout = await razorpay.payouts.fetch(order.payout_id);

        if (rzpPayout.status === "processed") {
          await db.collection("orders").updateOne(
            { _id: order._id },
            {
              $set: {
                payout_status: "paid",
                updatedAt: new Date(),
                reconciled_at: new Date(),
                reconciliation_method: "cron",
              },
            },
          );
          results.payoutsCorrected++;
        } else if (
          rzpPayout.status === "failed" ||
          rzpPayout.status === "rejected" ||
          rzpPayout.status === "reversed"
        ) {
          // Payout failed on gateway legitimately, need to rollback ledger
          await withTransaction(async (session) => {
            // 1. Mark order payout as failed
            await db.collection("orders").updateOne(
              { _id: order._id },
              {
                $set: {
                  payout_status: "failed",
                  payout_failure_reason: `Reconciled: ${rzpPayout.status}`,
                  payout_failure_at: new Date(),
                  updatedAt: new Date(),
                },
              },
              { session },
            );

            // 2. Re-credit the provider balance
            if (order.provider_payout_amount) {
              await db.collection("users").updateOne(
                { _id: order.provider_id },
                {
                  $inc: { wallet_balance: order.provider_payout_amount },
                  $set: { updated_at: new Date() },
                },
                { session },
              );
            }
          });
          results.payoutsFailed++;
        }
      } catch (err) {
        logger.error(
          "CRON_RECONCILIATION",
          `Error reconciling stranded payout for order ${order._id}`,
          err,
        );
        results.errors++;
      }
    }

    await completeCronRun(run.insertedId, "success", results);
    return successResponse(results);
  } catch (error) {
    await completeCronRun(run.insertedId, "error", undefined, error);
    logger.error("CRON", "Reconciliation job failed", error);
    return errorResponse(error);
  }
}
