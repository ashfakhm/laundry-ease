import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { Role } from "@/types/enums";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== Role.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();

    // 1. Count open complaints
    const openComplaints = await db.collection("complaints").countDocuments({
      status: "open",
    });

    // 2. Calculate total escrow balance (held payments)
    const escrowStats = await db
      .collection("orders")
      .aggregate([
        {
          $match: {
            payment_status: "held",
          },
        },
        {
          $group: {
            _id: null,
            totalEscrow: {
              $sum: { $add: ["$total_price", "$delivery_charge"] },
            },
          },
        },
      ])
      .toArray();

    const escrowBalance = escrowStats[0]?.totalEscrow || 0;

    // 3. Count active providers (providers with orders in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeProviderIds = await db
      .collection("orders")
      .distinct("provider_id", {
        createdAt: { $gte: sevenDaysAgo },
      });

    const activeProviders = activeProviderIds.length;

    // 4. Additional stats for admin overview
    const totalOrders = await db.collection("orders").countDocuments();

    const revenueStats = await db
      .collection("orders")
      .aggregate([
        {
          $match: {
            payment_status: { $in: ["paid", "released", "held"] },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: { $add: ["$total_price", "$delivery_charge"] },
            },
          },
        },
      ])
      .toArray();

    const totalRevenue = revenueStats[0]?.totalRevenue || 0;

    return NextResponse.json({
      openComplaints,
      escrowBalance,
      activeProviders,
      totalOrders,
      totalRevenue,
    });
  } catch (error) {
    logger.error("ADMIN_DASHBOARD", "Error fetching admin dashboard stats", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
