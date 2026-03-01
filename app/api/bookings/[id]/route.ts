import { getBookingById } from "@/lib/db/index";
import { RATE_LIMIT_STRICT_WINDOW_MS } from "@/lib/constants";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireSeeker } from "@/lib/api/auth";
import { successResponse, errorResponse } from "@/lib/api/response";

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
      windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
    });

    if (!ObjectId.isValid(id)) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid booking id"));
    }

    const session = await requireSeeker();

    if (!session || !session.user) {
      return errorResponse(new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"));
    }

    const booking_id = new ObjectId(id);
    const booking = await getBookingById(booking_id);

    if (!booking) {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found"));
    }

    // Only seeker can delete their own booking
    if (booking.seeker_id.toString() !== session.user.id) {
      return errorResponse(new AppError(ErrorCode.FORBIDDEN, 403, "Unauthorized"));
    }

    // Validation: Can only delete if Cancelled or Rejected
    // "completed" might be history we want to keep, but "cancelled"/"rejected" is often clutter.
    const allowedStatuses = ["cancelled", "rejected"];
    if (!allowedStatuses.includes(booking.status)) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, `Cannot delete booking with status: ${booking.status}. Only Cancelled or Rejected bookings can be deleted.`));
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
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Cannot delete booking: An order exists for this booking. Please cancel the order first."));
    }

    // Safe to delete - no associated order
    const deleteResult = await db
      .collection("bookings")
      .deleteOne({ _id: booking_id });

    if (deleteResult.deletedCount === 1) {
      return successResponse({ message: "Booking deleted successfully" });
    } else {
      return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Failed to delete booking"));
    }
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("BOOKINGS", "Error deleting booking", error, {
      bookingId: id,
    });
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"));
  }
}
