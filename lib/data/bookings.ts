import { getDb } from "@/lib/mongodb";
import { PopulatedBooking, PopulatedSeekerBooking } from "@/types/bookings";
import { ObjectId } from "mongodb";
import { requireProvider, requireSeeker } from "@/lib/api/auth";
import { logger } from "@/lib/logger";

/**
 * Safely convert a value to an ISO date string.
 * Returns undefined if the value is falsy or not a valid date.
 */
function toISOStringOrUndefined(
  value: Date | string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Serialise a pickupSlot sub-document so Date values become ISO strings.
 */
function serialisePickupSlot(
  slot: Record<string, unknown> | null | undefined,
): PopulatedBooking["pickupSlot"] {
  if (!slot) return undefined;
  return {
    ...(slot as NonNullable<PopulatedBooking["pickupSlot"]>),
    dateTime: toISOStringOrUndefined(slot.dateTime as Date | string) ?? "",
    confirmedAt: toISOStringOrUndefined(slot.confirmedAt as Date | string),
  };
}

/**
 * Serialise a reschedule sub-document.
 */
function serialiseReschedule(
  reschedule: Record<string, unknown> | null | undefined,
) {
  if (!reschedule) return undefined;
  return {
    ...reschedule,
    requestedAt: toISOStringOrUndefined(
      reschedule.requestedAt as Date | string,
    ),
    previousPickupSlot: reschedule.previousPickupSlot
      ? serialisePickupSlot(
          reschedule.previousPickupSlot as Record<string, unknown>,
        )
      : undefined,
  };
}

/**
 * Serialise an invoice sub-document.
 */
function serialiseInvoice(invoice: Record<string, unknown> | null | undefined) {
  if (!invoice) return undefined;
  return {
    ...invoice,
    createdAt: toISOStringOrUndefined(invoice.createdAt as Date | string),
  };
}

export async function getProviderBookings(): Promise<{
  success: boolean;
  data?: PopulatedBooking[];
  error?: string;
}> {
  try {
    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) {
      return { success: false, error: "Unauthorized" };
    }

    const { db } = await getDb();
    const providerId = new ObjectId(user.id);

    // Ensure provider exists for authenticated identity.
    const provider = await db
      .collection("providers")
      .findOne({ _id: providerId });

    if (!provider) {
      return { success: false, error: "Provider not found" };
    }

    // Fetch all bookings for this provider where fee is paid
    // Providers only see bookings after seeker has paid the booking fee
    const bookings = await db
      .collection("bookings")
      .aggregate([
        {
          $match: {
            provider_id: providerId,
            bookingFeeStatus: { $in: ["paid", "applied"] },
          },
        },
        { $sort: { createdAt: -1 } },
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
      ])
      .toArray();

    const populatedBookings: PopulatedBooking[] = bookings.map((booking) => {
      const seeker = booking.seekerDetails;

      // Destructure join artifact and raw ObjectId / Date fields; spread
      // everything else so no booking fields (invoice, updatedAt, …) are lost.
      const {
        seekerDetails: _seekerDetails,
        _id,
        provider_id: _pid,
        seeker_id: _sid,
        status,
        order_id,
        createdAt,
        updatedAt,
        deadline,
        pickupSlot,
        reschedule,
        invoice,
        arrivedAt,
        cancelledAt,
        refundProcessedAt,
        payout_lock_at,
        payout_failure_at,
        payout_initiated_at,
        payout_updated_at,
        booking_fee_released_at,
        booking_fee_applied_at,
        refund_in_progress_at,
        ...rest
      } = booking;

      return {
        ...rest,
        _id: _id.toString(),
        provider_id: _pid.toString(),
        seeker_id: _sid.toString(),
        status,
        createdAt:
          toISOStringOrUndefined(createdAt) ?? new Date().toISOString(),
        updatedAt: toISOStringOrUndefined(updatedAt),
        order_id: order_id ? order_id.toString() : undefined,
        deadline: toISOStringOrUndefined(deadline),
        pickupSlot: serialisePickupSlot(pickupSlot),
        reschedule: serialiseReschedule(reschedule),
        invoice: serialiseInvoice(invoice),
        arrivedAt: toISOStringOrUndefined(arrivedAt),
        cancelledAt: toISOStringOrUndefined(cancelledAt),
        refundProcessedAt: toISOStringOrUndefined(refundProcessedAt),
        payout_lock_at: toISOStringOrUndefined(payout_lock_at),
        payout_failure_at: toISOStringOrUndefined(payout_failure_at),
        payout_initiated_at: toISOStringOrUndefined(payout_initiated_at),
        payout_updated_at: toISOStringOrUndefined(payout_updated_at),
        booking_fee_released_at: toISOStringOrUndefined(
          booking_fee_released_at,
        ),
        booking_fee_applied_at: toISOStringOrUndefined(booking_fee_applied_at),
        refund_in_progress_at: toISOStringOrUndefined(refund_in_progress_at),
        seeker: {
          _id: seeker?._id?.toString() || "unknown",
          name: seeker?.name || "Unknown Seeker",
          email: seeker?.email || "No email",
          phone: seeker?.phone || "No phone",
          address: seeker?.address,
          image: seeker?.image,
        },
      } as PopulatedBooking;
    });

    return { success: true, data: populatedBookings };
  } catch (error) {
    logger.error("DATA", "Error fetching provider bookings:", error);
    return { success: false, error: "Failed to fetch bookings" };
  }
}

