import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { ObjectId } from "mongodb";
import { Booking } from "@/types/bookings";
import { logger } from "@/lib/logger";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Role } from "@/types/enums";

export async function POST(req: NextRequest) {
  let bookingId: string | undefined;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== Role.SEEKER) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    let bookingObjectId: ObjectId;
    try {
      bookingObjectId = new ObjectId(bookingId);
    } catch {
      return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 });
    }
    const booking = await db.collection<Booking>("bookings").findOne({
      _id: bookingObjectId,
      seeker_id: new ObjectId(session.user.id),
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (!booking.razorpay_order_id || booking.razorpay_order_id !== razorpayOrderId) {
      return NextResponse.json(
        { error: "Razorpay order mismatch" },
        { status: 400 }
      );
    }

    if (booking.bookingFeeStatus === "paid" && booking.razorpay_payment_id === razorpayPaymentId) {
      return NextResponse.json({ success: true, message: "Payment verified" });
    }

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
      { _id: bookingObjectId, bookingFeeStatus: { $ne: "paid" } },
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
        { status: 409 }
      ); // Or 400 if already paid
    }

    return NextResponse.json({ success: true, message: "Payment verified" });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    logger.error("BOOKINGS", "Error verifying booking payment", error, {
      bookingId,
    });
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
