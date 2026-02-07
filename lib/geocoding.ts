import { logger } from "@/lib/logger";

type Coordinates = { lat: number; lng: number };

type GeocodingApiResponse = {
  status?: string;
  results?: Array<{
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
};

function isValidCoordinatePair(value: unknown): value is Coordinates {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Coordinates>;
  return (
    typeof candidate.lat === "number" &&
    typeof candidate.lng === "number" &&
    candidate.lat >= -90 &&
    candidate.lat <= 90 &&
    candidate.lng >= -180 &&
    candidate.lng <= 180
  );
}

export async function geocodeLocationText(
  locationText: string
): Promise<Coordinates | null> {
  const query = locationText.trim();
  if (!query) return null;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    logger.warn(
      "GEOCODING",
      "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing. Skipping geocode.",
      { locationText: query }
    );
    return null;
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", query);
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      logger.warn("GEOCODING", "Geocoding API request failed", {
        status: response.status,
        locationText: query,
      });
      return null;
    }

    const data = (await response.json()) as GeocodingApiResponse;

    if (data.status !== "OK" || !Array.isArray(data.results)) {
      logger.warn("GEOCODING", "Geocoding API returned non-OK status", {
        status: data.status,
        locationText: query,
      });
      return null;
    }

    const location = data.results[0]?.geometry?.location;
    if (!isValidCoordinatePair(location)) {
      logger.warn("GEOCODING", "Geocoding result missing valid coordinates", {
        locationText: query,
      });
      return null;
    }

    return location;
  } catch (error) {
    logger.error("GEOCODING", "Unexpected geocoding error", error, {
      locationText: query,
    });
    return null;
  }
}