export async function getSeekerBookings(): Promise<{
  success: boolean;
  data?: PopulatedSeekerBooking[];
  error?: string;
}> {
  try {
    const { user } = await requireSeeker();
    if (!ObjectId.isValid(user.id)) {
      return { success: false, error: "Unauthorized" };
    }

    const { db } = await getDb();
    const seekerId = new ObjectId(user.id);

    const seeker = await db.collection("seekers").findOne({ _id: seekerId });

    if (!seeker) {
      return { success: false, error: "Seeker not found" };
    }

    // Fetch all bookings for this seeker (exclude cancelled/rejected)
    const bookings = await db
      .collection("bookings")
      .aggregate([
        {
          $match: {
            seeker_id: seekerId,
            status: { $nin: ["cancelled", "rejected"] },
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: "providers",
            localField: "provider_id",
            foreignField: "_id",
            as: "providerDetails",
          },
        },
        {
          $unwind: {
            path: "$providerDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
      ])
      .toArray();

    const populatedBookings: PopulatedSeekerBooking[] = bookings.map(
      (booking) => {
        const provider = booking.providerDetails;

        // Destructure join artifact and raw ObjectId / Date fields; spread
        // everything else so no booking fields are silently dropped.
        const {
          providerDetails: _providerDetails,
          _id,
          provider_id: _pid,
          seeker_id: _sid,
          status,
          order_id,
          createdAt,
          updatedAt,
          deadline,
          pickupSlot,
          reschedule,
          invoice,
          arrivedAt,
          cancelledAt,
          refundProcessedAt,
          payout_lock_at,
          payout_failure_at,
          payout_initiated_at,
          payout_updated_at,
          booking_fee_released_at,
          booking_fee_applied_at,
          refund_in_progress_at,
          ...rest
        } = booking;

        return {
          ...rest,
          _id: _id.toString(),
          provider_id: _pid.toString(),
          seeker_id: _sid.toString(),
          status,
          createdAt:
            toISOStringOrUndefined(createdAt) ?? new Date().toISOString(),
          updatedAt: toISOStringOrUndefined(updatedAt),
          order_id: order_id ? order_id.toString() : undefined,
          deadline: toISOStringOrUndefined(deadline),
          pickupSlot: serialisePickupSlot(pickupSlot),
          reschedule: serialiseReschedule(reschedule),
          invoice: serialiseInvoice(invoice),
          arrivedAt: toISOStringOrUndefined(arrivedAt),
          cancelledAt: toISOStringOrUndefined(cancelledAt),
          refundProcessedAt: toISOStringOrUndefined(refundProcessedAt),
          payout_lock_at: toISOStringOrUndefined(payout_lock_at),
          payout_failure_at: toISOStringOrUndefined(payout_failure_at),
          payout_initiated_at: toISOStringOrUndefined(payout_initiated_at),
          payout_updated_at: toISOStringOrUndefined(payout_updated_at),
          booking_fee_released_at: toISOStringOrUndefined(
            booking_fee_released_at,
          ),
          booking_fee_applied_at: toISOStringOrUndefined(
            booking_fee_applied_at,
          ),
          refund_in_progress_at: toISOStringOrUndefined(refund_in_progress_at),
          provider: {
            _id: provider?._id?.toString() || "unknown",
            name: provider?.name || "Unknown Provider",
            email: provider?.email || "No email",
            phone: provider?.phone || "No phone",
            address: provider?.address || "",
            businessName: provider?.businessName,
            profilePicture: provider?.profilePicture,
            bannerImage: provider?.bannerImage,
          },
        } as PopulatedSeekerBooking;
      },
    );

    return { success: true, data: populatedBookings };
  } catch (error) {
    logger.error("DATA", "Error fetching seeker bookings:", error);
    return { success: false, error: "Failed to fetch bookings" };
  }
}
