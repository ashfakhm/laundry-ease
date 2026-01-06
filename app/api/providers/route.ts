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
    const limit = parseInt(searchParams.get("limit") || "50");

    const { db } = await getDb();
    const providersCollection = db.collection("providers");

    // Build query filter
    const filter: Record<string, unknown> = {};

    // 1. Coordinates Search (Preferred)
    let userLat: number | null = null;
    let userLng: number | null = null;

    if (latParam && lngParam) {
      userLat = parseFloat(latParam);
      userLng = parseFloat(lngParam);
    }

    // 2. Fallback to text location if no coords (Legacy/Text behavior)
    if (!userLat && location) {
      filter.location = { $regex: location, $options: "i" };
    }

    // Name search
    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    // Service search
    if (service) {
      filter.services = { $regex: service, $options: "i" };
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

    // Helper: Haversine Distance (in km)
    const getDistance = (
      lat1: number,
      lon1: number,
      lat2: number,
      lon2: number
    ) => {
      const R = 6371; // Radius of the earth in km
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
          Math.cos(lat2 * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c; // Distance in km
    };

    const eligibleProviders = [];

    // Filter, Rank, and Enrich
    for (const provider of providers) {
      // Capacity check
      const CAPACITY_LIMIT = provider.capacity || 5;
      const activeBookingsCount = await db
        .collection("bookings")
        .countDocuments({
          provider_id: provider._id,
          status: {
            $in: ["requested", "accepted", "confirmed", "pickup_proposed"],
          },
        });
      const activeOrdersCount = await db.collection("orders").countDocuments({
        provider_id: provider._id,
        process_status: {
          $in: [
            "invoiced",
            "processing",
            "washing",
            "ironing",
            "ready",
            "out_for_delivery",
          ],
        },
      });

      if (activeBookingsCount + activeOrdersCount >= CAPACITY_LIMIT) {
        continue;
      }

      // Distance Filtering & Logic
      let distanceKm = 0;
      let estimatedDeliveryFee = 0;

      if (userLat && userLng && provider.coordinates) {
        // Calculate Distance
        // In a real production app, we would use Google Distance Matrix API here
        // to get driving distance. For MVP/Cost-saving, we use Haversine (Air distance).
        // If "Google Maps" integration is strictly required for *routing*, we might call it.
        // But iterating 50 providers * IDAPI calls is expensive and slow.
        // Good practice: Use Haversine for filtering, and maybe only Distance Matrix for the detail page or final booking.
        // Or if the prompt mandates Distance Matrix, we should batch request.
        // For now, Haversine is "State of the art" for fast search listings.

        distanceKm = getDistance(
          userLat,
          userLng,
          provider.coordinates.lat,
          provider.coordinates.lng
        );

        // Check if within provider's radius
        const maxRadius = provider.radius_km || 10;
        if (distanceKm > maxRadius && !provider.covers_beyond_radius) {
          continue;
        }

        // Calculate Fee
        const freeRadius = provider.free_radius_km || 0;
        if (distanceKm > freeRadius) {
          const chargeableKm = distanceKm - freeRadius;
          estimatedDeliveryFee = chargeableKm * (provider.per_km_rate || 0);
        }
      } else if (location && !userLat) {
        // Legacy/Text Mode: precise distance unknown, include if text match matches
        // (already filtered by find regex).
        // Distance remains 0.
      }

      eligibleProviders.push({
        ...provider,
        distance_km: parseFloat(distanceKm.toFixed(1)),
        estimated_delivery_fee: Math.round(estimatedDeliveryFee),
      });
    }

    // Sort by distance if using coordinates
    if (userLat && userLng) {
      eligibleProviders.sort((a, b) => a.distance_km - b.distance_km);
    }

    return NextResponse.json(
      {
        providers: eligibleProviders.slice(0, limit),
        total: eligibleProviders.length,
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
