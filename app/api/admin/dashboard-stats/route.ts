import { errorResponse, successResponse } from "@/lib/api/response";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { ObjectId } from "mongodb";
import { buildAlertAnalytics } from "@/lib/ops/alerts-analytics";
import { alertAgeMinutes, isAckSlaBreached } from "@/lib/ops/ack-sla";
import { requireAdminWithDbCheck } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/security";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { CRITICAL_ALERT_ACK_SLA_MS, HIGH_ALERT_ACK_SLA_MS, RATE_LIMIT_DEFAULT_WINDOW_MS } from "@/lib/constants";

const ACTIVE_COMPLAINT_STATUSES = ["open", "accepted", "in_review"] as const;

type ActiveComplaintPreview = {
  _id: string;
  title: string | null;
  status: string;
  createdAt: string | null;
  seekerName: string;
  providerName: string;
};

type SystemAlertPreview = {
  _id: string;
  key: string;
  message: string;
  severity: "critical" | "high";
  status: "open" | "resolved";
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  acknowledgedAt: string | null;
  owner: string | null;
  acknowledgedByEmail: string | null;
  ackSlaBreached: boolean;
  ageMinutes: number;
};

function toObjectId(value: unknown): ObjectId | null {
  if (value instanceof ObjectId) return value;
  if (typeof value === "string" && ObjectId.isValid(value)) {
    return new ObjectId(value);
  }
  return null;
}

