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

    // Capacity Check
    // Filter out providers who have reached their max concurrent bookings
    const availableProviders = [];
    
    for (const provider of providers) {
      // Default capacity if not set
      const CAPACITY_LIMIT = provider.capacity || 5; 

      const activeBookingsCount = await db.collection("bookings").countDocuments({
        provider_id: provider._id,
        status: { $in: ["accepted", "confirmed", "pickup_proposed"] }
      });

      // Also check active orders (processing, washing, etc.)
      const activeOrdersCount = await db.collection("orders").countDocuments({
        provider_id: provider._id,
        process_status: { $in: ["processing", "washing", "ironing", "ready", "out_for_delivery"] }
      });

      if ((activeBookingsCount + activeOrdersCount) < CAPACITY_LIMIT) {
        availableProviders.push(provider);
      }
    }

    return NextResponse.json(
      {
        providers: availableProviders,
        total: availableProviders.length,
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
