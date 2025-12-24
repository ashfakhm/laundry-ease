import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "provider") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();
    const providerId = new ObjectId(session.user.id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Calculate Total Revenue (only paid/released orders)
    const revenueStats = await db.collection("orders").aggregate([
      {
        $match: {
          provider_id: providerId,
          payment_status: { $in: ["paid", "released", "held"] }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $add: ["$total_price", "$delivery_charge"] } }
        }
      }
    ]).toArray();
    const totalRevenue = revenueStats[0]?.totalRevenue || 0;

    // 2. Count Deliveries Due (Ready or Out for Delivery)
    const deliveriesDue = await db.collection("orders").countDocuments({
      provider_id: providerId,
      process_status: { $in: ["ready", "out_for_delivery"] }
    });

    // 3. Count Pickups Today (Bookings that are confirmed/pending but not yet orders?? 
    // OR Orders that are in 'processing' stage or earlier?
    // Let's count "Active Bookings" that are not yet "Delivered" or "Cancelled" as a proxy for workload if specific dates aren't strictly parsed.
    // Better: Count `bookings` created today OR `bookings` with matching pickup slot if we parse it.
    // For specific "Pickups Today", strict parsing depends on slot format e.g. "Fri, 25 Dec - 10:00 AM".
    // Let's proxy it to: New Bookings (Pending) + Orders in "placed/confirmed" state (awaiting pickup/processing).
    const pendingPickups = await db.collection("bookings").countDocuments({
      provider_id: providerId,
      status: { $in: ["pending", "confirmed", "accepted"] }
    });
    
    // We can also count "Processing" orders separately if needed
    const processingOrders = await db.collection("orders").countDocuments({
       provider_id: providerId,
       process_status: { $in: ["washing", "ironing", "processing", "dry_cleaning"] }
    });

    return NextResponse.json({
      revenue: totalRevenue,
      deliveriesDue: deliveriesDue,
      pendingPickups: pendingPickups, // Representing "Actionable Inbound"
      activeProcessing: processingOrders
    });

  } catch (error) {
    console.error("Error fetching provider dashboard stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
