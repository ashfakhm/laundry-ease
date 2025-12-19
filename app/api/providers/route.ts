import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

/**
 * Search for providers based on location, name, services, and other criteria
 * GET /api/providers?location=city&name=john&service=laundry
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const location = searchParams.get("location");
    const name = searchParams.get("name");
    const service = searchParams.get("service");
    const limit = parseInt(searchParams.get("limit") || "50");

    const { db } = await getDb();
    const providersCollection = db.collection("providers");

    // Build query filter
    const filter: Record<string, unknown> = {};

    // Location search (case-insensitive, partial match)
    if (location) {
      filter.location = { $regex: location, $options: "i" };
    }

    // Name search (case-insensitive, partial match)
    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    // Service search (exact match in array)
    if (service) {
      filter.services = { $regex: service, $options: "i" };
    }

    const providers = await providersCollection
      .find(filter)
      .limit(limit)
      .project({
        passwordHash: 0, // Exclude sensitive data
        emailVerified: 0,
        phoneVerified: 0,
        documents: 0,
      })
      .toArray();

    return NextResponse.json(
      {
        providers,
        total: providers.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching providers:", error);
    return NextResponse.json(
      { error: "Failed to fetch providers" },
      { status: 500 }
    );
  }
}
