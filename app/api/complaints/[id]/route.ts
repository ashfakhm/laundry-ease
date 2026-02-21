import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { canAccessComplaintConversation } from "@/lib/complaints/access";
import { derivePayoutAmounts } from "@/lib/payouts/amounts";
import { AppError } from "@/lib/api/errors";
import { Role } from "@/types/enums";
import { requireAuth } from "@/lib/api/auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const { user } = await requireAuth();
    if (!ObjectId.isValid(user.id) || !user.role) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          message: "Unauthorized",
          error: { code: "ERROR", message: "Unauthorized" },
        },
        { status: 401 },
      );
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          message: "Invalid complaint ID",
          error: { code: "ERROR", message: "Invalid complaint ID" },
        },
        { status: 400 },
      );
    }

    const { db } = await getDb();
    const complaintId = new ObjectId(id);

    const complaint = await db
      .collection("complaints")
      .findOne({ _id: complaintId });
    if (!complaint) {
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

    const access = canAccessComplaintConversation({
      actorId: user.id,
      actorRole: user.role,
      complaint: {
        seekerId: complaint.seeker_id.toString(),
        providerId: complaint.provider_id.toString(),
        providerAccessGranted: complaint.provider_access_granted,
        status: complaint.status,
      },
    });

    if (!access.allowed) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          message: "Access Denied",
          error: { code: "ERROR", message: "Access Denied" },
        },
        { status: 403 },
      );
    }

    const [seeker, provider] = await Promise.all([
      db
        .collection("seekers")
        .findOne({ _id: complaint.seeker_id }, { projection: { name: 1 } }),
      db
        .collection("providers")
        .findOne(
          { _id: complaint.provider_id },
          { projection: { name: 1, businessName: 1 } },
        ),
    ]);

    let settlementWindow: {
      total_amount: number;
      distributable_amount: number;
      platform_commission: number;
      default_provider_payout: number;
    } | null = null;

    if (user.role === Role.ADMIN) {
      const order = await db.collection("orders").findOne(
        { _id: complaint.order_id },
        {
          projection: {
            total_price: 1,
            provider_payout_amount: 1,
            platform_commission: 1,
          },
        },
      );

      if (order) {
        const payoutAmounts = derivePayoutAmounts({
          total_price: Number(order.total_price || 0),
          provider_payout_amount: Number(order.provider_payout_amount ?? NaN),
          platform_commission: Number(order.platform_commission ?? NaN),
        });

        settlementWindow = {
          total_amount: Number(order.total_price || 0),
          distributable_amount: payoutAmounts.providerPayoutAmountPaise / 100,
          platform_commission: payoutAmounts.platformCommissionPaise / 100,
          default_provider_payout:
            payoutAmounts.providerPayoutAmountPaise / 100,
        };
      }
    }

    return NextResponse.json({
      ...complaint,
      seeker: seeker
        ? {
            name: seeker.name || "Seeker",
          }
        : null,
      provider: provider
        ? {
            name: provider.name || "Provider",
            businessName: provider.businessName || null,
          }
        : null,
      settlement_window: settlementWindow,
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

    logger.error("COMPLAINTS", "Error fetching complaint", error, {
      complaintId: id,
    });
    return NextResponse.json(
      {
        success: false,
        ok: false,
        message: "Internal Error",
        error: { code: "ERROR", message: "Internal Error" },
      },
      { status: 500 },
    );
  }
}
