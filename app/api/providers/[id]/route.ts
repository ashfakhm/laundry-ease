import { successResponse } from "@/lib/api/response";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";

/**
 * GET /api/providers/:id
 * Fetch a single provider by ID (public endpoint for seeker browsing)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid provider ID" },
        { status: 400 },
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
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 },
      );
    }

    return successResponse(provider, 200);
  } catch (error) {
    logger.error("PROVIDER", "Error fetching provider", error, {
      providerId: id,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
