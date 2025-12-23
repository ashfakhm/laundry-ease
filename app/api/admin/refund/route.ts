import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Role } from "@/types/enums";
import { refundRazorpayPayment } from "@/lib/razorpay";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.role !== Role.ADMIN) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { paymentId, bookingId, orderId, amount, reason } = await req.json();

        if (!paymentId) {
             return NextResponse.json({ message: "Payment ID required" }, { status: 400 });
        }

        const refund = await refundRazorpayPayment(paymentId, amount ? Number(amount) : undefined, { reason });

        // Update DB status
        const { db } = await getDb();
        
        if (bookingId) {
            await db.collection("bookings").updateOne(
                { _id: new ObjectId(bookingId) },
                { $set: { bookingFeeStatus: "refunded" } } // or partial
            );
        } else if (orderId) {
            await db.collection("orders").updateOne(
                 { _id: new ObjectId(orderId) },
                 { $set: { payment_status: "refunded" } }
            );
        }

        return NextResponse.json({ success: true, refund });

    } catch (error: any) {
        console.error("Refund error:", error);
         return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
