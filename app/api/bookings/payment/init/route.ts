import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { createRazorpayOrder } from "@/lib/razorpay";
import { ObjectId } from "mongodb";
import { Booking } from "@/types/bookings";
import { logger } from "@/lib/logger";
import { bookingPaymentInitSchema } from "@/lib/api/schemas";
import { env } from "@/lib/env";
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
    const parsed = bookingPaymentInitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid booking ID",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    bookingId = parsed.data.bookingId;

    const { db } = await getDb();
    const booking = await db
      .collection<Booking>("bookings")
      .findOne({
        _id: new ObjectId(bookingId),
        seeker_id: new ObjectId(session.user.id),
      });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.bookingFeeStatus === "paid") {
      return NextResponse.json(
        { error: "Booking fee already paid" },
        { status: 400 }
      );
    }

    const fee = booking.bookingFee || 0; // Fallback to 0 if undefined, or handle as error
    if (fee <= 0) {
      return NextResponse.json(
        { error: "Invalid booking fee" },
        { status: 400 }
      );
    }

    const amountInPaise = Math.round(fee * 100);

    const razorpayOrder = await createRazorpayOrder(
      amountInPaise,
      booking._id.toString()
    );

    // Update booking with razorpay order id
    await db
      .collection<Booking>("bookings")
      .updateOne(
        { _id: new ObjectId(bookingId) },
        { $set: { razorpay_order_id: razorpayOrder.id } }
      );

    return NextResponse.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: amountInPaise,
      currency: razorpayOrder.currency,
      keyId: env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    logger.error("BOOKINGS", "Error initiating booking payment", error, {
      bookingId,
    });
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
