import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/auth";

/**
 * GET /api/admin/complaints
 * Fetch all complaints with seeker and provider details
 */
export async function GET() {
  try {
    await requireAdmin();

    const { db } = await getDb();

    // Fetch all complaints
    const complaints = await db
      .collection("complaints")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    // Enrich with seeker and provider details
    const enrichedComplaints = await Promise.all(
      complaints.map(async (complaint) => {
        const [seeker, provider] = await Promise.all([
          db
            .collection("seekers")
            .findOne(
              { _id: new ObjectId(complaint.seeker_id) },
              { projection: { name: 1, email: 1 } },
            ),
          db
            .collection("providers")
            .findOne(
              { _id: new ObjectId(complaint.provider_id) },
              { projection: { name: 1, businessName: 1, profilePicture: 1 } },
            ),
        ]);

        return {
          ...complaint,
          _id: complaint._id.toString(),
          seeker_id: complaint.seeker_id?.toString() || null,
          provider_id: complaint.provider_id?.toString() || null,
          order_id: complaint.order_id?.toString() || null,
          seeker: seeker || null,
          provider: provider || null,
        };
      }),
    );

    return NextResponse.json(enrichedComplaints, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.statusCode },
      );
    }

    logger.error("ADMIN_COMPLAINTS", "Error fetching complaints", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
