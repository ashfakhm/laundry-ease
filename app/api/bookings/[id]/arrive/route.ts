import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireProvider } from "@/lib/api/auth";
import { markProviderArrival } from "@/lib/bookings/mark-arrived";

// POST: Provider marks themselves as arrived at pickup location
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "bookings:arrive",
      max: 30,
      windowMs: 5 * 60 * 1000,
    });

    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const lat =
      typeof body?.lat === "number" ? body.lat : Number.NaN;
    const lng =
      typeof body?.lng === "number" ? body.lng : Number.NaN;
    const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
    }
    const bookingId = new ObjectId(id);
    const result = await markProviderArrival({
      bookingId,
      providerId: new ObjectId(user.id),
      coordinates: hasCoordinates ? { lat, lng } : null,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.statusCode },
      );
    }

    logger.error("BOOKINGS", "Mark arrived error", error, { bookingId: id });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
