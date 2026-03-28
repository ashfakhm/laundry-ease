import { successResponse, errorResponse } from "@/lib/api/response";
import { getDb } from "@/lib/mongodb";
import { fetchSeekerBookingsById } from "@/lib/data/bookings";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { requireSeeker } from "@/lib/api/auth";

export async function GET(request: Request) {
  try {
    const { user } = await requireSeeker();
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );
    }

    const { db } = await getDb();
    const seekerId = new ObjectId(user.id);
    const includeFinalized =
      new URL(request.url).searchParams.get("includeFinalized") === "1";

    const seeker = await db.collection("seekers").findOne({ _id: seekerId });
    if (!seeker) {
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "Seeker not found"),
      );
    }

    const bookings = await fetchSeekerBookingsById(db, seekerId, {
      includeFinalized,
    });

    return successResponse(bookings);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("BOOKINGS", "Error fetching seeker bookings", error);
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"),
    );
  }
}
