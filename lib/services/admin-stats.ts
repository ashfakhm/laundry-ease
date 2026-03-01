import { Db, ObjectId } from "mongodb";
import { buildAlertAnalytics } from "@/lib/ops/alerts-analytics";
import { alertAgeMinutes, isAckSlaBreached } from "@/lib/ops/ack-sla";
import {
  ALERT_ANALYTICS_WINDOW_MS,
  CRITICAL_ALERT_ACK_SLA_MS,
  HIGH_ALERT_ACK_SLA_MS,
} from "@/lib/constants";

const ACTIVE_COMPLAINT_STATUSES = ["open", "accepted", "in_review"] as const;

export type ActiveComplaintPreview = {
  _id: string;
  title: string | null;
  status: string;
  createdAt: string | null;
  seekerName: string;
  providerName: string;
};

export type SystemAlertPreview = {
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

/** Count open system alerts grouped by severity + acknowledgement state. */
export async function fetchSystemAlertCounts(db: Db, now: Date) {
  const criticalAckSlaCutoff = new Date(
    now.getTime() - CRITICAL_ALERT_ACK_SLA_MS,
  );
  const highAckSlaCutoff = new Date(now.getTime() - HIGH_ALERT_ACK_SLA_MS);

  const unacknowledgedFilter = {
    $or: [
      { "ownership.acknowledgedAt": { $exists: false } },
      { "ownership.acknowledgedAt": null },
    ],
  };

  const [
    criticalSystemAlerts,
    highSystemAlerts,
    unacknowledgedCriticalSystemAlerts,
    unacknowledgedHighSystemAlerts,
    ackSlaBreachedCriticalSystemAlerts,
    ackSlaBreachedHighSystemAlerts,
  ] = await Promise.all([
    db
      .collection("system_alerts")
      .countDocuments({ status: "open", severity: "critical" }),
    db
      .collection("system_alerts")
      .countDocuments({ status: "open", severity: "high" }),
    db
      .collection("system_alerts")
      .countDocuments({ status: "open", severity: "critical", ...unacknowledgedFilter }),
    db
      .collection("system_alerts")
      .countDocuments({ status: "open", severity: "high", ...unacknowledgedFilter }),
    db.collection("system_alerts").countDocuments({
      status: "open",
      severity: "critical",
      firstSeenAt: { $lte: criticalAckSlaCutoff },
      ...unacknowledgedFilter,
    }),
    db.collection("system_alerts").countDocuments({
      status: "open",
      severity: "high",
      firstSeenAt: { $lte: highAckSlaCutoff },
      ...unacknowledgedFilter,
    }),
  ]);

  return {
    criticalSystemAlerts,
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
  };
}

/** Build operational health analytics from recent alerts. */
export async function fetchOperationalHealth(db: Db, now: Date) {
  const analyticsWindowStart = new Date(
    now.getTime() - ALERT_ANALYTICS_WINDOW_MS,
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
      { projection: { createdAt: 1, resolvedAt: 1 } },
    )
    .toArray();

  return buildAlertAnalytics(
    alertAnalyticsRows.map((row) => ({
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
    })),
    now,
  );
}

/** Fetch the 5 most recent open critical/high system alerts with SLA info. */
export async function fetchRecentSystemAlerts(
  db: Db,
  now: Date,
): Promise<SystemAlertPreview[]> {
  const rows = await db
    .collection("system_alerts")
    .find(
      { status: "open", severity: { $in: ["critical", "high"] } },
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

  return rows.map((row) => ({
    _id: row._id.toString(),
    key: typeof row.key === "string" ? row.key : "system_alert",
    message:
      typeof row.message === "string" && row.message.trim().length > 0
        ? row.message.trim()
        : "System alert",
    severity: row.severity === "critical" ? "critical" : ("high" as const),
    status: row.status === "resolved" ? "resolved" : ("open" as const),
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
  }));
}

/** Count open and active complaints. */
export async function fetchComplaintCounts(db: Db) {
  const [openComplaints, activeComplaints] = await Promise.all([
    db.collection("complaints").countDocuments({ status: "open" }),
    db
      .collection("complaints")
      .countDocuments({ status: { $in: [...ACTIVE_COMPLAINT_STATUSES] } }),
  ]);

  return { openComplaints, activeComplaints };
}

/** Calculate total escrow balance (held payments). */
export async function fetchEscrowBalance(db: Db): Promise<number> {
  const escrowStats = await db
    .collection("orders")
    .aggregate([
      { $match: { payment_status: "held" } },
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

  return escrowStats[0]?.totalEscrow || 0;
}

/** Active providers (had orders in last 7 days) and utilization percentage. */
export async function fetchProviderStats(db: Db) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [activeProviderIds, totalProviders] = await Promise.all([
    db.collection("orders").distinct("provider_id", {
      createdAt: { $gte: sevenDaysAgo },
    }),
    db.collection("providers").countDocuments(),
  ]);

  const activeProviders = activeProviderIds.length;
  const providerUtilizationPct =
    totalProviders > 0
      ? Number(((activeProviders / totalProviders) * 100).toFixed(1))
      : 0;

  return { activeProviders, totalProviders, providerUtilizationPct };
}

/** Total orders + total revenue from paid/held/released orders. */
export async function fetchOrderStats(db: Db) {
  const [totalOrders, revenueStats] = await Promise.all([
    db.collection("orders").countDocuments(),
    db
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
      .toArray(),
  ]);

  return { totalOrders, totalRevenue: revenueStats[0]?.totalRevenue || 0 };
}

/** 5 most recent active complaints with joined seeker/provider names. */
export async function fetchRecentActiveComplaints(
  db: Db,
): Promise<ActiveComplaintPreview[]> {
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

  return recentComplaintRows.map((row) => {
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
}
