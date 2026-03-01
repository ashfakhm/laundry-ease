import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { auditIntegrity } from "@/lib/audit/integrity";
import { STALE_PAYOUT_CUTOFF_MS } from "@/lib/constants";
import { startCronRun, completeCronRun } from "@/lib/cron-tracking";
import { requireCronSecret } from "@/lib/api/cron-auth";
import { syncAlerts } from "@/lib/ops/alert-lifecycle";

// GET /api/cron/audit-integrity
export async function GET(req: NextRequest) {
  try {
    requireCronSecret(req);
  } catch (error) {
    return errorResponse(error);
  }

  const run = await startCronRun("audit-integrity");

  try {
    const now = new Date();
    const stalePayoutCutoff = new Date(now.getTime() - STALE_PAYOUT_CUTOFF_MS);
    const { db } = await getDb();

    const [orders, bookings, complaints] = await Promise.all([
      db
        .collection("orders")
        .find(
          {
            $or: [
              {
                payment_status: "refunded",
                payout_status: { $in: ["processing", "paid"] },
              },
              {
                payment_status: { $in: ["unpaid", "refunded"] },
                payout_id: { $exists: true, $ne: null },
              },
              {
                payment_status: "released",
                escrow_released_at: { $exists: false },
              },
              {
                payment_status: { $in: ["paid", "held", "released"] },
                $or: [
                  { razorpay_payment_id: { $exists: false } },
                  { razorpay_payment_id: null },
                  { razorpay_payment_id: "" },
                ],
              },
              {
                payout_status: "processing",
                $or: [
                  { payout_id: { $exists: false } },
                  { payout_id: null },
                  { payout_id: "" },
                ],
                $and: [
                  {
                    $or: [
                      { payout_lock_at: { $lt: stalePayoutCutoff } },
                      { payout_updated_at: { $lt: stalePayoutCutoff } },
                    ],
                  },
                ],
              },
            ],
          },
          {
            projection: {
              payment_status: 1,
              payout_status: 1,
              payout_id: 1,
              payout_lock_at: 1,
              payout_updated_at: 1,
              escrow_released_at: 1,
              razorpay_payment_id: 1,
            },
          },
        )
        .toArray(),
      db
        .collection("bookings")
        .find(
          {
            $or: [
              {
                bookingFeeStatus: "applied",
                $or: [
                  { payout_id: { $exists: false } },
                  { payout_id: null },
                  { payout_id: "" },
                ],
              },
              {
                bookingFeeStatus: "refunded",
                status: { $nin: ["cancelled", "rejected"] },
              },
            ],
          },
          {
            projection: {
              status: 1,
              bookingFeeStatus: 1,
              payout_id: 1,
            },
          },
        )
        .toArray(),
      db
        .collection("complaints")
        .find(
          {
            $or: [
              {
                status: { $in: ["resolved", "rejected"] },
                $or: [{ resolvedAt: { $exists: false } }, { resolvedAt: null }],
              },
              {
                status: { $in: ["accepted", "in_review"] },
              },
              {
                status: "in_review",
                $or: [
                  { provider_access_granted: { $exists: false } },
                  { provider_access_granted: false },
                  { provider_access_granted: null },
                ],
              },
            ],
          },
          {
            projection: {
              status: 1,
              resolvedAt: 1,
              response_deadline: 1,
              provider_access_granted: 1,
            },
          },
        )
        .toArray(),
    ]);

    const anomalies = auditIntegrity({
      orders,
      bookings,
      complaints,
      now,
    });

    const alertCollection = db.collection("system_alerts");

    const alertInputs = anomalies.map((anomaly) => ({
      key: anomaly.key,
      entityType: anomaly.entityType,
      entityId: anomaly.entityId,
      severity: anomaly.severity,
      message: anomaly.message,
    }));

    const { openedOrUpdated, resolvedCount } = await syncAlerts(
      alertCollection,
      "integrity",
      alertInputs,
      now,
    );

    const severitySummary = anomalies.reduce(
      (acc, anomaly) => {
        acc[anomaly.severity] += 1;
        return acc;
      },
      { critical: 0, high: 0, medium: 0 },
    );

    const result = {
      success: true,
      anomalies: anomalies.length,
      openedOrUpdated,
      resolvedCount,
      severitySummary,
      sample: anomalies.slice(0, 25),
      at: now.toISOString(),
    };

    await completeCronRun(run.insertedId, "success", result);

    logger.info("CRON", "Integrity audit completed", {
      anomalies: anomalies.length,
      openedOrUpdated,
      resolvedCount,
      severitySummary,
    });

    return successResponse({
      ...result,
    });
  } catch (error) {
    await completeCronRun(run.insertedId, "error", undefined, error);
    logger.error("CRON", "Integrity audit failed", error);
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Integrity audit failed"),
    );
  }
}
