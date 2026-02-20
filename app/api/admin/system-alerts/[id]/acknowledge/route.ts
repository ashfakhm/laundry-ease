import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { adminSystemAlertAcknowledgeSchema } from "@/lib/api/schemas";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireAdminWithDbCheck } from "@/lib/api/auth";

type Ownership = {
  acknowledgedAt?: Date;
  acknowledgedById?: string | null;
  acknowledgedByEmail?: string | null;
  owner?: "platform_admin_oncall" | "backend_oncall" | "tech_lead";
  note?: string | null;
};

type SystemAlertDocument = {
  _id: ObjectId;
  status: "open" | "resolved";
  severity?: "critical" | "high" | "medium";
  ownership?: Ownership;
};

// PATCH /api/admin/system-alerts/[id]/acknowledge
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "admin:system-alerts:acknowledge",
      max: 60,
      windowMs: 5 * 60 * 1000,
    });

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, ok: false, message: "Invalid alert id" , error: { code: "ERROR", message: "Invalid alert id"  } }, { status: 400 });
    }

    const session = await requireAdminWithDbCheck();

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const parsed = adminSystemAlertAcknowledgeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid acknowledgement data",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { db } = await getDb();
    const alertId = new ObjectId(id);
    const alert = await db.collection<SystemAlertDocument>("system_alerts").findOne(
      { _id: alertId },
      {
        projection: {
          status: 1,
          severity: 1,
          ownership: 1,
        },
      },
    );

    if (!alert) {
      return NextResponse.json({ success: false, ok: false, message: "Alert not found" , error: { code: "ERROR", message: "Alert not found"  } }, { status: 404 });
    }

    if (alert.status !== "open") {
      return NextResponse.json(
        { error: "Only open alerts can be acknowledged" },
        { status: 409 },
      );
    }

    const now = new Date();
    const owner =
      parsed.data.owner ||
      alert.ownership?.owner ||
      (alert.severity === "critical"
        ? "backend_oncall"
        : "platform_admin_oncall");
    const note = parsed.data.note ?? alert.ownership?.note ?? null;

    await db.collection("system_alerts").updateOne(
      { _id: alertId },
      {
        $set: {
          "ownership.acknowledgedAt": now,
          "ownership.acknowledgedById": session.user.id || null,
          "ownership.acknowledgedByEmail": session.user.email || null,
          "ownership.owner": owner,
          "ownership.note": note,
          updatedAt: now,
        },
      },
    );

    return NextResponse.json({
      success: true,
      alertId: id,
      acknowledgedAt: now.toISOString(),
      owner,
      note,
    });
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

    logger.error("ADMIN_ALERTS", "Failed to acknowledge system alert", error, {
      alertId: id,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
