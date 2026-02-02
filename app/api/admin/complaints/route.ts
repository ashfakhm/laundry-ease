import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";

/**
 * GET /api/admin/complaints
 * Fetch all complaints with seeker and provider details
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();

    // Verify admin
    const admin = await db
      .collection("admins")
      .findOne({ email: session.user.email });
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized - Admin only" },
        { status: 403 },
      );
    }

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
          seeker: seeker || null,
          provider: provider || null,
        };
      }),
    );

    return NextResponse.json(enrichedComplaints, { status: 200 });
  } catch (error) {
    logger.error("ADMIN_COMPLAINTS", "Error fetching complaints", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
