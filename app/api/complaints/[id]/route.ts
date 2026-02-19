import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { getUserByEmail } from "@/lib/db/index";
import { logger } from "@/lib/logger";
import { canAccessComplaintConversation } from "@/lib/complaints/access";
import { derivePayoutAmounts } from "@/lib/payouts/amounts";
import { AppError } from "@/lib/api/errors";
import { Role } from "@/types/enums";
import { requireAuth } from "@/lib/api/auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await requireAuth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid complaint ID" }, { status: 400 });
    }

    const dbUser = await getUserByEmail(session.user.email);
    if (!dbUser?._id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();
    const complaintId = new ObjectId(id);

    const complaint = await db
      .collection("complaints")
      .findOne({ _id: complaintId });
    if (!complaint) {
      return NextResponse.json(
        { error: "Complaint not found" },
        { status: 404 }
      );
    }

    const access = canAccessComplaintConversation({
      actorId: dbUser._id.toString(),
      actorRole: dbUser.role || "seeker",
      complaint: {
        seekerId: complaint.seeker_id.toString(),
        providerId: complaint.provider_id.toString(),
        providerAccessGranted: complaint.provider_access_granted,
        status: complaint.status,
      },
    });

    if (!access.allowed) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    const [seeker, provider] = await Promise.all([
      db.collection("seekers").findOne(
        { _id: complaint.seeker_id },
        { projection: { name: 1 } },
      ),
      db.collection("providers").findOne(
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

    if (dbUser.role === Role.ADMIN) {
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
          distributable_amount: payoutAmounts.providerPayoutAmount,
          platform_commission: payoutAmounts.platformCommission,
          default_provider_payout: payoutAmounts.providerPayoutAmount,
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
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
