import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { createRazorpayOrder } from "@/lib/razorpay";
import { ObjectId } from "mongodb";
import { Order } from "@/types/orders";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        
        if (!id) {
            return NextResponse.json({ error: "Order ID required" }, { status: 400 });
        }

        const { db } = await getDb();
        const order = await db.collection<Order>("orders").findOne({ _id: new ObjectId(id) });

        if (!order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        if (order.payment_status !== "unpaid") {
            return NextResponse.json({ error: "Order is already paid or processing" }, { status: 400 });
        }

        // Amount in paise
        const amountInPaise = Math.round(order.total_price * 100);

        const razorpayOrder = await createRazorpayOrder(amountInPaise, order._id.toString());
        
        // Update order with razorpay order id
        await db.collection<Order>("orders").updateOne(
            { _id: new ObjectId(id) },
            { $set: { razorpay_order_id: razorpayOrder.id } }
        );

        return NextResponse.json({
            success: true,
            orderId: razorpayOrder.id,
            amount: amountInPaise,
            currency: razorpayOrder.currency,
            keyId: process.env.RAZORPAY_KEY_ID
        });

    } catch (error: any) {
        logger.error("ORDERS", "Error initiating order payment", error, { orderId: id });
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
