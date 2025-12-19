import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/**
 * GET /api/providers/:id
 * Fetch a single provider by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid provider ID" },
        { status: 400 }
      );
    }

    const { db } = await getDb();
    const provider = await db.collection("providers").findOne(
      { _id: new ObjectId(id) },
      {
        projection: {
          passwordHash: 0, // Exclude sensitive data
          emailVerified: 0,
          phoneVerified: 0,
        },
      }
    );

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(provider, { status: 200 });
  } catch (error) {
    console.error("Error fetching provider:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
