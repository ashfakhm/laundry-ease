import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { bookingScheduleSchema } from "@/lib/api/schemas";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireAuth } from "@/lib/api/auth";
import { Role } from "@/types/enums";
import {
  appErrorLegacyResponse,
  legacyErrorResponse,
  legacySuccessResponse,
} from "@/lib/api/legacy-response";

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
      windowMs: 5 * 60 * 1000,
    });

    const { user } = await requireAuth();
    if (!ObjectId.isValid(user.id)) {
      return legacyErrorResponse("Unauthorized", 401);
    }

    const body = await req.json();
    const parsed = bookingScheduleSchema.safeParse(body);

    if (!parsed.success) {
      return legacyErrorResponse("Invalid schedule data", 400, {
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { dateTime, action } = parsed.data;

    if (!ObjectId.isValid(id)) {
      return legacyErrorResponse("Invalid booking id", 400);
    }
    const bookingId = new ObjectId(id);

    const { db } = await getDb();
    const bookingQuery = { _id: bookingId };

    const booking = await db.collection("bookings").findOne(bookingQuery);
    if (!booking) {
      return legacyErrorResponse("Booking not found", 404);
    }

    // If seeker is confirming the slot
    if (action === "confirm") {
      if (user.role !== Role.SEEKER) {
        return legacyErrorResponse("Only seekers can confirm pickup slots", 403);
      }
      if (booking.seeker_id.toString() !== user.id) {
        return legacyErrorResponse("Unauthorized", 403);
      }
      if (booking.status !== "pickup_proposed") {
        return legacyErrorResponse(
          "Slot can only be confirmed when pickup is proposed",
          400,
        );
      }
      // Confirm the slot
      await db.collection("bookings").updateOne(bookingQuery, {
        $set: {
          status: "confirmed",
          "pickupSlot.confirmedAt": new Date(),
        },
      });
      // NOTE: Provider notification on slot confirmation could be added here using existing Twilio/email infrastructure
      return legacySuccessResponse();
    }

    // Otherwise, provider proposes a slot
    if (user.role !== Role.PROVIDER) {
      return legacyErrorResponse("Only providers can propose pickup slots", 403);
    }
    if (!dateTime) {
      return legacyErrorResponse("Date and time required", 400);
    }

    // Verify booking belongs to this provider
    if (booking.provider_id.toString() !== user.id) {
      return legacyErrorResponse("Unauthorized", 403);
    }
    if (
      booking.status !== "accepted" &&
      booking.status !== "reschedule_requested"
    ) {
      return legacyErrorResponse(
        "Slot can only be proposed for accepted bookings or reschedules",
        400,
      );
    }
    // Validate slot time
    const now = new Date();
    const slotTime = new Date(dateTime);
    const minTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    const deadline = booking.deadline ? new Date(booking.deadline) : null;
    if (slotTime < minTime) {
      return legacyErrorResponse("Pickup must be at least 2 hours from now", 400);
    }
    if (deadline && slotTime > deadline) {
      return legacyErrorResponse("Pickup cannot be after seeker's deadline", 400);
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

    return legacySuccessResponse();
  } catch (error) {
    if (error instanceof AppError) {
      return appErrorLegacyResponse(error);
    }

    logger.error("BOOKINGS", "Schedule pickup error", error, { bookingId: id });
    return legacyErrorResponse("Internal server error", 500);
  }
}
