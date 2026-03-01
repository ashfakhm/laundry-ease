import { successResponse, errorResponse } from "@/lib/api/response";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { requireSeeker } from "@/lib/api/auth";

/**
 * GET /api/orders/seeker
 * Fetch all orders for the logged-in seeker
 */
export async function GET() {
  try {
    const { user } = await requireSeeker();
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"));
    }

    const { db } = await getDb();
    const seekerId = new ObjectId(user.id);
    const seeker = await db.collection("seekers").findOne({ _id: seekerId });

    if (!seeker) {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Seeker not found"));
    }

    // Fetch all orders for this seeker with provider details via $lookup
    const enrichedOrders = await db
      .collection("orders")
      .aggregate([
        { $match: { seeker_id: seeker._id } },
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: "providers",
            localField: "provider_id",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  name: 1,
                  businessName: 1,
                  phone: 1,
                  email: 1,
                  profilePicture: 1,
                  bannerImage: 1,
                },
              },
            ],
            as: "_providerArr",
          },
        },
        {
          $addFields: {
            provider: { $arrayElemAt: ["$_providerArr", 0] },
          },
        },
        { $project: { _providerArr: 0 } },
      ])
      .toArray();

    return successResponse(enrichedOrders, 200);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("ORDERS", "Error fetching seeker orders", error);
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"));
  }
}
