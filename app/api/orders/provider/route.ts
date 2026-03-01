import { successResponse, errorResponse } from "@/lib/api/response";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { requireProvider } from "@/lib/api/auth";

/**
 * GET /api/orders/provider
 * Fetch all orders for the logged-in provider
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

    // Fetch all orders for this provider with seeker details via $lookup
    const enrichedOrders = await db
      .collection("orders")
      .aggregate([
        { $match: { provider_id: providerId } },
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: "seekers",
            localField: "seeker_id",
            foreignField: "_id",
            pipeline: [{ $project: { name: 1, email: 1, phone: 1 } }],
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

    return successResponse(enrichedOrders, 200);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("ORDERS", "Error fetching provider orders", error);
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"));
  }
}
