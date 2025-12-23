import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { Order } from "@/types/orders";
import { Complaint } from "@/types/complaints";
import { refundRazorpayPayment, createRazorpayPayout } from "@/lib/razorpay";
import { ObjectId } from "mongodb";
import { Provider } from "@/lib/db";

// POST /api/admin/complaints/[id]/resolve
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { resolution, refundAmount } = await req.json(); // resolution: 'refund_full', 'refund_partial', 'release_payout', 'no_action'

        if (!id || !resolution) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const { db } = await getDb();
        const complaint = await db.collection<Complaint>("complaints").findOne({ _id: new ObjectId(id) });

        if (!complaint) {
            return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
        }

        const order = await db.collection<Order>("orders").findOne({ _id: new ObjectId(complaint.order_id) });

        if (!order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        if (order.payment_status === "released" || order.payment_status === "refunded") {
             return NextResponse.json({ error: "Order already processed" }, { status: 400 });
        }

        let actionResult = "";

        if (resolution === 'refund_full') {
            if (!order.razorpay_payment_id) throw new Error("No payment ID on order");
            
            await refundRazorpayPayment(order.razorpay_payment_id);
            
            await db.collection<Order>("orders").updateOne(
                { _id: order._id },
                { $set: { payment_status: "refunded" } }
            );
            actionResult = "Full refund issued";

        } else if (resolution === 'refund_partial') {
            if (!refundAmount) throw new Error("Refund amount required for partial refund");
            if (!order.razorpay_payment_id) throw new Error("No payment ID on order");

            // Refund specific amount
            await refundRazorpayPayment(order.razorpay_payment_id, refundAmount * 100); // Amount in paise
            
            // For partial refunds, we usually assume the rest goes to provider or stays with platform. 
            // In this simplistic model, if we refund partial, do we release the rest?
            // Let's assume 'refund_partial' implies ONLY the refund happens now, and maybe payout happens later 
            // OR we split it now. 
            // For MVP simplicity: Partial Refund -> Remainder is payout.
            
            const remainingAmount = order.total_price - refundAmount;
            if (remainingAmount > 0) {
                 // Trigger Payout Logic for remainder (minus commission on remainder? or commission on original? 
                 // Usually commission is on successful transaction volume. Let's take 5% of remainder.)
                 
                 const provider = await db.collection<Provider>("providers").findOne({ _id: order.provider_id });
                 if (provider && provider.razorpay_fund_account_id) {
                     const commission = Math.round(remainingAmount * 0.05 * 100) / 100;
                     const payoutAmount = remainingAmount - commission;
                     
                     await createRazorpayPayout({
                        account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER || "7878780080316316",
                        fund_account_id: provider.razorpay_fund_account_id,
                        amount: Math.round(payoutAmount * 100),
                        currency: "INR",
                        mode: "IMPS",
                        purpose: "payout",
                        narration: `Partial Setl Order #${order._id}`
                     });
                 }
            }

            await db.collection<Order>("orders").updateOne(
                { _id: order._id },
                { $set: { payment_status: "released" } } // Marked as released/settled
            );
            actionResult = `Partial refund of ${refundAmount} issued`;

        } else if (resolution === 'release_payout' || resolution === 'reject_complaint') {
             // Treat as normal release
             const provider = await db.collection<Provider>("providers").findOne({ _id: order.provider_id });
             if (!provider || !provider.razorpay_fund_account_id) throw new Error("Provider has no fund account");

             const commission = Math.round(order.total_price * 0.05 * 100) / 100;
             const payoutAmount = order.total_price - commission;

             await createRazorpayPayout({
                account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER || "7878780080316316",
                fund_account_id: provider.razorpay_fund_account_id,
                amount: Math.round(payoutAmount * 100),
                currency: "INR",
                mode: "IMPS",
                purpose: "payout",
                narration: `Payout Order #${order._id}`
             });

             await db.collection<Order>("orders").updateOne(
                { _id: order._id },
                { $set: { payment_status: "released" } }
            );
            actionResult = "Complaint rejected, payout released";
        }

        // Close Complaint
        await db.collection<Complaint>("complaints").updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: "resolved", resolution_note: `Admin Action: ${resolution}. Result: ${actionResult}`, resolvedAt: new Date() } }
       );

       return NextResponse.json({ success: true, message: actionResult });

    } catch (error: any) {
        console.error("Admin Resolution Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
