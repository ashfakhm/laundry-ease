import { successResponse, errorResponse } from "@/lib/api/response";
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

    // Fetch all bookings for this provider with seeker details via $lookup
    const enrichedBookings = await db
      .collection("bookings")
      .aggregate([
        {
          $match: {
            provider_id: providerId,
            bookingFeeStatus: { $in: ["paid", "applied"] },
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: "seekers",
            localField: "seeker_id",
            foreignField: "_id",
            pipeline: [{ $project: { passwordHash: 0 } }],
            as: "_seekerArr",
          },
        },
        {
          $addFields: {
            seeker: { $arrayElemAt: ["$_seekerArr", 0] },
          },
        },
        { $project: { _seekerArr: 0 } },
      ])
      .toArray();

    return successResponse(enrichedBookings, 200);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("BOOKINGS", "Error fetching provider bookings", error);
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"));
  }
}
