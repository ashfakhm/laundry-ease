import { getDb } from "@/lib/mongodb";
import { PopulatedBooking } from "@/types/bookings";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ObjectId } from "mongodb";

export async function getProviderBookings(): Promise<{
  success: boolean;
  data?: PopulatedBooking[];
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id && !session?.user?.email) {
      return { success: false, error: "Unauthorized" };
    }

    const { db } = await getDb();

    // Get provider by email
    const provider = await db
      .collection("providers")
      .findOne({ email: session.user.email });

    if (!provider) {
      return { success: false, error: "Provider not found" };
    }

    // Fetch all bookings for this provider where fee is paid
    // Providers only see bookings after seeker has paid the booking fee
    const bookings = await db
      .collection("bookings")
      .find({
        provider_id: provider._id,
        bookingFeeStatus: { $in: ["paid", "applied"] },
      })
      .sort({ createdAt: -1 })
      .toArray();

    // Fetch seeker details for each booking
    // Note: In a larger scale, we would use $lookup aggregation, but manual population is fine for now
    const populatedBookings: PopulatedBooking[] = await Promise.all(
      bookings.map(async (booking) => {
        const seeker = await db.collection("seekers").findOne(
          { _id: new ObjectId(booking.seeker_id) },
          {
            projection: {
              _id: 1,
              name: 1,
              email: 1,
              phone: 1,
              address: 1,
              image: 1,
            },
          },
        );

        return {
          ...booking,
          _id: booking._id.toString(),
          seeker_id: booking.seeker_id.toString(), // Removed in type but kept for safety/reference if needed, though Omit should hide it.
          // Actually Omit<Booking, "seeker_id"> removes it from the type, so we shouldn't rely on it being there in the return type.
          // But spreading `...booking` keeps it at runtime.
          provider_id: booking.provider_id.toString(),
          createdAt: booking.createdAt.toISOString(), // Serialize dates for Server Components
          order_id: booking.order_id ? booking.order_id.toString() : undefined,
          deadline: booking.deadline
            ? new Date(booking.deadline).toISOString()
            : undefined,
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
            _id: seeker?._id.toString() || "unknown",
            name: seeker?.name || "Unknown Seeker",
            email: seeker?.email || "No email",
            phone: seeker?.phone || "No phone",
            address: seeker?.address,
            image: seeker?.image,
          },
        } as unknown as PopulatedBooking;
      }),
    );

    return { success: true, data: populatedBookings };
  } catch (error) {
    console.error("Error fetching provider bookings:", error);
    return { success: false, error: "Failed to fetch bookings" };
  }
}

import { PopulatedSeekerBooking } from "@/types/bookings";

export async function getSeekerBookings(): Promise<{
  success: boolean;
  data?: PopulatedSeekerBooking[];
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return { success: false, error: "Unauthorized" };
    }

    const { db } = await getDb();

    // Get seeker by stable identity.
    // Email can change; session.user.id is stable and should be used for lookups.
    const seeker = await db.collection("seekers").findOne({
      $or: [
        { _id: new ObjectId(String(session.user.id)) },
        { email: session.user.email },
      ],
    });

    if (!seeker) {
      return { success: false, error: "Seeker not found" };
    }

    // Fetch all bookings for this seeker (exclude cancelled/rejected)
    const bookings = await db
      .collection("bookings")
      .find({
        seeker_id: seeker._id,
        status: { $nin: ["cancelled", "rejected"] },
      })
      .sort({ createdAt: -1 })
      .toArray();

    // Fetch provider details for each booking
    const populatedBookings: PopulatedSeekerBooking[] = await Promise.all(
      bookings.map(async (booking) => {
        const provider = await db.collection("providers").findOne(
          { _id: new ObjectId(booking.provider_id) },
          {
            projection: {
              _id: 1,
              name: 1,
              businessName: 1,
              email: 1,
              phone: 1,
              address: 1,
              profilePicture: 1,
              bannerImage: 1,
            },
          },
        );

        return {
          ...booking,
          _id: booking._id.toString(),
          seeker_id: booking.seeker_id.toString(),
          provider_id: booking.provider_id.toString(), // Kept mostly for ref, omitted in type wrapper if strict
          createdAt: booking.createdAt.toISOString(),
          order_id: booking.order_id ? booking.order_id.toString() : undefined,
          deadline: booking.deadline
            ? new Date(booking.deadline).toISOString()
            : undefined,
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
            _id: provider?._id.toString() || "unknown",
            name: provider?.name || "Unknown Provider",
            email: provider?.email || "No email",
            phone: provider?.phone || "No phone",
            address: provider?.address || "",
            businessName: provider?.businessName,
            profilePicture: provider?.profilePicture,
            bannerImage: provider?.bannerImage,
          },
        } as unknown as PopulatedSeekerBooking;
      }),
    );

    return { success: true, data: populatedBookings };
  } catch (error) {
    console.error("Error fetching seeker bookings:", error);
    return { success: false, error: "Failed to fetch bookings" };
  }
}
