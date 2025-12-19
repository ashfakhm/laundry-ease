import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/**
 * GET /api/bookings/provider
 * Fetch all bookings for the logged-in provider
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();

    // Get provider by email
    const provider = await db
      .collection("providers")
      .findOne({ email: session.user.email });

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    // Fetch all bookings for this provider
    const bookings = await db
      .collection("bookings")
      .find({ provider_id: provider._id })
      .sort({ createdAt: -1 })
      .toArray();

    // Fetch seeker details for each booking
    const enrichedBookings = await Promise.all(
      bookings.map(async (booking) => {
        const seeker = await db
          .collection("seekers")
          .findOne(
            { _id: new ObjectId(booking.seeker_id) },
            { projection: { passwordHash: 0 } }
          );

        return {
          ...booking,
          seeker: seeker || null,
        };
      })
    );

    return NextResponse.json(enrichedBookings, { status: 200 });
  } catch (error) {
    console.error("Error fetching provider bookings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
