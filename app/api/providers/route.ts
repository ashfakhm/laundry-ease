import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { calculateDistance } from "@/lib/distance";
import { geocodeLocationText } from "@/lib/geocoding";

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
    const rawLimit = Number(searchParams.get("limit") || "50");
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(Math.floor(rawLimit), 100))
      : 50;

    const debug = process.env.PROVIDER_SEARCH_DEBUG === "true";
    if (debug) {
      logger.debug("PROVIDER_SEARCH", "Search params", {
        location,
        lat: latParam,
        lng: lngParam,
        name,
        service,
        deadline,
      });
    }

    const { db } = await getDb();
    const providersCollection = db.collection("providers");

    // Build query filter
    const filter: Record<string, unknown> = {};
    const hasPartialCoords =
      (latParam && !lngParam) || (!latParam && lngParam);
    if (hasPartialCoords) {
      return NextResponse.json(
        {
          error: "Both lat and lng must be provided together.",
        },
        { status: 400 },
      );
    }

    // Optional seeker-side search radius (provider-side radius is always enforced below)
    const radiusParam = searchParams.get("radius");
    let maxRadiusKm: number | null = radiusParam ? parseFloat(radiusParam) : null;
    if (maxRadiusKm !== null && (isNaN(maxRadiusKm) || maxRadiusKm <= 0)) {
      return NextResponse.json(
        { error: "Invalid radius. Must be a positive number." },
        { status: 400 },
      );
    }

    // Coordinates Search (strict geofence path)
    let userCoords: { lat: number; lng: number } | null = null;

    if (latParam && lngParam) {
      const lat = parseFloat(latParam);
      const lng = parseFloat(lngParam);

      // Validate coordinate ranges
      if (
        isNaN(lat) ||
        isNaN(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid coordinates. Latitude must be -90 to 90, Longitude must be -180 to 180.",
          },
          { status: 400 },
        );
      }

      userCoords = { lat, lng };
    }

    // If only location text is provided, geocode it and still enforce strict geofence checks.
    if (!userCoords && location) {
      userCoords = await geocodeLocationText(location);

      if (!userCoords) {
        if (debug) {
          logger.debug(
            "PROVIDER_SEARCH",
            "Location geocoding failed; returning empty results",
            { location },
          );
        }

        return NextResponse.json(
          {
            providers: [],
            total: 0,
            warning:
              "Unable to resolve location into coordinates. Please select a precise location.",
          },
          { status: 200 },
        );
      }

      if (debug) {
        logger.debug("PROVIDER_SEARCH", "Geocoded text location", {
          location,
          userCoords,
        });
      }
    }

    if (userCoords) {
      // Distance filtering requires provider coordinates.
      filter.coordinates = { $exists: true, $ne: null };

      // Reduce scan size before in-memory distance checks.
      // Provider radius is capped in validation, so this coarse window is safe.
      const candidateRadiusKm = maxRadiusKm ?? 50;
      const latDelta = candidateRadiusKm / 111;
      const lngDivisor =
        111 * Math.max(0.2, Math.cos((userCoords.lat * Math.PI) / 180));
      const lngDelta = candidateRadiusKm / lngDivisor;
      filter["coordinates.lat"] = {
        $gte: userCoords.lat - latDelta,
        $lte: userCoords.lat + latDelta,
      };
      filter["coordinates.lng"] = {
        $gte: userCoords.lng - lngDelta,
        $lte: userCoords.lng + lngDelta,
      };
    }

    // Normalize search-radius behavior: only meaningful when we have resolved coordinates.
    if (!userCoords) {
      maxRadiusKm = null;
    }

    // Name search (escape regex special characters to prevent ReDoS)
    if (name) {
      filter.name = { $regex: name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    }

    // Service search (escape regex special characters to prevent ReDoS)
    if (service) {
      filter.services = { $regex: service.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    }

    // Fetch providers matching filters
    const candidateFetchLimit = userCoords
      ? Math.min(Math.max(limit * 8, 200), 1000)
      : limit;

    let providers = await providersCollection
      .find(filter)
      .project({
        // Exclude all sensitive data from public listing
        passwordHash: 0,
        emailVerified: 0,
        phoneVerified: 0,
        documents: 0,
        bankDetails: 0,
        razorpay_fund_account_id: 0,
        razorpay_contact_id: 0,
      })
      .limit(candidateFetchLimit)
      .toArray();

    // Enforce provider radius coverage and optional seeker search radius
    if (userCoords) {
      providers = providers
        .filter((provider) => {
          if (!provider.coordinates) return false;
          const distance = calculateDistance(userCoords, provider.coordinates);
          const providerRadius = provider.radius_km || 10;
          const coveredByProvider = distance <= providerRadius;
          const withinSeekerSearchRadius =
            maxRadiusKm === null ? true : distance <= maxRadiusKm;
          return coveredByProvider && withinSeekerSearchRadius;
        })
        .map((provider) => {
          const distance = calculateDistance(userCoords, provider.coordinates);
          return {
            ...provider,
            distance_km: distance,
            distanceFromSeeker: distance,
          };
        })
        .sort(
          (a, b) =>
            (a.distance_km || Infinity) - (b.distance_km || Infinity),
        )
        .slice(0, limit);
    } else {
      // No location filter - just apply limit
      providers = providers.slice(0, limit);
    }

    if (debug) {
      logger.debug("PROVIDER_SEARCH", "Providers found", {
        filter,
        userCoords,
        maxRadiusKm,
        count: providers.length,
      });
    }

    return NextResponse.json(
      {
        providers,
        total: providers.length,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("PROVIDER_SEARCH", "Error fetching providers", error);
    return NextResponse.json(
      { error: "Failed to fetch providers" },
      { status: 500 },
    );
  }
}
