import { getBookingById } from "@/lib/db/index";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireSeeker } from "@/lib/api/auth";
import {
  appErrorLegacyResponse,
  legacyErrorResponse,
  legacySuccessResponse,
} from "@/lib/api/legacy-response";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "bookings:delete",
      max: 10,
      windowMs: 5 * 60 * 1000,
    });

    if (!ObjectId.isValid(id)) {
      return legacyErrorResponse("Invalid booking id", 400);
    }

    const session = await requireSeeker();

    if (!session || !session.user) {
      return legacyErrorResponse("Unauthorized", 401);
    }

    const booking_id = new ObjectId(id);
    const booking = await getBookingById(booking_id);

    if (!booking) {
      return legacyErrorResponse("Booking not found", 404);
    }

    // Only seeker can delete their own booking
    if (booking.seeker_id.toString() !== session.user.id) {
      return legacyErrorResponse("Unauthorized", 403);
    }

    // Validation: Can only delete if Cancelled or Rejected
    // "completed" might be history we want to keep, but "cancelled"/"rejected" is often clutter.
    const allowedStatuses = ["cancelled", "rejected"];
    if (!allowedStatuses.includes(booking.status)) {
      return legacyErrorResponse(
        `Cannot delete booking with status: ${booking.status}. Only Cancelled or Rejected bookings can be deleted.`,
        400,
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
      return legacyErrorResponse(
        "Cannot delete booking: An order exists for this booking. Please cancel the order first.",
        400,
      );
    }

    // Safe to delete - no associated order
    const deleteResult = await db
      .collection("bookings")
      .deleteOne({ _id: booking_id });

    if (deleteResult.deletedCount === 1) {
      return legacySuccessResponse({
        message: "Booking deleted successfully",
      });
    } else {
      return legacyErrorResponse("Failed to delete booking", 500);
    }
  } catch (error) {
    if (error instanceof AppError) {
      return appErrorLegacyResponse(error);
    }

    logger.error("BOOKINGS", "Error deleting booking", error, {
      bookingId: id,
    });
    return legacyErrorResponse("Internal server error", 500);
  }
}
