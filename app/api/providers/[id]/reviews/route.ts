import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";

// GET /api/providers/[id]/reviews — public endpoint
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
      return NextResponse.json({
        success: false,
        error: "Invalid provider ID"
      }, {
        status: 400
      });
    }

    const { db } = await getDb();
    const reviews = await db
      .collection("reviews")
      .find({ provider_id: providerId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json(reviews);
  } catch (error) {
    logger.error("REVIEWS", "Error fetching provider reviews", error);
    return NextResponse.json({
      success: false,
      error: "Internal Server Error"
    }, {
      status: 500
    });
  }
}
