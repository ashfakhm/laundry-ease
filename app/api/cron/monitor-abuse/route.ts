import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { SeekerDetails } from "@/types/bookings";

// GET /api/cron/monitor-abuse
export async function GET() {
    try {
        const { db } = await getDb();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Find users with excessive cancellations (>3 in 30 days)
        const cancelledBookings = await db.collection("bookings").aggregate([
            { $match: { 
                status: "cancelled", 
                createdAt: { $gte: thirtyDaysAgo } 
            }},
            { $group: { _id: "$seeker_id", count: { $sum: 1 } } },
            { $match: { count: { $gt: 3 } } }
        ]).toArray();

        // Flag Seeker Users
        for (const item of cancelledBookings) {
             // Assuming SeekerDetails is in 'users' collection or similar, or 'seekers'
             // Based on db.ts Seeker collection is 'seekers'
             await db.collection("seekers").updateOne(
                 { _id: item._id },
                 { $set: { isFlagged: true, flagReason: "Excessive Cancellations" } }
             );
        }
        
        // Can add similar logic for Providers or Disputes

        return NextResponse.json({ 
            success: true, 
            flaggedCount: cancelledBookings.length,
            flaggedUsers: cancelledBookings.map(b => b._id)
        });

    } catch (error: any) {
        console.error("Abuse Monitor Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
