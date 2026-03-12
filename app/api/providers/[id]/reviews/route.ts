import { successResponse, errorResponse } from "@/lib/api/response";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    let providerId: ObjectId;
    try {
      providerId = new ObjectId(id);
    } catch {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid provider ID"),
      );
    }

    const { db } = await getDb();
    const reviews = await db
      .collection("reviews")
      .find({ provider_id: providerId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return successResponse(reviews);
  } catch (error) {
    logger.error("REVIEWS", "Error fetching provider reviews", error);
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal Server Error"),
    );
  }
}
