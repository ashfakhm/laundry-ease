import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { Role } from "@/types/enums";
import { logger } from "@/lib/logger";
import { ObjectId } from "mongodb";

const ACTIVE_COMPLAINT_STATUSES = ["open", "accepted", "in_review"] as const;

type ActiveComplaintPreview = {
  _id: string;
  title: string | null;
  status: string;
  createdAt: string | null;
  seekerName: string;
  providerName: string;
};

function toObjectId(value: unknown): ObjectId | null {
  if (value instanceof ObjectId) return value;
  if (typeof value === "string" && ObjectId.isValid(value)) {
    return new ObjectId(value);
  }
  return null;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== Role.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();

    // 0. Count open operational/integrity alerts by severity
    const [criticalSystemAlerts, highSystemAlerts] = await Promise.all([
      db.collection("system_alerts").countDocuments({
        status: "open",
        severity: "critical",
      }),
      db.collection("system_alerts").countDocuments({
        status: "open",
        severity: "high",
      }),
    ]);

    // 1. Count open complaints
    const openComplaints = await db.collection("complaints").countDocuments({
      status: "open",
    });

    // 1b. Count all active complaints shown in admin queue
    const activeComplaints = await db.collection("complaints").countDocuments({
      status: { $in: [...ACTIVE_COMPLAINT_STATUSES] },
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
    const totalProviders = await db.collection("providers").countDocuments();
    const providerUtilizationPct =
      totalProviders > 0
        ? Number(((activeProviders / totalProviders) * 100).toFixed(1))
        : 0;

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

    // 5. Get latest active complaints preview for admin dashboard queue
    const recentComplaintRows = await db
      .collection("complaints")
      .find(
        { status: { $in: [...ACTIVE_COMPLAINT_STATUSES] } },
        {
          projection: {
            _id: 1,
            title: 1,
            status: 1,
            createdAt: 1,
            seeker_id: 1,
            provider_id: 1,
          },
        },
      )
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    const seekerIds = Array.from(
      new Set(
        recentComplaintRows
          .map((row) => toObjectId(row.seeker_id))
          .filter((id): id is ObjectId => Boolean(id))
          .map((id) => id.toString()),
      ),
    ).map((id) => new ObjectId(id));

    const providerIds = Array.from(
      new Set(
        recentComplaintRows
          .map((row) => toObjectId(row.provider_id))
          .filter((id): id is ObjectId => Boolean(id))
          .map((id) => id.toString()),
      ),
    ).map((id) => new ObjectId(id));

    const [seekers, providers] = await Promise.all([
      seekerIds.length > 0
        ? db
            .collection("seekers")
            .find(
              { _id: { $in: seekerIds } },
              { projection: { name: 1 } },
            )
            .toArray()
        : Promise.resolve([]),
      providerIds.length > 0
        ? db
            .collection("providers")
            .find(
              { _id: { $in: providerIds } },
              { projection: { name: 1, businessName: 1 } },
            )
            .toArray()
        : Promise.resolve([]),
    ]);

    const seekerMap = new Map(
      seekers.map((seeker) => [seeker._id.toString(), seeker]),
    );
    const providerMap = new Map(
      providers.map((provider) => [provider._id.toString(), provider]),
    );

    const recentActiveComplaints: ActiveComplaintPreview[] =
      recentComplaintRows.map((row) => {
        const seekerId = toObjectId(row.seeker_id)?.toString();
        const providerId = toObjectId(row.provider_id)?.toString();
        const seeker = seekerId ? seekerMap.get(seekerId) : null;
        const provider = providerId ? providerMap.get(providerId) : null;
        const providerDisplay =
          provider?.businessName || provider?.name || "Provider";

        return {
          _id: row._id.toString(),
          title:
            typeof row.title === "string" && row.title.trim().length > 0
              ? row.title.trim()
              : null,
          status: row.status || "open",
          createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
          seekerName: seeker?.name || "Seeker",
          providerName: providerDisplay,
        };
      });

    return NextResponse.json({
      criticalSystemAlerts,
      highSystemAlerts,
      systemAlertCount: criticalSystemAlerts + highSystemAlerts,
      openComplaints,
      activeComplaints,
      escrowBalance,
      activeProviders,
      totalProviders,
      providerUtilizationPct,
      totalOrders,
      totalRevenue,
      recentActiveComplaints,
    });
  } catch (error) {
    logger.error("ADMIN_DASHBOARD", "Error fetching admin dashboard stats", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
