import { successResponse, errorResponse } from "@/lib/api/response";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";

/**
 * GET /api/providers/:id
 * Fetch a single provider by ID (public endpoint for seeker browsing)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid provider ID"),
      );
    }

    const { db } = await getDb();
    const provider = await db.collection("providers").findOne(
      { _id: new ObjectId(id) },
      {
        projection: {
          // Exclude sensitive data completely
          passwordHash: 0,
          emailVerified: 0,
          phoneVerified: 0,
          bankDetails: 0, // Never expose bank details in public endpoint
          razorpay_fund_account_id: 0,
          razorpay_contact_id: 0,
        },
      },
    );

    if (!provider) {
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "Provider not found"),
      );
    }

    return successResponse(provider, 200);
  } catch (error) {
    logger.error("PROVIDER", "Error fetching provider", error, {
      providerId: id,
    });
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"),
    );
  }
}
