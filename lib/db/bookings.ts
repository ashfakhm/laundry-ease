import { Booking } from "@/types/bookings";
import { Seeker, Provider } from "@/types/users";
import { getDb } from "../mongodb";
import { ObjectId } from "mongodb";
import { auditBookingStateChange } from "../audit";
import { AppError } from "../api/errors";

/**
 * Create a booking with atomic capacity check using MongoDB transaction.
 * Prevents race conditions where multiple bookings could exceed provider capacity.
 *
 * @throws Error if provider capacity is exceeded
 */
export async function createBooking(data: {
  seeker_id: ObjectId;
  provider_id: ObjectId;
  deadline?: Date;
  bookingFee: number;
  seeker_coordinates?: { lat: number; lng: number };
  capacity: number; // Provider's max capacity - must be passed in
}) {
  const { db, client } = await getDb();
  const session = client.startSession();

  try {
    let insertedBooking: Booking | undefined;

    await session.withTransaction(async () => {
      const now = new Date();

      // Atomic capacity check within transaction
      const activeBookings = await db.collection("bookings").countDocuments(
        {
          provider_id: data.provider_id,
          status: {
            $in: ["requested", "accepted", "pickup_proposed", "confirmed"],
          },
        },
        { session },
      );

      const activeOrders = await db.collection("orders").countDocuments(
        {
          provider_id: data.provider_id,
          process_status: {
            $in: [
              "invoiced",
              "processing",
              "washing",
              "ironing",
              "ready",
              "out_for_delivery",
            ],
          },
        },
        { session },
      );

      const totalActive = activeBookings + activeOrders;
      if (totalActive >= data.capacity) {
        throw new Error(
          `CAPACITY_EXCEEDED:Provider is currently at full capacity (${totalActive}/${data.capacity}). Please try again later or choose another provider.`,
        );
      }

      // Insert booking within same transaction
      const booking: Omit<Booking, "_id"> = {
        seeker_id: data.seeker_id,
        provider_id: data.provider_id,
        status: "requested",
        bookingFee: data.bookingFee,
        bookingFeeStatus: "pending",
        deadline: data.deadline,
        seeker_coordinates: data.seeker_coordinates,
        createdAt: now,
      };

      const res = await db
        .collection<Omit<Booking, "_id">>("bookings")
        .insertOne(booking, { session });

      insertedBooking = { ...booking, _id: res.insertedId };
    });

    if (!insertedBooking) {
      throw new Error("Failed to create booking");
    }

    // Audit log - booking created (fire-and-forget, non-blocking)
    auditBookingStateChange({
      booking_id: insertedBooking._id as ObjectId,
      previous_state: null,
      next_state: "requested",
      action: "booking_created",
      actor_type: "seeker",
      actor_id: data.seeker_id,
      metadata: {
        provider_id: data.provider_id.toString(),
        booking_fee: data.bookingFee,
      },
    });

    return insertedBooking;
  } finally {
    await session.endSession();
  }
}

/**
 * Get a booking by its ID
 */
export async function getBookingById(
  booking_id: ObjectId | string,
): Promise<Booking | null> {
  const { db } = await getDb();
  const queryId =
    typeof booking_id === "string" ? new ObjectId(booking_id) : booking_id;
  const booking = await db
    .collection<Booking>("bookings")
    .findOne({ _id: queryId });
  return booking;
}

/**
 * Update a booking's status
 */
export async function updateBookingStatus(
  booking_id: ObjectId,
  status: "accepted" | "rejected",
) {
  const { db } = await getDb();
  const res = await db
    .collection<Booking>("bookings")
    .updateOne({ _id: booking_id }, { $set: { status } });
  return res.modifiedCount > 0;
}

/**
 * Accept a booking with atomic capacity check using MongoDB transaction.
 * Prevents race conditions where multiple accepts could exceed provider capacity.
 *
 * @returns The updated booking if successful, null if booking not found or not in 'requested' status
 * @throws Error if provider capacity is exceeded
 */
