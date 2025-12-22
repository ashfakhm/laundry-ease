import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getBookingById } from "@/lib/db";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Only allow accept/reject if booking fee is paid
    if (booking.bookingFeeStatus !== "paid") {
      return NextResponse.json(
        {
          message:
            "Booking fee must be paid before provider can accept/reject.",
        },
        { status: 400 }
      );
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

    // Check if there is an associated order.
    // If an order exists (even if cancelled), deleting the booking might break references in Order.
    // However, usually "cancelled" bookings don't have orders yet, or the order is also cancelled.
    // For this specific logic: if an Order exists, we might want to prevent deletion or cascading delete.
    // For MVP/simple flow: allow deletion if booking is standalone.

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
    console.error("Error deleting booking:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
