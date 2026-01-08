import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getBookingById, updateBookingStatus } from "@/lib/db"; // You might need to expose updateBookingStatus generic or specific
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const booking_id = new ObjectId(id);
    const booking = await getBookingById(booking_id);

    if (!booking) {
      return NextResponse.json(
        { message: "Booking not found" },
        { status: 404 }
      );
    }

    if (booking.seeker_id.toString() !== session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    // Validation: Can only cancel if 'requested' or 'pickup_proposed'
    // 'accepted', 'confirmed', 'invoice_created' might imply commitment.
    // User requested "mistake", usually early stage.
    const allowedStatuses = ["requested", "pickup_proposed"];

    if (!allowedStatuses.includes(booking.status)) {
      return NextResponse.json(
        {
          message: `Cannot cancel booking with status: ${booking.status}. Contact support.`,
        },
        { status: 400 }
      );
    }

    // Update status to 'cancelled'
    const { db } = await getDb();
    const result = await db.collection("bookings").updateOne(
      { _id: booking_id },
      {
        $set: {
          status: "cancelled",
          updatedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount === 1) {
      return NextResponse.json({
        success: true,
        message: "Booking cancelled successfully",
      });
    } else {
      return NextResponse.json(
        { message: "Failed to update booking" },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error("BOOKINGS", "Error cancelling booking", error, {
      bookingId: id,
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