export async function acceptBookingWithCapacityCheck(data: {
  booking_id: ObjectId | string;
  provider_id: ObjectId;
  maxCapacity: number;
  platform_commission: number;
  provider_payout_amount: number;
}): Promise<Booking | null> {
  const { db, client } = await getDb();
  const session = client.startSession();

  try {
    let updatedBooking: Booking | null = null;

    await session.withTransaction(async () => {
      // Get booking first to verify it exists and is in correct state
      const booking = await db
        .collection<Booking>("bookings")
        .findOne({ _id: data.booking_id }, { session });

      if (!booking) {
        throw new AppError("BOOKING_NOT_FOUND", 404, "Booking not found");
      }

      if (booking.provider_id.toString() !== data.provider_id.toString()) {
        throw new AppError(
          "UNAUTHORIZED",
          403,
          "You are not authorized to accept this booking",
        );
      }

      if (booking.status !== "requested") {
        throw new AppError(
          "BOOKING_ALREADY_PROCESSED",
          409,
          "Booking has already been acted upon",
        );
      }

      if (booking.bookingFeeStatus !== "paid") {
        throw new AppError(
          "PAYMENT_NOT_SETTLED",
          422,
          "Booking fee must be paid before provider can accept",
        );
      }

      const refundLockRaw = booking.refund_in_progress_at;
      if (refundLockRaw) {
        const refundLockAt = new Date(refundLockRaw);
        const lockIsFresh =
          !Number.isNaN(refundLockAt.getTime()) &&
          Date.now() - refundLockAt.getTime() < 5 * 60 * 1000;

        if (lockIsFresh) {
          throw new AppError(
            "REFUND_IN_PROGRESS",
            422,
            "Booking refund is in progress; cannot accept now",
          );
        }

        await db.collection<Booking>("bookings").updateOne(
          {
            _id: data.booking_id,
            status: "requested",
            refund_in_progress_at: booking.refund_in_progress_at,
          },
          {
            $unset: { refund_in_progress_at: "" },
            $set: { updatedAt: new Date() },
          },
          { session },
        );
      }

      // Atomic capacity check within transaction
      const activeBookingsCount = await db
        .collection("bookings")
        .countDocuments(
          {
            provider_id: data.provider_id,
            status: { $in: ["accepted", "pickup_proposed", "confirmed"] },
          },
          { session },
        );

      if (activeBookingsCount >= data.maxCapacity) {
        throw new AppError(
          "CAPACITY_EXCEEDED",
          422,
          `You are at your maximum capacity of ${data.maxCapacity} active bookings.`,
        );
      }

      // Update booking within same transaction
      const updateResult = await db
        .collection<Booking>("bookings")
        .findOneAndUpdate(
          {
            _id: data.booking_id,
            status: "requested",
            bookingFeeStatus: "paid",
            refund_in_progress_at: { $exists: false },
          }, // Double-check status/payment/lock hasn't changed
          {
            $set: {
              status: "accepted",
              platform_commission: data.platform_commission,
              provider_payout_amount: data.provider_payout_amount,
              payout_status: "pending",
              updatedAt: new Date(),
            },
          },
          { returnDocument: "after", session },
        );

      if (!updateResult) {
        throw new AppError(
          "BOOKING_ALREADY_PROCESSED",
          409,
          "Booking has already been acted upon",
        );
      }

      updatedBooking = updateResult;
    });

    // Audit log - booking accepted (fire-and-forget, non-blocking)
    if (updatedBooking) {
      const bookingIdForAudit =
        data.booking_id instanceof ObjectId
          ? data.booking_id
          : ObjectId.isValid(String(data.booking_id))
            ? new ObjectId(String(data.booking_id))
            : null;

      if (bookingIdForAudit) {
        auditBookingStateChange({
          booking_id: bookingIdForAudit,
          previous_state: "requested",
          next_state: "accepted",
          action: "booking_accepted",
          actor_type: "provider",
          actor_id: data.provider_id,
          metadata: {
            platform_commission: data.platform_commission,
            provider_payout_amount: data.provider_payout_amount,
          },
        });
      }
    }

    return updatedBooking;
  } finally {
    await session.endSession();
  }
}

/**
 * Get all bookings for a provider (Server Component Helper)
 */
export async function getBookingsForProvider(email: string) {
  const { db } = await getDb();

  const provider = await db
    .collection<Provider>("providers")
    .findOne({ email });
  if (!provider) return [];

  const rawBookings = await db
    .collection("bookings")
    .aggregate([
      {
        $match: {
          provider_id: provider._id,
          bookingFeeStatus: { $in: ["paid", "applied"] },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $lookup: {
          from: "seekers",
          localField: "seeker_id",
          foreignField: "_id",
          as: "seekerDetails",
        },
      },
      {
        $unwind: {
          path: "$seekerDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          "seekerDetails.passwordHash": 0,
        },
      },
    ])
    .toArray();

  const enrichedBookings = rawBookings.map((b) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { seekerDetails, ...bookingRest } = b as Booking & {
      seekerDetails?: Seeker;
    };
    const booking = bookingRest as Booking;
    const seeker = b.seekerDetails as Seeker | undefined;

    // Serialize ObjectIds to strings for Client Components
    return {
      ...booking,
      _id: booking._id.toString(),
      seeker_id: booking.seeker_id.toString(),
      provider_id: booking.provider_id.toString(),
      createdAt: new Date(booking.createdAt).toISOString(),
      deadline: booking.deadline
        ? new Date(booking.deadline).toISOString()
        : undefined,
      pickupSlot: booking.pickupSlot
        ? {
            ...booking.pickupSlot,
            dateTime: new Date(booking.pickupSlot.dateTime).toISOString(), // Ensure ISO string
            confirmedAt: booking.pickupSlot.confirmedAt
              ? new Date(booking.pickupSlot.confirmedAt).toISOString()
              : undefined,
          }
        : undefined,
      seeker: seeker
        ? {
            ...seeker,
            _id: seeker._id?.toString() || "",
            createdAt: new Date(seeker.createdAt).toISOString(),
          }
        : undefined,
    };
  });

  return enrichedBookings;
}

