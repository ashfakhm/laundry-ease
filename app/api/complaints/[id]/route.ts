import { successResponse, errorResponse } from "@/lib/api/response";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { canAccessComplaintConversation } from "@/lib/complaints/access";
import { derivePayoutAmounts } from "@/lib/payouts/amounts";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { Role } from "@/types/enums";
import { requireAuth } from "@/lib/api/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const { user } = await requireAuth();
    if (!ObjectId.isValid(user.id) || !user.role) {
      return errorResponse(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );
    }

    if (!ObjectId.isValid(id)) {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid complaint ID"),
      );
    }

    const { db } = await getDb();
    const complaintId = new ObjectId(id);

    const complaint = await db
      .collection("complaints")
      .findOne({ _id: complaintId });
    if (!complaint) {
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "Complaint not found"),
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
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "Complaint not found"),
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

    const order = await db.collection("orders").findOne(
      { _id: complaint.order_id },
      {
        projection: {
          total_price: 1,
          provider_payout_amount: 1,
          platform_commission: 1,
          delivery_charge: 1,
          deadline: 1,
          otp_confirmed_at: 1,
          escrow_started_at: 1,
        },
      },
    );

    let settlementWindow: {
      total_amount: number;
      distributable_amount: number;
      platform_commission: number;
      delivery_charge: number;
      default_provider_payout: number;
    } | null = null;

    if (user.role === Role.ADMIN && order) {
      const payoutAmounts = derivePayoutAmounts({
        total_price: Number(order.total_price || 0),
        provider_payout_amount: Number(order.provider_payout_amount ?? NaN),
        platform_commission: Number(order.platform_commission ?? NaN),
      });

      settlementWindow = {
        total_amount: Number(order.total_price || 0),
        distributable_amount: payoutAmounts.providerPayoutAmountPaise / 100,
        platform_commission: payoutAmounts.platformCommissionPaise / 100,
        delivery_charge: Number(order.delivery_charge || 0),
        default_provider_payout: payoutAmounts.providerPayoutAmountPaise / 100,
      };
    }

    const rawDeliveredAt = order?.otp_confirmed_at ?? order?.escrow_started_at;
    const deliveredAt =
      rawDeliveredAt instanceof Date ? rawDeliveredAt.toISOString() : null;
    const orderDeadline =
      order?.deadline instanceof Date ? order.deadline.toISOString() : null;

    return successResponse({
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
      order_deadline: orderDeadline,
      delivered_at: deliveredAt,
      settlement_window: settlementWindow,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("COMPLAINTS", "Error fetching complaint", error, {
      complaintId: id,
    });
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal Error"),
    );
  }
}
