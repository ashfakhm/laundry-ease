import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { ObjectId } from "mongodb";
import { Booking } from "@/types/bookings";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  let bookingId: string | undefined;
  try {
    const body = await req.json();
    bookingId = body.bookingId;
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = body;

    if (
      !bookingId ||
      !razorpayOrderId ||
      !razorpayPaymentId ||
      !razorpaySignature
    ) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const isValid = verifyRazorpaySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400 }
      );
    }

    const { db } = await getDb();

    // Update booking status
    /*
     * CORE PRINCIPLE:
     * Admin receives money. Booking logic continues.
     * 5% commission is calculated later when payout happens.
     * Status -> requested (now visible to provider if filtered by paid status, though schema defaults to requested anyway,
     * but typically we might hide unpaid bookings or mark them pending.
     * The PRD says: "Bookings remain HIDDEN from provider until fee is paid"
     * So getting to 'requested' status effectively enables visibility if we assume creation time status was something else or we filter by fee status.
     * Actually PRD says: "Booking status: requested". "Fee status: pending".
     * Provider sees "requested" bookings WHERE "bookingFeeStatus" is "paid".
     */

    const updateRes = await db.collection<Booking>("bookings").updateOne(
      { _id: new ObjectId(bookingId) },
      {
        $set: {
          bookingFeeStatus: "paid",
          razorpay_payment_id: razorpayPaymentId,
          // Ensure status is requested (it should already be, but good to confirm)
          status: "requested",
        },
      }
    );

    if (updateRes.modifiedCount === 0) {
      return NextResponse.json(
        { error: "Booking update failed or already updated" },
        { status: 500 }
      ); // Or 400 if already paid
    }

    return NextResponse.json({ success: true, message: "Payment verified" });
  } catch (error: any) {
    logger.error("BOOKINGS", "Error verifying booking payment", error, {
      bookingId,
    });
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