/**
 * Lock a booking for refund processing to prevent race conditions.
 */
export async function lockBookingForRefund(
  booking_id: ObjectId | string,
  refundLockTimeoutMs: number,
) {
  const { db } = await getDb();
  const queryId =
    typeof booking_id === "string" ? new ObjectId(booking_id) : booking_id;
  const lockCutoff = new Date(Date.now() - refundLockTimeoutMs);

  const res = await db.collection<Booking>("bookings").updateOne(
    {
      _id: queryId,
      status: "requested",
      bookingFeeStatus: "paid",
      $or: [
        { refund_in_progress_at: { $exists: false } },
        { refund_in_progress_at: { $lt: lockCutoff } },
      ],
    },
    {
      $set: {
        refund_in_progress_at: new Date(),
        updatedAt: new Date(),
      },
    },
  );
  return res.modifiedCount > 0;
}

/**
 * Unlock a booking after a failed refund attempt.
 */
export async function unlockBookingRefund(booking_id: ObjectId | string) {
  const { db } = await getDb();
  const queryId =
    typeof booking_id === "string" ? new ObjectId(booking_id) : booking_id;
  const res = await db.collection<Booking>("bookings").updateOne(
    { _id: queryId },
    {
      $unset: { refund_in_progress_at: "" },
      $set: { updatedAt: new Date() },
    },
  );
  return res.modifiedCount > 0;
}

/**
 * Mark a booking as rejected and the booking fee as refunded.
 */
export async function markBookingAsRejectedAndRefunded(
  booking_id: ObjectId | string,
  refundId: string | null,
) {
  const { db } = await getDb();
  const queryId =
    typeof booking_id === "string" ? new ObjectId(booking_id) : booking_id;
  const res = await db.collection<Booking>("bookings").updateOne(
    {
      _id: queryId,
      status: "requested",
      bookingFeeStatus: "paid",
      refund_in_progress_at: { $exists: true },
    },
    {
      $set: {
        status: "rejected",
        bookingFeeStatus: "refunded",
        refundProcessedAt: new Date(),
        ...(refundId ? { booking_fee_refund_id: refundId } : {}),
        updatedAt: new Date(),
      },
      $unset: { refund_in_progress_at: "" },
    },
  );
  return res.modifiedCount > 0;
}

/**
 * Update only the refund status if the main status transition failed
 * due to a race, but the refund succeeded.
 */
export async function updateBookingToRefundedOnly(
  booking_id: ObjectId | string,
  refundId: string | null,
) {
  const { db } = await getDb();
  const queryId =
    typeof booking_id === "string" ? new ObjectId(booking_id) : booking_id;
  const res = await db.collection<Booking>("bookings").updateOne(
    { _id: queryId, bookingFeeStatus: "paid" },
    {
      $set: {
        bookingFeeStatus: "refunded",
        refundProcessedAt: new Date(),
        ...(refundId ? { booking_fee_refund_id: refundId } : {}),
        updatedAt: new Date(),
      },
      $unset: { refund_in_progress_at: "" },
    },
  );
  return res.modifiedCount > 0;
}

/**
 * Update the pickup slot for an accepted or rescheduled booking.
 */
export async function updateBookingPickupSlot(
  booking_id: ObjectId | string,
  slotTime: Date,
) {
  const { db } = await getDb();
  const queryId =
    typeof booking_id === "string" ? new ObjectId(booking_id) : booking_id;
  const res = await db.collection<Booking>("bookings").updateOne(
    { _id: queryId },
    {
      $set: {
        status: "pickup_proposed",
        pickupSlot: {
          proposedBy: "provider",
          dateTime: slotTime,
          confirmedAt: undefined,
        },
        updatedAt: new Date(),
      },
    },
  );
  return res.modifiedCount > 0;
}

/**
 * Mark provider arrival status and optional payout details.
 */
export async function markBookingProviderArrived(
  booking_id: ObjectId | string,
  now: Date,
  payoutId: string | null,
) {
  const { db } = await getDb();
  const queryId =
    typeof booking_id === "string" ? new ObjectId(booking_id) : booking_id;
  const res = await db.collection<Booking>("bookings").updateOne(
    {
      _id: queryId,
      status: "confirmed",
      arrivedAt: { $exists: false },
    },
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
  return res.modifiedCount > 0;
}
