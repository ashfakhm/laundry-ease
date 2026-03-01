import { NextRequest } from "next/server";
import { RATE_LIMIT_STRICT_WINDOW_MS } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { adminComplaintStatusSchema } from "@/lib/api/schemas";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireAdminWithDbCheck } from "@/lib/api/auth";

/**
 * PATCH /api/admin/complaints/:id
 * Update complaint status
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "admin:complaints:update-status",
      max: 40,
      windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
    });

    if (!ObjectId.isValid(id)) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid complaint id"));
    }

    await requireAdminWithDbCheck();

    const body = await req.json();
    const parsed = adminComplaintStatusSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid status data"));
    }

    const { status } = parsed.data;
    const { db } = await getDb();

    const result = await db
      .collection("complaints")
      .updateOne({ _id: new ObjectId(id) }, { $set: { status } });

    if (result.matchedCount === 0) {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Complaint not found"));
    }

    return successResponse({ ok: true });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("ADMIN_COMPLAINTS", "Error updating complaint", error, {
      complaintId: id,
    });
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"));
  }
}
