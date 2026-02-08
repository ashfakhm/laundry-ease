import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { createRazorpayPayout } from "@/lib/razorpay";
import { env } from "@/lib/env";
import { Role } from "@/types/enums";
import { calculateDistance } from "@/lib/distance";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";

// POST: Provider marks themselves as arrived at pickup location
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "bookings:arrive",
      max: 30,
      windowMs: 5 * 60 * 1000,
    });

    const session = await getServerSession(authOptions);

    if (!session?.user?.email || session.user.role !== Role.PROVIDER) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();
    const body = await req.json().catch(() => null);
    const lat =
      typeof body?.lat === "number" ? body.lat : Number.NaN;
    const lng =
      typeof body?.lng === "number" ? body.lng : Number.NaN;
    const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);

    let bookingQuery: any;
    try {
      bookingQuery = { _id: new ObjectId(id) };
    } catch {
      bookingQuery = { _id: id };
    }

    const booking = await db.collection("bookings").findOne(bookingQuery);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Verify provider ownership
    const provider = await db
      .collection("providers")
      .findOne({ email: session.user.email });

    if (
      !provider ||
      booking.provider_id.toString() !== provider._id.toString()
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (booking.status !== "confirmed") {
      return NextResponse.json(
        { error: "Can only mark arrived for confirmed bookings" },
        { status: 400 }
      );
    }

    if (booking.arrivedAt) {
      return NextResponse.json(
        { error: "Already marked as arrived" },
        { status: 400 }
      );
    }

    if (
      booking.bookingFeeStatus !== "paid" &&
      booking.bookingFeeStatus !== "applied"
    ) {
      return NextResponse.json(
        { error: "Booking fee must be paid before marking arrival" },
        { status: 400 }
      );
    }

    if (booking.seeker_coordinates) {
      if (!hasCoordinates) {
        return NextResponse.json(
          { error: "Current location coordinates are required." },
          { status: 400 }
        );
      }

      const distanceKm = calculateDistance(
        { lat, lng },
        booking.seeker_coordinates
      );
      const distanceMeters = distanceKm * 1000;
      if (distanceMeters > 200) {
        return NextResponse.json(
          {
            error: "Too far from location",
            distanceMeters: Math.round(distanceMeters),
            allowedMeters: 200,
          },
          { status: 400 }
        );
      }
    }

    const now = new Date();
    let payoutId: string | null = null;

    if (!booking.payout_id && booking.bookingFeeStatus === "paid") {
      if (!provider.razorpay_fund_account_id) {
        return NextResponse.json(
          {
            error:
              "Provider payout account is not configured. Update payment details first.",
          },
          { status: 400 }
        );
      }

      if (!env.RAZORPAYX_ACCOUNT_NUMBER) {
        return NextResponse.json(
          { error: "Platform payout account is not configured." },
          { status: 503 }
        );
      }

      const bookingFee = Number(booking.bookingFee || 0);
      const providerAmount = Number(
        booking.provider_payout_amount ?? bookingFee * 0.95
      );
      const payoutAmountPaise = Math.round(providerAmount * 100);

      if (payoutAmountPaise <= 0) {
        return NextResponse.json(
          { error: "Invalid payout amount for booking fee release" },
          { status: 400 }
        );
      }

      try {
        const payout = await createRazorpayPayout({
          account_number: env.RAZORPAYX_ACCOUNT_NUMBER,
          fund_account_id: provider.razorpay_fund_account_id,
          amount: payoutAmountPaise,
          currency: "INR",
          mode: "NEFT",
          purpose: "payout",
          narration: `Booking fee payout ${booking._id.toString().slice(-6)}`,
          reference_id: `booking-fee-${booking._id.toString()}`,
        });
        payoutId = payout.id;
      } catch (error) {
        logger.error(
          "BOOKINGS",
          "Failed to initiate booking-fee payout on arrival",
          error,
          { bookingId: id }
        );
        return NextResponse.json(
          {
            error:
              "Failed to release booking fee payout. Arrival was not marked. Please retry.",
          },
          { status: 502 }
        );
      }
    }

    const updateResult = await db.collection("bookings").updateOne(
      { ...bookingQuery, status: "confirmed", arrivedAt: { $exists: false } },
      {
        $set: {
          arrivedAt: now,
          updatedAt: now,
          ...(payoutId
            ? {
                payout_status: "processing",
                payout_id: payoutId,
                payout_initiated_at: now,
                booking_fee_released_at: now,
              }
            : {}),
        },
      },
    );

    if (updateResult.modifiedCount === 0) {
      return NextResponse.json(
        { error: "Booking state changed while marking arrival. Please refresh." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      arrivedAt: now,
      payoutInitiated: Boolean(payoutId),
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.statusCode },
      );
    }

    logger.error("BOOKINGS", "Mark arrived error", error, { bookingId: id });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
