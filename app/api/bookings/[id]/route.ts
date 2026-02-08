import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getBookingById } from "@/lib/db";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";

export async function DELETE(
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

    // Only seeker can delete their own booking
    if (booking.seeker_id.toString() !== session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    // Validation: Can only delete if Cancelled or Rejected
    // "completed" might be history we want to keep, but "cancelled"/"rejected" is often clutter.
    const allowedStatuses = ["cancelled", "rejected"];
    if (!allowedStatuses.includes(booking.status)) {
      return NextResponse.json(
        {
          message: `Cannot delete booking with status: ${booking.status}. Only Cancelled or Rejected bookings can be deleted.`,
        },
        { status: 400 }
      );
    }

    const { db } = await getDb();

    // CRITICAL: Prevent orphan orders - check if there is an associated order
    // If an order exists, prevent deletion to maintain referential integrity
    const associatedOrder = await db
      .collection("orders")
      .findOne({ booking_id: booking_id });

    if (associatedOrder) {
      logger.warn(
        "BOOKINGS",
        "Attempted to delete booking with associated order",
        {
          bookingId: booking_id.toString(),
          orderId: associatedOrder._id.toString(),
        }
      );
      return NextResponse.json(
        {
          message:
            "Cannot delete booking: An order exists for this booking. Please cancel the order first.",
        },
        { status: 400 }
      );
    }

    // Safe to delete - no associated order
    const deleteResult = await db
      .collection("bookings")
      .deleteOne({ _id: booking_id });

    if (deleteResult.deletedCount === 1) {
      return NextResponse.json({
        success: true,
        message: "Booking deleted successfully",
      });
    } else {
      return NextResponse.json(
        { message: "Failed to delete booking" },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error("BOOKINGS", "Error deleting booking", error, {
      bookingId: id,
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
