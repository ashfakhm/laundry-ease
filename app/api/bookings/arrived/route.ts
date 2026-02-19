import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { bookingArrivedSchema } from "@/lib/api/schemas";
import { AppError } from "@/lib/api/errors";
import { requireProvider } from "@/lib/api/auth";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { markProviderArrival } from "@/lib/bookings/mark-arrived";

// POST /api/bookings/arrived
export async function POST(req: NextRequest) {
  let bookingId: string | undefined;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "bookings:arrived",
      max: 30,
      windowMs: 5 * 60 * 1000,
    });

    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = bookingArrivedSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid arrival data",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const parsedData = parsed.data;
    bookingId = parsedData.bookingId;
    const { lat, lng } = parsedData;
    if (!ObjectId.isValid(bookingId)) {
      return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
    }
    const bookingObjectId = new ObjectId(bookingId);

    const result = await markProviderArrival({
      bookingId: bookingObjectId,
      providerId: new ObjectId(user.id),
      coordinates: { lat, lng },
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

    logger.error("BOOKINGS", "Arrival error", error, { bookingId });
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
