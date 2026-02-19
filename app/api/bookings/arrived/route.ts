import { NextRequest, NextResponse } from "next/server";
import { bookingArrivedSchema } from "@/lib/api/schemas";
import { handleProviderArrival } from "@/lib/bookings/arrive-handler";
import { logger } from "@/lib/logger";

// POST /api/bookings/arrived
export async function POST(req: NextRequest) {
  let bookingId: string | undefined;
  try {
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
    return handleProviderArrival({
      req,
      bookingId,
      coordinates: { lat, lng },
      rateLimitBucket: "bookings:arrived",
      logContext: "arrived_route",
    });
  } catch (error) {
    logger.error("BOOKINGS", "Arrival alias error", error, { bookingId });
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
