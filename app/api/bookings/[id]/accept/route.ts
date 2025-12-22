import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getBookingById, updateBookingStatus } from "@/lib/db";
import { Role } from "@/types/enums";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || session.user.role !== Role.PROVIDER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();

    // Get provider by email
    const provider = await db
      .collection("providers")
      .findOne({ email: session.user.email });

    if (!provider) {
      return NextResponse.json(
        { message: "Provider not found" },
        { status: 404 }
      );
    }

    // Enforce provider capacity
    const activeBookingsCount = await db.collection("bookings").countDocuments({
      provider_id: provider._id,
      status: { $in: ["accepted", "pickup_proposed", "confirmed"] },
    });
    const maxCapacity = provider.capacity ?? 5;
    if (activeBookingsCount >= maxCapacity) {
      return NextResponse.json(
        {
          message: `You are at your maximum capacity of ${maxCapacity} active bookings.`,
        },
        { status: 400 }
      );
    }

    const booking_id = new ObjectId(id);
    const booking = await getBookingById(booking_id);

    if (!booking) {
      return NextResponse.json(
        { message: "Booking not found" },
        { status: 404 }
      );
    }

    if (booking.provider_id.toString() !== provider._id.toString()) {
      return NextResponse.json(
        { message: "You are not authorized to accept this booking" },
        { status: 403 }
      );
    }

    if (booking.status !== "requested") {
      return NextResponse.json(
        { message: "Booking has already been acted upon" },
        { status: 400 }
      );
    }

    const success = await updateBookingStatus(booking_id, "accepted");

    if (success) {
      return NextResponse.json({ message: "Booking accepted" });
    } else {
      return NextResponse.json(
        { message: "Failed to accept booking" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error accepting booking:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
