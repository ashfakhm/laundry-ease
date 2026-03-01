import { createBooking } from "@/lib/db/index";
import { MIN_PICKUP_ADVANCE_MS, RATE_LIMIT_AUTH_WINDOW_MS } from "@/lib/constants";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { requireSeeker } from "@/lib/api/auth";
import { successResponse, withErrorHandling } from "@/lib/api/response";
import { createBookingSchema } from "@/lib/api/schemas";
import { Errors } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { calculateDistance } from "@/lib/distance";
import { geocodeLocationText } from "@/lib/geocoding";

type Coordinates = { lat: number; lng: number };

function hasValidCoordinates(value: unknown): value is Coordinates {
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

function buildAddressString(address: unknown): string | null {
  if (!address || typeof address !== "object") return null;
  const parsed = address as Partial<{
    line1: string;
    landmark: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }>;

  const parts = [
    parsed.line1,
    parsed.landmark,
    parsed.city,
    parsed.state,
    parsed.postalCode,
    parsed.country,
  ]
    .filter((part): part is string => typeof part === "string")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

export const POST = withErrorHandling(async (req: Request) => {
  await requireSameOrigin(req);
  await enforceRateLimit(req, {
    bucket: "bookings:create",
    max: 12,
    windowMs: RATE_LIMIT_AUTH_WINDOW_MS,
  });

  const session = await requireSeeker();

  const body = await req.json();
  const result = createBookingSchema.safeParse(body);

  if (!result.success) {
    throw Errors.validation(
      "Invalid booking data",
      result.error.flatten().fieldErrors,
    );
  }

  const { provider_id, deadline, seeker_coordinates } = result.data;
  const seeker_id = new ObjectId(session.user.id);
  const providerOid = new ObjectId(provider_id);
  const parsedDeadline = new Date(deadline);

  if (Number.isNaN(parsedDeadline.getTime())) {
    throw Errors.validation("Invalid booking deadline");
  }

  const minAllowedDeadline = new Date(Date.now() + MIN_PICKUP_ADVANCE_MS);
  if (parsedDeadline < minAllowedDeadline) {
    throw Errors.validation(
      "Deadline must be at least 2 hours from now",
      {
        deadline: [
          "Choose a deadline at least 2 hours from now to allow pickup scheduling.",
        ],
      },
    );
  }

  const { db } = await getDb();
  const provider = await db
    .collection("providers")
    .findOne({ _id: providerOid });

  if (!provider) {
    throw Errors.notFound("Provider");
  }

  if (!hasValidCoordinates(provider.coordinates)) {
    throw Errors.conflict(
      "Provider service area is not configured. Please choose another provider.",
    );
  }

  const seekerProfile = await db.collection("seekers").findOne(
    { _id: seeker_id },
    {
      projection: {
        coordinates: 1,
        address: 1,
      },
    },
  );

  if (!seekerProfile) {
    throw Errors.notFound("Seeker");
  }

  let resolvedSeekerCoordinates = seeker_coordinates;

  if (!resolvedSeekerCoordinates && hasValidCoordinates(seekerProfile.coordinates)) {
    resolvedSeekerCoordinates = seekerProfile.coordinates;
  }

  if (!resolvedSeekerCoordinates) {
    const seekerAddress = buildAddressString(seekerProfile.address);
    if (seekerAddress) {
      const geocodedCoords = await geocodeLocationText(seekerAddress);
      if (geocodedCoords) {
        resolvedSeekerCoordinates = geocodedCoords;
      }
    }
  }

  if (!resolvedSeekerCoordinates) {
    throw Errors.validation("Seeker location is required to create booking", {
      seeker_coordinates: [
        "Set your profile coordinates or provide precise pickup coordinates.",
      ],
    });
  }

  const providerRadiusKm =
    typeof provider.radius_km === "number" && provider.radius_km > 0
      ? provider.radius_km
      : 10;
  const distanceKm = calculateDistance(
    resolvedSeekerCoordinates,
    provider.coordinates,
  );

  if (distanceKm > providerRadiusKm) {
    throw Errors.conflict(
      `Provider serves within ${providerRadiusKm} km. Your pickup is ${distanceKm} km away.`,
    );
  }

  const capacity = provider.capacity || 100;

  // Atomic booking creation with transactional capacity check
  // Prevents race condition where multiple parallel requests could exceed capacity
  try {
    const booking = await createBooking({
      seeker_id,
      provider_id: providerOid,
      deadline: parsedDeadline,
      seeker_coordinates: resolvedSeekerCoordinates,
      bookingFee: provider.pricing || 0,
      capacity,
    });

    return successResponse(booking, 201);
  } catch (error) {
    // Handle capacity exceeded error from transaction
    if (
      error instanceof Error &&
      error.message.startsWith("CAPACITY_EXCEEDED:")
    ) {
      throw Errors.conflict(error.message.replace("CAPACITY_EXCEEDED:", ""));
    }
    throw error;
  }
});
