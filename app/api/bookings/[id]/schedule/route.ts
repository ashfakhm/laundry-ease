import { successResponse, errorResponse } from "@/lib/api/response";
import { RATE_LIMIT_STRICT_WINDOW_MS } from "@/lib/constants";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { bookingScheduleSchema } from "@/lib/api/schemas";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireAuth } from "@/lib/api/auth";
import { Role } from "@/types/enums";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "bookings:schedule",
      max: 30,
      windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
    });

    const { user } = await requireAuth();
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"));
    }

    const body = await req.json();
    const parsed = bookingScheduleSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid schedule data", parsed));
    }

    const { dateTime, action } = parsed.data;

    if (!ObjectId.isValid(id)) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid booking id"));
    }
    const bookingId = new ObjectId(id);

    const { db } = await getDb();
    const bookingQuery = { _id: bookingId };

    const booking = await db.collection("bookings").findOne(bookingQuery);
    if (!booking) {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found"));
    }

    // If seeker is confirming the slot
    if (action === "confirm") {
      if (user.role !== Role.SEEKER) {
        return errorResponse(new AppError(ErrorCode.FORBIDDEN, 403, "Only seekers can confirm pickup slots"));
      }
      if (booking.seeker_id.toString() !== user.id) {
        return errorResponse(new AppError(ErrorCode.FORBIDDEN, 403, "Unauthorized"));
      }
      if (booking.status !== "pickup_proposed") {
        return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Slot can only be confirmed when pickup is proposed"));
      }
      // Confirm the slot
      await db.collection("bookings").updateOne(bookingQuery, {
        $set: {
          status: "confirmed",
          "pickupSlot.confirmedAt": new Date(),
        },
      });
      // NOTE: Provider notification on slot confirmation could be added here using existing Twilio/email infrastructure
      return successResponse({
        success: true
      }, 200);
    }

    // Otherwise, provider proposes a slot
    if (user.role !== Role.PROVIDER) {
      return errorResponse(new AppError(ErrorCode.FORBIDDEN, 403, "Only providers can propose pickup slots"));
    }
    if (!dateTime) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Date and time required"));
    }

    // Verify booking belongs to this provider
    if (booking.provider_id.toString() !== user.id) {
      return errorResponse(new AppError(ErrorCode.FORBIDDEN, 403, "Unauthorized"));
    }
    if (
      booking.status !== "accepted" &&
      booking.status !== "reschedule_requested"
    ) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Slot can only be proposed for accepted bookings or reschedules"));
    }
    // Validate slot time
    const now = new Date();
    const slotTime = new Date(dateTime);
    const minTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    const deadline = booking.deadline ? new Date(booking.deadline) : null;
    if (slotTime < minTime) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Pickup must be at least 2 hours from now"));
    }
    if (deadline && slotTime > deadline) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Pickup cannot be after seeker's deadline"));
    }
    // Update booking with proposed pickup time
    await db.collection("bookings").updateOne(bookingQuery, {
      $set: {
        status: "pickup_proposed",
        pickupSlot: {
          proposedBy: "provider",
          dateTime: slotTime,
          confirmedAt: undefined,
        },
      },
    });

    // NOTE: Seeker notification on new pickup proposal could be added here using existing Twilio/email infrastructure

    return successResponse({
      success: true
    }, 200);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("BOOKINGS", "Schedule pickup error", error, { bookingId: id });
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"));
  }
}
