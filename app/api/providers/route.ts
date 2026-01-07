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
    const latParam = searchParams.get("lat");
    const lngParam = searchParams.get("lng");
    const name = searchParams.get("name");
    const service = searchParams.get("service");
    const deadline = searchParams.get("deadline");
    const limit = parseInt(searchParams.get("limit") || "50");

    console.log("🔍 Provider Search Params:", {
      location,
      lat: latParam,
      lng: lngParam,
      name,
      service,
      deadline,
    });

    const { db } = await getDb();
    const providersCollection = db.collection("providers");

    // Build query filter
    const filter: Record<string, unknown> = {};
    const orConditions: Record<string, unknown>[] = [];

    // 1. Coordinates Search (Preferred)
    let userLat: number | null = null;
    let userLng: number | null = null;

    if (latParam && lngParam) {
      userLat = parseFloat(latParam);
      userLng = parseFloat(lngParam);
    }

    // 2. Fallback to text location if no coords (Legacy/Text behavior)
    if (!userLat && location) {
      // Search with multiple strategies for robustness:
      // a) Direct location match (case-insensitive)
      // b) Search in any field that might contain location info
      orConditions.push(
        { location: { $regex: location, $options: "i" } },
        { "address.city": { $regex: location, $options: "i" } },
        { address: { $regex: location, $options: "i" } }
      );
    }

    // Name search
    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    // Service search
    if (service) {
      filter.services = { $regex: service, $options: "i" };
    }

    // Apply $or conditions if we have location-based OR filters
    if (orConditions.length > 0) {
      filter.$or = orConditions;
    }

    // --- Optimization: Geospatial Filter ---
    // If we have coordinates, first filter by a broad "max reasonable radius" (e.g. 50km)
    // to reduce the set before calculating precise distances.
    // Ideally we'd use $nearSphere, but that requires a 2dsphere index.
    // For now, we'll fetch matches and filter in memory if index is missing,
    // OR just fetch matching services/name and filter by distance in JS.
    // Given MVP scale, in-memory filtering is fine.

    const providers = await providersCollection
      .find(filter)
      .project({
        passwordHash: 0,
        emailVerified: 0,
        phoneVerified: 0,
        documents: 0,
        bankDetails: 0,
      })
      .toArray();

    console.log("📦 Providers found with filter:", {
      filter,
      count: providers.length,
    });

    // DEBUG: Return early with raw providers for testing
    return NextResponse.json(
      {
        providers: providers.slice(0, limit),
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
