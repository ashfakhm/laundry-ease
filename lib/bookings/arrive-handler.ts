import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireProvider } from "@/lib/api/auth";
import { markProviderArrival } from "@/lib/bookings/mark-arrived";
import {
  legacyMessageBody,
  appErrorLegacyResponse,
} from "@/lib/api/legacy-response";

type Coordinates = { lat: number; lng: number } | null;

type HandleArriveInput = {
  req: Request;
  bookingId: string;
  coordinates: Coordinates;
  rateLimitBucket: string;
  logContext: "arrive_route" | "arrived_route";
};

export async function handleProviderArrival(
  input: HandleArriveInput,
): Promise<NextResponse> {
  const { req, bookingId, coordinates, rateLimitBucket, logContext } = input;

  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: rateLimitBucket,
      max: 30,
      windowMs: 5 * 60 * 1000,
    });

    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) {
      return NextResponse.json(legacyMessageBody("Unauthorized"), { status: 401 });
    }

    if (!ObjectId.isValid(bookingId)) {
      return NextResponse.json(legacyMessageBody("Invalid booking id"), { status: 400 });
    }

    const result = await markProviderArrival({
      bookingId: new ObjectId(bookingId),
      providerId: new ObjectId(user.id),
      coordinates,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof AppError) {
      return appErrorLegacyResponse(error);
    }

    logger.error("BOOKINGS", "Arrival handler error", error, {
      bookingId,
      route: logContext,
    });

    return NextResponse.json(
      legacyMessageBody("Internal Server Error"),
      { status: 500 },
    );
  }
}
