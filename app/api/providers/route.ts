import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { calculateDistance } from "@/lib/distance";
import { geocodeLocationText } from "@/lib/geocoding";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

    const debug = env.PROVIDER_SEARCH_DEBUG === "true";
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
    const baseFilter: Record<string, unknown> = {};
    const hasPartialCoords = (latParam && !lngParam) || (!latParam && lngParam);
    if (hasPartialCoords) {
      return errorResponse(
        new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "Both lat and lng must be provided together.",
        ),
      );
    }

    // Optional seeker-side search radius (provider-side radius is always enforced below)
    const radiusParam = searchParams.get("radius");
    let maxRadiusKm: number | null = radiusParam
      ? parseFloat(radiusParam)
      : null;
    if (maxRadiusKm !== null && (isNaN(maxRadiusKm) || maxRadiusKm <= 0)) {
      return errorResponse(
        new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "Invalid radius. Must be a positive number.",
        ),
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
        return errorResponse(
          new AppError(
            ErrorCode.VALIDATION_ERROR,
            400,
            "Invalid coordinates. Latitude must be -90 to 90, Longitude must be -180 to 180.",
          ),
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

        return successResponse({
          providers: [],
          total: 0,
          warning:
            "Unable to resolve location into coordinates. Please select a precise location.",
        });
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
      // distance filtering handled below (geo query first; bounding-box fallback).
    }

    // Normalize search-radius behavior: only meaningful when we have resolved coordinates.
    if (!userCoords) {
      maxRadiusKm = null;
    }

    // Name search (escape regex special characters to prevent ReDoS)
    if (name) {
      baseFilter.name = { $regex: escapeRegex(name), $options: "i" };
    }

    // Service search (escape regex special characters to prevent ReDoS)
    if (service) {
      baseFilter.services = { $regex: escapeRegex(service), $options: "i" };
    }

    const fallbackFilter: Record<string, unknown> = { ...baseFilter };
    if (userCoords) {
      // Reduce scan size before in-memory distance checks.
      // Provider radius is capped by schema, so this coarse window is safe.
      const candidateRadiusKm = maxRadiusKm ?? 50;
      const latDelta = candidateRadiusKm / 111;
      const lngDivisor =
        111 * Math.max(0.2, Math.cos((userCoords.lat * Math.PI) / 180));
      const lngDelta = candidateRadiusKm / lngDivisor;
      fallbackFilter.coordinates = { $exists: true, $ne: null };
      fallbackFilter["coordinates.lat"] = {
        $gte: userCoords.lat - latDelta,
        $lte: userCoords.lat + latDelta,
      };
      fallbackFilter["coordinates.lng"] = {
        $gte: userCoords.lng - lngDelta,
        $lte: userCoords.lng + lngDelta,
      };
    }

    const candidateFetchLimit = userCoords
      ? Math.min(Math.max(limit * 8, 200), 1000)
      : limit;

    let providers: Array<Record<string, unknown>> = [];
    let usedGeoQuery = false;

    if (userCoords) {
      try {
        const geoSearchRadiusKm = maxRadiusKm ?? 50;
        const geoProviders = await providersCollection
          .aggregate([
            {
              $geoNear: {
                near: {
                  type: "Point",
                  coordinates: [userCoords.lng, userCoords.lat],
                },
                distanceField: "distance_meters",
                query: {
                  ...baseFilter,
                  locationGeoJSON: { $exists: true },
                },
                spherical: true,
                maxDistance: Math.round(geoSearchRadiusKm * 1000),
              },
            },
            {
              $match: {
                $expr: {
                  $lte: [
                    "$distance_meters",
                    {
                      $multiply: [{ $ifNull: ["$radius_km", 10] }, 1000],
                    },
                  ],
                },
              },
            },
            {
              $project: {
                // Exclude all sensitive data from public listing
                passwordHash: 0,
                emailVerified: 0,
                phoneVerified: 0,
                documents: 0,
                bankDetails: 0,
                razorpay_fund_account_id: 0,
                razorpay_contact_id: 0,
              },
            },
            { $limit: candidateFetchLimit },
          ])
          .toArray();

        if (geoProviders.length > 0) {
          usedGeoQuery = true;
          providers = geoProviders.map((provider) => {
            const distanceKm = Number(provider.distance_meters || 0) / 1000;
            return {
              ...provider,
              distance_km: distanceKm,
              distanceFromSeeker: distanceKm,
            };
          });
        }
      } catch (error) {
        if (debug) {
          logger.warn(
            "PROVIDER_SEARCH",
            "Geo query unavailable; falling back to bounding-box search",
            {
              reason: error instanceof Error ? error.message : String(error),
            },
          );
        }
      }
    }

    if (!usedGeoQuery) {
      providers = await providersCollection
        .find(fallbackFilter)
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
    }

    // Enforce provider radius coverage and optional seeker search radius
    if (userCoords) {
      if (usedGeoQuery) {
        providers = providers
          .sort(
            (a, b) =>
              Number(a.distance_km ?? Infinity) -
              Number(b.distance_km ?? Infinity),
          )
          .slice(0, limit);
      } else {
        providers = providers
          .filter((provider) => {
            let distance = Number(provider.distance_km);
            if (!Number.isFinite(distance)) {
              const coords = provider.coordinates as
                | { lat?: number; lng?: number }
                | undefined;
              if (
                !coords ||
                !Number.isFinite(coords.lat) ||
                !Number.isFinite(coords.lng)
              ) {
                return false;
              }
              distance = calculateDistance(userCoords, {
                lat: Number(coords.lat),
                lng: Number(coords.lng),
              });
            }
            const providerRadius = Number(provider.radius_km || 10);
            const coveredByProvider = distance <= providerRadius;
            const withinSeekerSearchRadius =
              maxRadiusKm === null ? true : distance <= maxRadiusKm;
            return coveredByProvider && withinSeekerSearchRadius;
          })
          .map((provider) => {
            const existingDistance = Number(provider.distance_km);
            if (Number.isFinite(existingDistance)) {
              return provider;
            }
            const coords = provider.coordinates as { lat: number; lng: number };
            const distance = calculateDistance(userCoords, coords);
            return {
              ...provider,
              distance_km: distance,
              distanceFromSeeker: distance,
            };
          })
          .sort(
            (a, b) =>
              Number(a.distance_km ?? Infinity) -
              Number(b.distance_km ?? Infinity),
          )
          .slice(0, limit);
      }
    } else {
      // No location filter - just apply limit
      providers = providers.slice(0, limit);
    }

    if (debug) {
      logger.debug("PROVIDER_SEARCH", "Providers found", {
        filter: usedGeoQuery ? { ...baseFilter, geo: true } : fallbackFilter,
        userCoords,
        maxRadiusKm,
        usedGeoQuery,
        count: providers.length,
      });
    }

    return successResponse({
      providers,
      total: providers.length,
    });
  } catch (error) {
    logger.error("PROVIDER_SEARCH", "Error fetching providers", error);
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Failed to fetch providers"),
    );
  }
}
