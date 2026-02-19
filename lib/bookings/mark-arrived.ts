import { ObjectId } from "mongodb";
import { calculateDistance } from "@/lib/distance";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { createRazorpayPayout } from "@/lib/razorpay";
import { env } from "@/lib/env";
import type { Booking } from "@/types/bookings";

const MAX_ARRIVAL_DISTANCE_METERS = 200;
const PAYOUT_LOCK_TTL_MS = 5 * 60 * 1000;

type Coordinates = { lat: number; lng: number };

type MarkArrivalInput = {
  bookingId: ObjectId;
  providerId: ObjectId;
  coordinates?: Coordinates | null;
};

type MarkArrivalResult = {
  status: number;
  body: Record<string, unknown>;
};

type PayoutResult = {
  initiated: boolean;
  payoutId: string | null;
  payoutStatus: "not_required" | "processing" | "failed" | "in_progress";
  payoutError?: string;
};

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  return "Unknown payout error";
}

async function setBookingPayoutFailure(
  bookingId: ObjectId,
  reason: string,
): Promise<void> {
  const { db } = await getDb();
  await db.collection("bookings").updateOne(
    { _id: bookingId, payout_id: { $exists: false } },
    {
      $set: {
        payout_status: "failed",
        payout_failure_reason: reason,
        payout_failure_at: new Date(),
        updatedAt: new Date(),
      },
      $unset: { payout_lock_at: "" },
    },
  );
}

async function tryInitiateBookingPayout(
  booking: Booking,
  provider: Record<string, unknown>,
): Promise<PayoutResult> {
  if (booking.bookingFeeStatus !== "paid") {
    return {
      initiated: false,
      payoutId: null,
      payoutStatus: "not_required",
    };
  }

  const bookingId =
    booking._id instanceof ObjectId
      ? booking._id
      : new ObjectId(String(booking._id));

  if (booking.payout_id && booking.payout_id.trim().length > 0) {
    return {
      initiated: true,
      payoutId: booking.payout_id,
      payoutStatus: "processing",
    };
  }

  const fundAccountId = String(provider.razorpay_fund_account_id || "").trim();
  if (!fundAccountId) {
    const reason =
      "Provider payout account is not configured. Update payment details first.";
    await setBookingPayoutFailure(bookingId, reason);
    return {
      initiated: false,
      payoutId: null,
      payoutStatus: "failed",
      payoutError: reason,
    };
  }

  if (!env.RAZORPAYX_ACCOUNT_NUMBER) {
    const reason = "Platform payout account is not configured.";
    await setBookingPayoutFailure(bookingId, reason);
    return {
      initiated: false,
      payoutId: null,
      payoutStatus: "failed",
      payoutError: reason,
    };
  }

  const bookingFee = Number(booking.bookingFee || 0);
  const providerAmount = Number(booking.provider_payout_amount ?? bookingFee * 0.95);
  const payoutAmountPaise = Math.round(providerAmount * 100);

  if (!Number.isFinite(payoutAmountPaise) || payoutAmountPaise <= 0) {
    const reason = "Invalid payout amount for booking fee release";
    await setBookingPayoutFailure(bookingId, reason);
    return {
      initiated: false,
      payoutId: null,
      payoutStatus: "failed",
      payoutError: reason,
    };
  }

  const { db } = await getDb();
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - PAYOUT_LOCK_TTL_MS);

  const lockResult = await db.collection("bookings").updateOne(
    {
      _id: bookingId,
      bookingFeeStatus: "paid",
      payout_id: { $exists: false },
      $or: [
        { payout_lock_at: { $exists: false } },
        { payout_lock_at: null },
        { payout_lock_at: { $lte: staleCutoff } },
      ],
    },
    {
      $set: {
        payout_status: "processing",
        payout_lock_at: now,
        updatedAt: now,
      },
      $unset: {
        payout_failure_reason: "",
        payout_failure_at: "",
      },
    },
  );

  if (lockResult.modifiedCount === 0) {
    const latest = await db
      .collection<Booking>("bookings")
      .findOne({ _id: bookingId });
    if (latest?.payout_id) {
      return {
        initiated: true,
        payoutId: latest.payout_id,
        payoutStatus: "processing",
      };
    }
    return {
      initiated: false,
      payoutId: null,
      payoutStatus: "in_progress",
      payoutError: "Payout is already being processed.",
    };
  }

  try {
    const payout = await createRazorpayPayout({
      account_number: env.RAZORPAYX_ACCOUNT_NUMBER,
      fund_account_id: fundAccountId,
      amount: payoutAmountPaise,
      currency: "INR",
      mode: "NEFT",
      purpose: "payout",
      narration: `Booking fee payout ${bookingId.toString().slice(-6)}`,
      reference_id: `booking-fee-${bookingId.toString()}`,
    });

    const finalizedAt = new Date();
    const finalizeResult = await db.collection("bookings").updateOne(
      { _id: bookingId, payout_id: { $exists: false } },
      {
        $set: {
          payout_status: "processing",
          payout_id: payout.id,
          payout_initiated_at: finalizedAt,
          booking_fee_released_at: finalizedAt,
          updatedAt: finalizedAt,
        },
        $unset: {
          payout_lock_at: "",
          payout_failure_reason: "",
          payout_failure_at: "",
        },
      },
    );

    if (finalizeResult.modifiedCount === 0) {
      const latest = await db
        .collection<Booking>("bookings")
        .findOne({ _id: bookingId });
      if (latest?.payout_id) {
        return {
          initiated: true,
          payoutId: latest.payout_id,
          payoutStatus: "processing",
        };
      }
    }

    return {
      initiated: true,
      payoutId: payout.id,
      payoutStatus: "processing",
    };
  } catch (error) {
    const reason = normalizeErrorMessage(error);
    logger.error(
      "BOOKINGS",
      "Failed to initiate booking-fee payout after marking arrival",
      error,
      { bookingId: bookingId.toString() },
    );
    await setBookingPayoutFailure(bookingId, reason);
    return {
      initiated: false,
      payoutId: null,
      payoutStatus: "failed",
      payoutError: "Failed to release booking fee payout. Please retry.",
    };
  }
}

