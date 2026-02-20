import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { adminComplaintStatusSchema } from "@/lib/api/schemas";
import { AppError } from "@/lib/api/errors";
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
      windowMs: 5 * 60 * 1000,
    });

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          message: "Invalid complaint id",
          error: { code: "ERROR", message: "Invalid complaint id" },
        },
        { status: 400 },
      );
    }

    await requireAdminWithDbCheck();

    const body = await req.json();
    const parsed = adminComplaintStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          message: "Invalid status data",
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid status data",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      );
    }

    const { status } = parsed.data;
    const { db } = await getDb();

    const result = await db
      .collection("complaints")
      .updateOne({ _id: new ObjectId(id) }, { $set: { status } });

    if (result.matchedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          message: "Complaint not found",
          error: { code: "ERROR", message: "Complaint not found" },
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.statusCode },
      );
    }

    logger.error("ADMIN_COMPLAINTS", "Error updating complaint", error, {
      complaintId: id,
    });
    return NextResponse.json(
      {
        success: false,
        ok: false,
        message: "Internal server error",
        error: { code: "ERROR", message: "Internal server error" },
      },
      { status: 500 },
    );
  }
}
