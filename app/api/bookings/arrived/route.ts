import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { Booking } from "@/types/bookings";
import { calculateDistance } from "@/lib/distance";
import { logger } from "@/lib/logger";
import { bookingArrivedSchema } from "@/lib/api/schemas";

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
        { status: 400 }
      );
    }

    const parsedData = parsed.data;
    bookingId = parsedData.bookingId;
    const { lat, lng } = parsedData;

    const { db } = await getDb();
    const booking = await db
      .collection<Booking>("bookings")
      .findOne({ _id: new ObjectId(bookingId) });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (!booking.seeker_coordinates) {
      // Fallback: If seeker has no coordinates, we might auto-allow or require manual check.
      // For Strict version, we fail. For MVP, we allow but log.
      // Let's allow for now if coords are missing.
      await markArrived(db, bookingId);
      return NextResponse.json({
        success: true,
        message: "Marked arrived (No seeker coords)",
      });
    }

    // Calculate distance in km, then convert to meters for comparison
    const distanceKm = calculateDistance(
      { lat, lng },
      booking.seeker_coordinates
    );
    const distanceMeters = distanceKm * 1000;

    if (distanceMeters > 200) {
      // 200 meters allowed radius
      return NextResponse.json(
        {
          error: "Too far from location",
          distanceMeters: Math.round(distanceMeters),
          allowedMeters: 200,
        },
        { status: 400 }
      );
    }

    await markArrived(db, bookingId);

    return NextResponse.json({
      success: true,
      message: "Marked arrived successfully",
    });
  } catch (error: any) {
    logger.error("BOOKINGS", "Arrival error", error, { bookingId });
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

async function markArrived(db: any, bookingId: string) {
  await db.collection("bookings").updateOne(
    { _id: new ObjectId(bookingId) },
    { $set: { arrivedAt: new Date(), status: "pickup_proposed" } } // Or typical next status
  );
}