export async function markProviderArrival(
  input: MarkArrivalInput,
): Promise<MarkArrivalResult> {
  const { bookingId, providerId, coordinates } = input;
  const { db } = await getDb();

  const booking = await db.collection<Booking>("bookings").findOne({ _id: bookingId });
  if (!booking) {
    return { status: 404, body: { error: "Booking not found" } };
  }

  const provider = await db.collection("providers").findOne({ _id: providerId });
  if (!provider || booking.provider_id.toString() !== providerId.toString()) {
    return { status: 403, body: { error: "Unauthorized" } };
  }

  if (booking.status !== "confirmed") {
    return {
      status: 400,
      body: { error: "Can only mark arrived for confirmed bookings" },
    };
  }

  if (
    booking.bookingFeeStatus !== "paid" &&
    booking.bookingFeeStatus !== "applied"
  ) {
    return {
      status: 400,
      body: { error: "Booking fee must be paid before marking arrival" },
    };
  }

  if (booking.seeker_coordinates) {
    if (
      !coordinates ||
      !Number.isFinite(coordinates.lat) ||
      !Number.isFinite(coordinates.lng)
    ) {
      return {
        status: 400,
        body: { error: "Current location coordinates are required." },
      };
    }

    const distanceKm = calculateDistance(coordinates, booking.seeker_coordinates);
    const distanceMeters = distanceKm * 1000;
    if (distanceMeters > MAX_ARRIVAL_DISTANCE_METERS) {
      return {
        status: 400,
        body: {
          error: "Too far from location",
          distanceMeters: Math.round(distanceMeters),
          allowedMeters: MAX_ARRIVAL_DISTANCE_METERS,
        },
      };
    }
  }

  let alreadyArrived = Boolean(booking.arrivedAt);
  let arrivedAt =
    booking.arrivedAt instanceof Date
      ? booking.arrivedAt
      : booking.arrivedAt
        ? new Date(booking.arrivedAt)
        : null;

  if (!alreadyArrived) {
    const now = new Date();
    const arrivalResult = await db.collection("bookings").updateOne(
      { _id: bookingId, status: "confirmed", arrivedAt: { $exists: false } },
      {
        $set: {
          arrivedAt: now,
          updatedAt: now,
        },
      },
    );

    if (arrivalResult.modifiedCount === 0) {
      const latest = await db.collection<Booking>("bookings").findOne({ _id: bookingId });
      if (!latest) {
        return { status: 404, body: { error: "Booking not found" } };
      }
      if (!latest.arrivedAt) {
        return {
          status: 409,
          body: {
            error: "Booking state changed while marking arrival. Please refresh.",
          },
        };
      }
      alreadyArrived = true;
      arrivedAt =
        latest.arrivedAt instanceof Date
          ? latest.arrivedAt
          : new Date(latest.arrivedAt);
    } else {
      arrivedAt = now;
    }
  }

  const latestBooking =
    alreadyArrived && booking.arrivedAt
      ? booking
      : await db.collection<Booking>("bookings").findOne({ _id: bookingId });

  const payoutResult = latestBooking
    ? await tryInitiateBookingPayout(latestBooking, provider)
    : {
        initiated: false,
        payoutId: null,
        payoutStatus: "not_required" as const,
      };

  return {
    status: 200,
    body: {
      success: true,
      idempotent: alreadyArrived,
      arrivedAt: arrivedAt ?? new Date(),
      payoutInitiated: payoutResult.initiated,
      payoutId: payoutResult.payoutId,
      payoutStatus: payoutResult.payoutStatus,
      ...(payoutResult.payoutError
        ? { payoutError: payoutResult.payoutError }
        : {}),
      message: payoutResult.initiated
        ? "Marked arrived and booking-fee payout initiated"
        : alreadyArrived
          ? "Already marked as arrived"
          : "Marked arrived successfully",
    },
  };
}
