import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getBookingById, updateBookingStatus } from "@/lib/db";
import { Role } from "@/types/enums";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
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
        { message: "You are not authorized to reject this booking" },
        { status: 403 }
      );
    }

    if (booking.status !== "requested") {
      return NextResponse.json(
        { message: "Booking has already been acted upon" },
        { status: 400 }
      );
    }

    const success = await updateBookingStatus(booking_id, "rejected");

    if (success) {
      return NextResponse.json({ message: "Booking rejected" });
    } else {
      return NextResponse.json(
        { message: "Failed to reject booking" },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error("BOOKINGS", "Error rejecting booking", error, {
      bookingId: id,
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
