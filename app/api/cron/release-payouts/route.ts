import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { 
    getHeldOrdersPastEscrowDate, 
    releaseEscrowPayment 
} from "@/lib/db";
import { createRazorpayPayout } from "@/lib/razorpay";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic"; // Ensure not cached

export async function GET(req: Request) {
    // Optional: Verify Cron Secret if using Vercel Cron
    // const authHeader = req.headers.get("authorization");
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { ... }

    try {
        const orders = await getHeldOrdersPastEscrowDate();
        const results = [];

        const { db } = await getDb();

        for (const order of orders) {
            try {
                // 1. Complaint Check (Double Check)
                const activeComplaint = await db.collection("complaints").findOne({
                    order_id: order._id,
                    status: { $in: ["open", "in_progress"] }
                });

                if (activeComplaint) {
                    results.push({ orderId: order._id, status: "skipped_complaint" });
                    continue;
                }

                // 2. Get Provider Fund Account
                const provider = await db.collection("providers").findOne({ _id: order.provider_id });
                if (!provider || !provider.razorpay_fund_account_id) {
                    // Log error, maybe notify admin?
                    results.push({ orderId: order._id, status: "skipped_no_fund_account" });
                    continue;
                }

                // 3. Payout Amount
                const payoutAmount = order.provider_payout_amount || (order.total_price * 0.95);
                const amountInPaise = Math.round(payoutAmount * 100);

                // 4. Trigger Razorpay Payout
                // We use the Fund Account ID linked to the Bank Account
                const payout = await createRazorpayPayout({
                    account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER!, 
                    fund_account_id: provider.razorpay_fund_account_id,
                    amount: amountInPaise,
                    currency: "INR",
                    mode: "NEFT", // Safe default
                    purpose: "payout",
                    narration: `Payout for Order ${order._id}`
                });

                // 5. Release Escrow & Update DB
                const released = await releaseEscrowPayment(order._id);
                if (released) {
                    await db.collection("orders").updateOne(
                        { _id: order._id },
                        { 
                            $set: { 
                                payout_status: "paid",
                                payout_id: payout.id
                            } 
                        }
                    );
                    results.push({ orderId: order._id, status: "payout_success", payoutId: payout.id });
                } else {
                    // Should not happen if complaint check passed, but handle it
                    results.push({ orderId: order._id, status: "release_db_failed" });
                }

            } catch (innerError: any) {
                console.error(`Error processing payout for order ${order._id}:`, innerError);
                results.push({ orderId: order._id, status: "failed", error: innerError.message });
            }
        }

        return NextResponse.json({ success: true, processed: results.length, results });

    } catch (error: any) {
        console.error("Cron payout error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
