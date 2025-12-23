import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { Booking } from "@/types/bookings";
import { getDistance } from "geolib";

// POST /api/bookings/arrived
export async function POST(req: NextRequest) {
    try {
        const { bookingId, lat, lng } = await req.json();

        if (!bookingId || !lat || !lng) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const { db } = await getDb();
        const booking = await db.collection<Booking>("bookings").findOne({ _id: new ObjectId(bookingId) });

        if (!booking) {
            return NextResponse.json({ error: "Booking not found" }, { status: 404 });
        }

        if (!booking.seeker_coordinates) {
             // Fallback: If seeker has no coordinates, we might auto-allow or require manual check.
             // For Strict version, we fail. For MVP, we allow but log.
             // Let's allow for now if coords are missing.
             await markArrived(db, bookingId);
             return NextResponse.json({ success: true, message: "Marked arrived (No seeker coords)" });
        }

        const distance = getDistance(
            { latitude: lat, longitude: lng },
            { latitude: booking.seeker_coordinates.lat, longitude: booking.seeker_coordinates.lng }
        );

        if (distance > 200) { // 200 meters allowed radius
             return NextResponse.json({ 
                 error: "Too far from location", 
                 distance, 
                 allowed: 200 
             }, { status: 400 });
        }

        await markArrived(db, bookingId);

        return NextResponse.json({ success: true, message: "Marked arrived successfully" });

    } catch (error: any) {
        console.error("Arrival Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

async function markArrived(db: any, bookingId: string) {
     await db.collection("bookings").updateOne(
        { _id: new ObjectId(bookingId) },
        { $set: { arrivedAt: new Date(), status: "pickup_proposed" } } // Or typical next status
    );
}
