import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { ObjectId } from "mongodb";
import { Order } from "@/types/orders";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = await req.json();

        if (!id || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const isValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

        if (!isValid) {
            return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
        }

        const { db } = await getDb();
        
        // Update order payment status
        // Mark as 'paid'. Logic moves to 'held' when delivery is confirmed.
        const updateRes = await db.collection<Order>("orders").updateOne(
            { _id: new ObjectId(id) },
            { 
                $set: { 
                    payment_status: "paid",
                    razorpay_payment_id: razorpayPaymentId,
                    payment_made_at: new Date()
                } 
            }
        );

        if (updateRes.modifiedCount === 0) {
             return NextResponse.json({ error: "Order update failed" }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Payment verified" });

    } catch (error: any) {
        logger.error("ORDERS", "Error verifying order payment", error, { orderId: id });
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
