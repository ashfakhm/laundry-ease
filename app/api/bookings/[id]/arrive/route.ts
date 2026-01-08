import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";

// POST: Provider marks themselves as arrived at pickup location
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();
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

    // Update booking with arrived status
    // Note: We are just adding a timestamp, not changing the main status yet
    await db.collection("bookings").updateOne(bookingQuery, {
      $set: {
        arrivedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, arrivedAt: new Date() });
  } catch (error) {
    logger.error("BOOKINGS", "Mark arrived error", error, { bookingId: id });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
