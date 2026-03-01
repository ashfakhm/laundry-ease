import { errorResponse, successResponse } from "@/lib/api/response";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { requireAdminWithDbCheck } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/security";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { RATE_LIMIT_DEFAULT_WINDOW_MS } from "@/lib/constants";
import {
  fetchSystemAlertCounts,
  fetchOperationalHealth,
  fetchRecentSystemAlerts,
  fetchComplaintCounts,
  fetchEscrowBalance,
  fetchProviderStats,
  fetchOrderStats,
  fetchRecentActiveComplaints,
} from "@/lib/services/admin-stats";

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

    const [
      alertCounts,
      operationalHealth,
      recentSystemAlerts,
      complaintCounts,
      escrowBalance,
      providerStats,
      orderStats,
      recentActiveComplaints,
    ] = await Promise.all([
      fetchSystemAlertCounts(db, now),
      fetchOperationalHealth(db, now),
      fetchRecentSystemAlerts(db, now),
      fetchComplaintCounts(db),
      fetchEscrowBalance(db),
      fetchProviderStats(db),
      fetchOrderStats(db),
      fetchRecentActiveComplaints(db),
    ]);

    return successResponse({
      ...alertCounts,
      operationalHealth,
      recentSystemAlerts,
      ...complaintCounts,
      escrowBalance,
      ...providerStats,
      ...orderStats,
      recentActiveComplaints,
    });
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
