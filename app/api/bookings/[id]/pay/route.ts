import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getBookingById } from "@/lib/db";
import { Role } from "@/types/enums";
import { ObjectId } from "mongodb";
import { createRazorpayOrder, verifyRazorpaySignature } from "@/lib/razorpay";
import { getDb } from "@/lib/mongodb";
import { Booking } from "@/types/bookings";
import { logger } from "@/lib/logger";

// POST: Create Razorpay Order for Booking Fee
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || session.user.role !== Role.SEEKER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const booking_id = new ObjectId(id);
    const booking = await getBookingById(booking_id);

    if (!booking) {
      return NextResponse.json(
        { message: "Booking not found" },
        { status: 404 }
      );
    }

    if (booking.seeker_id.toString() !== session.user.id) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 403 }
      );
    }

    if (booking.bookingFeeStatus === "paid") {
      return NextResponse.json(
        { message: "Booking fee already paid" },
        { status: 400 }
      );
    }

    // Amount in paise. Fallback to 5000 (50 INR) if missing.
    const amount = booking.bookingFee ? Math.round(booking.bookingFee * 100) : 5000;

    const razorpayOrder = await createRazorpayOrder(amount, id);

    return NextResponse.json({
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    });
  } catch (error) {
    logger.error("BOOKINGS", "Error creating booking fee order", error, { bookingId: id });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT: Verify Payment and Update Booking Status
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || session.user.role !== Role.SEEKER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = body;

    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return NextResponse.json({ message: "Invalid signature" }, { status: 400 });
    }

    const { db } = await getDb();
    const res = await db.collection<Booking>("bookings").updateOne(
      { _id: new ObjectId(id) },
      { $set: { bookingFeeStatus: "paid" } }
    );

    if (res.modifiedCount > 0) {
      return NextResponse.json({ message: "Payment successful" });
    } else {
      return NextResponse.json(
        { message: "Failed to update booking status" },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error("BOOKINGS", "Error verifying booking fee", error, { bookingId: id });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
