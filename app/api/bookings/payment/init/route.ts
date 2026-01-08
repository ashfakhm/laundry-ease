import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { createRazorpayOrder } from "@/lib/razorpay";
import { ObjectId } from "mongodb";
import { Booking } from "@/types/bookings";
import { logger } from "@/lib/logger";
import { bookingPaymentInitSchema } from "@/lib/api/schemas";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = bookingPaymentInitSchema.safeParse(body);

        if (!parsed.success) {
          return NextResponse.json(
            { error: "Invalid booking ID", details: parsed.error.flatten().fieldErrors },
            { status: 400 }
          );
        }

        const { bookingId } = parsed.data;

        const { db } = await getDb();
        const booking = await db.collection<Booking>("bookings").findOne({ _id: new ObjectId(bookingId) });

        if (!booking) {
            return NextResponse.json({ error: "Booking not found" }, { status: 404 });
        }

        if (booking.bookingFeeStatus === "paid") {
            return NextResponse.json({ error: "Booking fee already paid" }, { status: 400 });
        }

        const fee = booking.bookingFee || 0; // Fallback to 0 if undefined, or handle as error
        if (fee <= 0) {
             return NextResponse.json({ error: "Invalid booking fee" }, { status: 400 });
        }

        const amountInPaise = Math.round(fee * 100);

        const razorpayOrder = await createRazorpayOrder(amountInPaise, booking._id.toString());
        
        // Update booking with razorpay order id
        await db.collection<Booking>("bookings").updateOne(
            { _id: new ObjectId(bookingId) },
            { $set: { razorpay_order_id: razorpayOrder.id } }
        );

        return NextResponse.json({
            success: true,
            orderId: razorpayOrder.id,
            amount: amountInPaise,
            currency: razorpayOrder.currency,
            keyId: env.NEXT_PUBLIC_RAZORPAY_KEY_ID
        });

    } catch (error: any) {
        logger.error("BOOKINGS", "Error initiating booking payment", error, { bookingId });
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