export async function GET(req: Request) {
  try {
    await enforceRateLimit(req, {
      bucket: "admin:dashboard_stats:get",
      max: 30, // Dashboard stats are extremely heavy
      windowMs: RATE_LIMIT_DEFAULT_WINDOW_MS,
    });
    await requireAdminWithDbCheck();

    const { db } = await getDb();
    const now = new Date();
    const criticalAckSlaCutoff = new Date(
      now.getTime() - CRITICAL_ALERT_ACK_SLA_MS,
    );
    const highAckSlaCutoff = new Date(now.getTime() - HIGH_ALERT_ACK_SLA_MS);

    // 0. Count open operational/integrity alerts by severity
    const [
      criticalSystemAlerts,
      highSystemAlerts,
      unacknowledgedCriticalSystemAlerts,
      unacknowledgedHighSystemAlerts,
      ackSlaBreachedCriticalSystemAlerts,
      ackSlaBreachedHighSystemAlerts,
    ] = await Promise.all([
      db.collection("system_alerts").countDocuments({
        status: "open",
        severity: "critical",
      }),
      db.collection("system_alerts").countDocuments({
        status: "open",
        severity: "high",
      }),
      db.collection("system_alerts").countDocuments({
        status: "open",
        severity: "critical",
        $or: [
          { "ownership.acknowledgedAt": { $exists: false } },
          { "ownership.acknowledgedAt": null },
        ],
      }),
      db.collection("system_alerts").countDocuments({
        status: "open",
        severity: "high",
        $or: [
          { "ownership.acknowledgedAt": { $exists: false } },
          { "ownership.acknowledgedAt": null },
        ],
      }),
      db.collection("system_alerts").countDocuments({
        status: "open",
        severity: "critical",
        firstSeenAt: { $lte: criticalAckSlaCutoff },
        $or: [
          { "ownership.acknowledgedAt": { $exists: false } },
          { "ownership.acknowledgedAt": null },
        ],
      }),
      db.collection("system_alerts").countDocuments({
        status: "open",
        severity: "high",
        firstSeenAt: { $lte: highAckSlaCutoff },
        $or: [
          { "ownership.acknowledgedAt": { $exists: false } },
          { "ownership.acknowledgedAt": null },
        ],
      }),
    ]);
    const analyticsWindowStart = new Date(
      now.getTime() - 8 * 24 * 60 * 60 * 1000,
    );

    const alertAnalyticsRows = await db
      .collection("system_alerts")
      .find(
        {
          severity: { $in: ["critical", "high"] },
          $or: [
            { createdAt: { $gte: analyticsWindowStart } },
            { resolvedAt: { $gte: analyticsWindowStart } },
          ],
        },
        {
          projection: {
            createdAt: 1,
            resolvedAt: 1,
          },
        },
      )
      .toArray();

    const operationalHealth = buildAlertAnalytics(
      alertAnalyticsRows.map((row) => ({
        createdAt: row.createdAt,
        resolvedAt: row.resolvedAt,
      })),
      now,
    );

    const recentSystemAlertRows = await db
      .collection("system_alerts")
      .find(
        {
          status: "open",
          severity: { $in: ["critical", "high"] },
        },
        {
          projection: {
            _id: 1,
            key: 1,
            message: 1,
            severity: 1,
            status: 1,
            firstSeenAt: 1,
            lastSeenAt: 1,
            "ownership.acknowledgedAt": 1,
            "ownership.owner": 1,
            "ownership.acknowledgedByEmail": 1,
          },
        },
      )
      .sort({ firstSeenAt: -1, createdAt: -1 })
      .limit(5)
      .toArray();

    const recentSystemAlerts: SystemAlertPreview[] = recentSystemAlertRows.map(
      (row) => ({
        _id: row._id.toString(),
        key: typeof row.key === "string" ? row.key : "system_alert",
        message:
          typeof row.message === "string" && row.message.trim().length > 0
            ? row.message.trim()
            : "System alert",
        severity: row.severity === "critical" ? "critical" : "high",
        status: row.status === "resolved" ? "resolved" : "open",
        firstSeenAt: row.firstSeenAt
          ? new Date(row.firstSeenAt).toISOString()
          : null,
        lastSeenAt: row.lastSeenAt
          ? new Date(row.lastSeenAt).toISOString()
          : null,
        acknowledgedAt: row.ownership?.acknowledgedAt
          ? new Date(row.ownership.acknowledgedAt).toISOString()
          : null,
        owner:
          typeof row.ownership?.owner === "string" ? row.ownership.owner : null,
        acknowledgedByEmail:
          typeof row.ownership?.acknowledgedByEmail === "string"
            ? row.ownership.acknowledgedByEmail
            : null,
        ackSlaBreached: isAckSlaBreached(
          {
            severity: row.severity === "critical" ? "critical" : "high",
            firstSeenAt: row.firstSeenAt,
            acknowledgedAt: row.ownership?.acknowledgedAt,
          },
          now,
        ),
        ageMinutes: alertAgeMinutes(row.firstSeenAt, now),
      }),
    );

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
              $sum: {
                $ifNull: [
                  "$total_price",
                  {
                    $add: [
                      { $ifNull: ["$subtotal", 0] },
                      { $ifNull: ["$delivery_charge", 0] },
                    ],
                  },
                ],
              },
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
              $sum: {
                $ifNull: [
                  "$total_price",
                  {
                    $add: [
                      { $ifNull: ["$subtotal", 0] },
                      { $ifNull: ["$delivery_charge", 0] },
                    ],
                  },
                ],
              },
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
            .find({ _id: { $in: seekerIds } }, { projection: { name: 1 } })
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
          createdAt: row.createdAt
            ? new Date(row.createdAt).toISOString()
            : null,
          seekerName: seeker?.name || "Seeker",
          providerName: providerDisplay,
        };
      });

    return successResponse({ criticalSystemAlerts,
        highSystemAlerts,
        systemAlertCount: criticalSystemAlerts + highSystemAlerts,
        unacknowledgedCriticalSystemAlerts,
        unacknowledgedHighSystemAlerts,

        unacknowledgedSystemAlertCount:
          unacknowledgedCriticalSystemAlerts + unacknowledgedHighSystemAlerts,

        ackSlaBreachedCriticalSystemAlerts,
        ackSlaBreachedHighSystemAlerts,

        ackSlaBreachedSystemAlertCount:
          ackSlaBreachedCriticalSystemAlerts + ackSlaBreachedHighSystemAlerts,

        operationalHealth,
        recentSystemAlerts,
        openComplaints,
        activeComplaints,
        escrowBalance,
        activeProviders,
        totalProviders,
        providerUtilizationPct,
        totalOrders,
        totalRevenue,
        recentActiveComplaints });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error(
      "ADMIN_DASHBOARD",
      "Error fetching admin dashboard stats",
      error,
    );
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"),
    );
  }
}
