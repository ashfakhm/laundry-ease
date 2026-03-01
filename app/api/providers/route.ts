import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { geocodeLocationText } from "@/lib/geocoding";
import { searchProviders } from "@/lib/services/provider-search";

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
    const rawLimit = Number(searchParams.get("limit") || "50");
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(Math.floor(rawLimit), 100))
      : 50;

    const debug = env.PROVIDER_SEARCH_DEBUG === "true";

    const { db } = await getDb();

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

    const radiusParam = searchParams.get("radius");
    const maxRadiusKm: number | null = radiusParam
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

    let userCoords: { lat: number; lng: number } | null = null;

    if (latParam && lngParam) {
      const lat = parseFloat(latParam);
      const lng = parseFloat(lngParam);
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

    if (!userCoords && location) {
      userCoords = await geocodeLocationText(location);
      if (!userCoords) {
        return successResponse({
          providers: [],
          total: 0,
          warning:
            "Unable to resolve location into coordinates. Please select a precise location.",
        });
      }
    }

    const result = await searchProviders(db.collection("providers"), {
      userCoords,
      maxRadiusKm,
      name,
      service,
      limit,
      debug,
    });

    return successResponse(result);
  } catch (error) {
    logger.error("PROVIDER_SEARCH", "Error fetching providers", error);
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Failed to fetch providers"),
    );
  }
}
