import { getDb } from "@/lib/mongodb";
import { PopulatedBooking, PopulatedSeekerBooking } from "@/types/bookings";
import { ObjectId } from "mongodb";
import { requireProvider, requireSeeker } from "@/lib/api/auth";
import { logger } from "@/lib/logger";

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
      return {
        _id: booking._id.toString(),
        provider_id: booking.provider_id.toString(),
        seeker_id: booking.seeker_id.toString(),
        status: booking.status,
        bookingFee: booking.bookingFee,
        bookingFeeStatus: booking.bookingFeeStatus,
        createdAt: new Date(booking.createdAt).toISOString(),
        order_id: booking.order_id ? booking.order_id.toString() : undefined,
        deadline: booking.deadline
          ? new Date(booking.deadline).toISOString()
          : undefined,
        seeker_coordinates: booking.seeker_coordinates,
        pickupSlot: booking.pickupSlot
          ? {
              ...booking.pickupSlot,
              dateTime: new Date(booking.pickupSlot.dateTime).toISOString(),
              confirmedAt: booking.pickupSlot.confirmedAt
                ? new Date(booking.pickupSlot.confirmedAt).toISOString()
                : undefined,
            }
          : undefined,
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
        return {
          _id: booking._id.toString(),
          provider_id: booking.provider_id.toString(),
          seeker_id: booking.seeker_id.toString(),
          status: booking.status,
          bookingFee: booking.bookingFee,
          bookingFeeStatus: booking.bookingFeeStatus,
          createdAt: new Date(booking.createdAt).toISOString(),
          order_id: booking.order_id ? booking.order_id.toString() : undefined,
          deadline: booking.deadline
            ? new Date(booking.deadline).toISOString()
            : undefined,
          seeker_coordinates: booking.seeker_coordinates,
          pickupSlot: booking.pickupSlot
            ? {
                ...booking.pickupSlot,
                dateTime: new Date(booking.pickupSlot.dateTime).toISOString(),
                confirmedAt: booking.pickupSlot.confirmedAt
                  ? new Date(booking.pickupSlot.confirmedAt).toISOString()
                  : undefined,
              }
            : undefined,
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
