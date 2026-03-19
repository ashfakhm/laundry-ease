/**
 * Provider search engine.
 *
 * Encapsulates geo-near aggregation with bounding-box fallback,
 * provider-radius enforcement, and optional seeker-radius filtering.
 */

import { Collection } from "mongodb";
import { calculateDistance } from "@/lib/distance";
import { logger } from "@/lib/logger";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SENSITIVE_PROJECTION = {
  passwordHash: 0,
  emailVerified: 0,
  phoneVerified: 0,
  documents: 0,
  bankDetails: 0,
  razorpay_fund_account_id: 0,
  razorpay_contact_id: 0,
};

export type ProviderSearchParams = {
  userCoords: { lat: number; lng: number } | null;
  maxRadiusKm: number | null;
  name: string | null;
  service: string | null;
  limit: number;
  debug?: boolean;
};

export async function searchProviders(
  collection: Collection,
  params: ProviderSearchParams,
): Promise<{ providers: Array<Record<string, unknown>>; total: number }> {
  const { userCoords, name, service, debug } = params;
  const limit = params.limit;
  const maxRadiusKm = userCoords ? params.maxRadiusKm : null;

  const baseFilter: Record<string, unknown> = {
    isDeleted: { $ne: true },
    $or: [
      { blocked_until: { $exists: false } },
      { blocked_until: null },
      { blocked_until: { $lte: new Date() } },
    ],
  };
  if (name) {
    baseFilter.name = { $regex: escapeRegex(name), $options: "i" };
  }
  if (service) {
    baseFilter.services = { $regex: escapeRegex(service), $options: "i" };
  }

  const candidateFetchLimit = userCoords
    ? Math.min(Math.max(limit * 8, 200), 1000)
    : limit;

  let providers: Array<Record<string, unknown>> = [];
  let usedGeoQuery = false;

  if (userCoords) {
    try {
      const geoSearchRadiusKm = maxRadiusKm ?? 50;
      const geoProviders = await collection
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
                  { $multiply: [{ $ifNull: ["$radius_km", 10] }, 1000] },
                ],
              },
            },
          },
          { $project: SENSITIVE_PROJECTION },
          { $limit: candidateFetchLimit },
        ])
        .toArray();

      if (geoProviders.length > 0) {
        usedGeoQuery = true;
        providers = geoProviders.map((p) => {
          const distanceKm = Number(p.distance_meters || 0) / 1000;
          return { ...p, distance_km: distanceKm, distanceFromSeeker: distanceKm };
        });
      }
    } catch (error) {
      if (debug) {
        logger.warn(
          "PROVIDER_SEARCH",
          "Geo query unavailable; falling back to bounding-box search",
          { reason: error instanceof Error ? error.message : String(error) },
        );
      }
    }
  }

  if (!usedGeoQuery) {
    const fallbackFilter: Record<string, unknown> = { ...baseFilter };
    if (userCoords) {
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

    providers = await collection
      .find(fallbackFilter)
      .project(SENSITIVE_PROJECTION)
      .limit(candidateFetchLimit)
      .toArray();
  }

  // Enforce provider radius and optional seeker search radius
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
    providers = providers.slice(0, limit);
  }

  if (debug) {
    logger.debug("PROVIDER_SEARCH", "Providers found", {
      filter: usedGeoQuery ? { ...baseFilter, geo: true } : baseFilter,
      userCoords,
      maxRadiusKm,
      usedGeoQuery,
      count: providers.length,
    });
  }

  return { providers, total: providers.length };
}
