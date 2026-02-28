import { successResponse, errorResponse } from "@/lib/api/response";
import { getDb } from "@/lib/mongodb";
import { Booking } from "@/types/bookings";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { requireSeeker } from "@/lib/api/auth";

export async function GET() {
  try {
    const { user } = await requireSeeker();
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"));
    }

    const { db } = await getDb();
    
    // Aggregation to join provider details
    const bookings = await db
      .collection<Booking>("bookings")
      .aggregate([
        { $match: { seeker_id: new ObjectId(user.id) } },
        {
             $lookup: {
                 from: "providers",
                 localField: "provider_id",
                 foreignField: "_id",
                 as: "provider"
             }
        },
        { $unwind: "$provider" },
        { $sort: { createdAt: -1 } }
      ])
      .toArray();
      
    // Fix: ObjectId matching might be tricky if not cast.
    // Let's rely on standard find with proper casting if direct aggregate fails, 
    // but aggregate is better for joins.
    // Ideally we import ObjectId.
    
    return successResponse(bookings);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("BOOKINGS", "Error fetching seeker bookings", error);
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"));
  }
}
