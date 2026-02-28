import { successResponse, errorResponse } from "@/lib/api/response";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { requireProvider } from "@/lib/api/auth";

/**
 * GET /api/bookings/provider
 * Fetch all bookings for the logged-in provider
 */
export async function GET() {
  try {
    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"));
    }

    const { db } = await getDb();
    const providerId = new ObjectId(user.id);

    const provider = await db.collection("providers").findOne({ _id: providerId });

    if (!provider) {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Provider not found"));
    }

    // Fetch all bookings for this provider
    const bookings = await db
      .collection("bookings")
      .find({ 
        provider_id: providerId,
        bookingFeeStatus: { $in: ["paid", "applied"] },
      })
      .sort({ createdAt: -1 })
      .toArray();

    // Fetch seeker details for each booking
    const enrichedBookings = await Promise.all(
      bookings.map(async (booking) => {
        const seeker = await db
          .collection("seekers")
          .findOne(
            { _id: new ObjectId(booking.seeker_id) },
            { projection: { passwordHash: 0 } }
          );

        return {
          ...booking,
          seeker: seeker || null,
        };
      })
    );

    return successResponse(enrichedBookings, 200);
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

    logger.error("BOOKINGS", "Error fetching provider bookings", error);
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"));
  }
}
