import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { dateTime } = await req.json();

    if (!dateTime) {
      return NextResponse.json(
        { error: "Date and time required" },
        { status: 400 }
      );
    }

    const { db } = await getDb();
    const bookingId = new ObjectId(params.id);

    // Verify booking belongs to this provider
    const provider = await db
      .collection("providers")
      .findOne({ email: session.user.email });

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const booking = await db.collection("bookings").findOne({ _id: bookingId });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.provider_id.toString() !== provider._id.toString()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update booking with proposed pickup time
    await db.collection("bookings").updateOne(
      { _id: bookingId },
      {
        $set: {
          status: "pickup_proposed",
          pickupSlot: {
            dateTime: new Date(dateTime),
            confirmed: false,
          },
        },
      }
    );

    // TODO: Send notification to seeker

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Schedule pickup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
