import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { calculateDistance } from "@/lib/distance";
import { Provider } from "@/lib/db";

/**
 * Geofencing + Radius-based Provider Discovery
 * 
 * Implementation:
 * 1. Provider sets base location (lat/lng) and service radius (km)
 * 2. System treats this as a circle: center = provider location, radius = coverage distance
 * 3. When seeker searches, system checks which provider circles contain the seeker's point
 * 4. Only providers whose circle contains seeker location are shown
 * 5. Results are sorted by distance (nearest first), then rating, then reviewCount
 * 
 * This is mathematical distance validation: distance(seeker, provider_center) ≤ provider_radius
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const maxSearchRadius = parseFloat(searchParams.get("maxRadius") || "50"); // Max radius to search (km)
    // const deadline = searchParams.get("deadline"); // Future: Filter by availability

    if (!lat || !lng) {
      return NextResponse.json(
        { error: "Latitude and longitude are required" },
        { status: 400 }
      );
    }

    const seekerLat = Number(lat);
    const seekerLng = Number(lng);
    const seekerLoc = { lat: seekerLat, lng: seekerLng };

    // Validate coordinates
    if (isNaN(seekerLat) || isNaN(seekerLng)) {
      return NextResponse.json(
        { error: "Invalid latitude or longitude" },
        { status: 400 }
      );
    }

    if (seekerLat < -90 || seekerLat > 90 || seekerLng < -180 || seekerLng > 180) {
      return NextResponse.json(
        { error: "Coordinates out of valid range" },
        { status: 400 }
      );
    }

    const { db } = await getDb();
    const providersCollection = db.collection<Provider>("providers");

    // Fetch providers with verified payout details and valid coordinates
    // We filter at the database level first, then apply geofencing logic
    const allProviders = await providersCollection
      .find({
        bankDetails: { $exists: true, $ne: null } as any,
        razorpay_fund_account_id: { $exists: true, $ne: null } as any,
        coordinates: { $exists: true, $ne: null } as any,
        // Ensure coordinates have valid lat/lng
        "coordinates.lat": { $gte: -90, $lte: 90 } as any,
        "coordinates.lng": { $gte: -180, $lte: 180 } as any,
      })
      .toArray();

    // Apply geofencing: Filter providers whose circle contains seeker location
    // distance(seeker, provider_center) ≤ provider_radius
    const nearbyProviders = allProviders
      .map((provider) => {
        const pLoc = provider.coordinates!;
        const distance = calculateDistance(seekerLoc, pLoc);

        // Pre-filter: Skip if beyond max search radius (performance optimization)
        if (distance > maxSearchRadius) return null;

        // Geofencing: Check if seeker is within provider's service radius
        // This is the core geofencing logic: distance ≤ provider_radius
        const providerRadius = provider.radius_km || 10; // Default to 10km if not set
        const isCovered = distance <= providerRadius;

        if (!isCovered) return null;

        // Calculate delivery fee based on distance and provider's pricing
        const freeRadius = provider.free_radius_km || 5; // Default free radius
        const extraDistance = Math.max(0, distance - freeRadius);
        const perKmRate = provider.per_km_rate || 10; // Default per km rate
        const deliveryFee = Math.round(extraDistance * perKmRate);

        return {
          _id: provider._id.toString(),
          name: provider.name,
          businessName: provider.businessName,
          bio: provider.bio,
          pricing: provider.pricing,
          location: provider.location,
          distance_km: distance,
          delivery_fee: deliveryFee,
          rating: provider.rating || 0,
          reviewCount: provider.reviewCount || 0,
          radius_km: providerRadius,
          per_km_rate: perKmRate,
          covers_beyond_radius: provider.covers_beyond_radius || false,
          profilePicture: provider.profilePicture,
          bannerImage: provider.bannerImage,
          services: provider.services || [], // Include services array
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => {
        // Sort by distance first (nearest), then rating (highest), then reviewCount (most)
        // This ensures seekers see the closest, highest-rated providers first
        if (Math.abs(a.distance_km - b.distance_km) > 0.01) {
          return a.distance_km - b.distance_km;
        }
        if (Math.abs(a.rating - b.rating) > 0.01) {
          return b.rating - a.rating;
        }
        return b.reviewCount - a.reviewCount;
      });

    return NextResponse.json(nearbyProviders);
  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
