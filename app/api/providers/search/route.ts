import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { calculateDistance } from "@/lib/distance";
import { Provider } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    // const deadline = searchParams.get("deadline"); // Future: Filter by availability

    if (!lat || !lng) {
      return NextResponse.json(
        { error: "Latitude and longitude are required" },
        { status: 400 }
      );
    }

    const { db } = await getDb();
    // Only show providers with verified payout details
    const providers = await db
      .collection<Provider>("providers")
      .find({
        bankDetails: { $exists: true, $ne: null } as any,
        razorpay_fund_account_id: { $exists: true, $ne: null } as any,
      })
      .toArray();

    const seekerLoc = { lat: Number(lat), lng: Number(lng) };

    const nearbyProviders = providers
      .map((provider) => {
        // Default coordinates if missing (MVP fallback)
        const pLoc = provider.coordinates || { lat: 0, lng: 0 };
        const distance = calculateDistance(seekerLoc, pLoc);

        // Check if seeker is within provider's radius
        const maxRadius = provider.radius_km || 10;
        const isCovered = distance <= maxRadius;

        if (!isCovered) return null;

        // Calculate delivery fee
        const freeRadius = provider.free_radius_km || 5;
        const extraDistance = Math.max(0, distance - freeRadius);
        const perKmRate = provider.per_km_rate || 10;
        const deliveryFee = extraDistance * perKmRate;

        return {
          _id: provider._id.toString(),
          name: provider.name,
          businessName: provider.businessName,
          bio: provider.bio,
          pricing: provider.pricing, // Base price
          location: provider.location,
          distance_km: distance,
          delivery_fee: deliveryFee,
          rating: provider.rating || 0,
          reviewCount: provider.reviewCount || 0,
        };
      })
      .filter((p) => p !== null)
      .sort((a, b) => a!.distance_km - b!.distance_km);

    return NextResponse.json(nearbyProviders);
  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
