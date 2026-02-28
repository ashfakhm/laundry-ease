import { successResponse } from "@/lib/api/response";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { bookingScheduleSchema } from "@/lib/api/schemas";
import { AppError } from "@/lib/api/errors";
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
      windowMs: 5 * 60 * 1000,
    });

    const { user } = await requireAuth();
    if (!ObjectId.isValid(user.id)) {
      return NextResponse.json({
        success: false,
        error: "Unauthorized"
      }, {
        status: 401
      });
    }

    const body = await req.json();
    const parsed = bookingScheduleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: "Invalid schedule data",
        details: parsed.error.flatten().fieldErrors
      }, {
        status: 400
      });
    }

    const { dateTime, action } = parsed.data;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({
        success: false,
        error: "Invalid booking id"
      }, {
        status: 400
      });
    }
    const bookingId = new ObjectId(id);

    const { db } = await getDb();
    const bookingQuery = { _id: bookingId };

    const booking = await db.collection("bookings").findOne(bookingQuery);
    if (!booking) {
      return NextResponse.json({
        success: false,
        error: "Booking not found"
      }, {
        status: 404
      });
    }

    // If seeker is confirming the slot
    if (action === "confirm") {
      if (user.role !== Role.SEEKER) {
        return NextResponse.json({
          success: false,
          error: "Only seekers can confirm pickup slots"
        }, {
          status: 403
        });
      }
      if (booking.seeker_id.toString() !== user.id) {
        return NextResponse.json({
          success: false,
          error: "Unauthorized"
        }, {
          status: 403
        });
      }
      if (booking.status !== "pickup_proposed") {
        return NextResponse.json({
          success: false,
          error: "Slot can only be confirmed when pickup is proposed"
        }, {
          status: 400
        });
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
      return NextResponse.json({
        success: false,
        error: "Only providers can propose pickup slots"
      }, {
        status: 403
      });
    }
    if (!dateTime) {
      return NextResponse.json({
        success: false,
        error: "Date and time required"
      }, {
        status: 400
      });
    }

    // Verify booking belongs to this provider
    if (booking.provider_id.toString() !== user.id) {
      return NextResponse.json({
        success: false,
        error: "Unauthorized"
      }, {
        status: 403
      });
    }
    if (
      booking.status !== "accepted" &&
      booking.status !== "reschedule_requested"
    ) {
      return NextResponse.json({
        success: false,
        error: "Slot can only be proposed for accepted bookings or reschedules"
      }, {
        status: 400
      });
    }
    // Validate slot time
    const now = new Date();
    const slotTime = new Date(dateTime);
    const minTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    const deadline = booking.deadline ? new Date(booking.deadline) : null;
    if (slotTime < minTime) {
      return NextResponse.json({
        success: false,
        error: "Pickup must be at least 2 hours from now"
      }, {
        status: 400
      });
    }
    if (deadline && slotTime > deadline) {
      return NextResponse.json({
        success: false,
        error: "Pickup cannot be after seeker's deadline"
      }, {
        status: 400
      });
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
      return NextResponse.json({
        success: false,
        error: error.message,

        ...(error.details ? {
          details: error.details
        } : {})
      }, {
        status: error.statusCode || 400
      });
    }

    logger.error("BOOKINGS", "Schedule pickup error", error, { bookingId: id });
    return NextResponse.json({
      success: false,
      error: "Internal server error"
    }, {
      status: 500
    });
  }
}
