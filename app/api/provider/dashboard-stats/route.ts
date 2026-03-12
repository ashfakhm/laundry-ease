import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { requireProvider } from "@/lib/api/auth";
import { errorResponse, successResponse } from "@/lib/api/response";

export async function GET() {
  try {
    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );
    }

    const { db } = await getDb();
    const providerId = new ObjectId(user.id);

    // 1. Calculate Total Revenue (only paid/released orders)
    const revenueStats = await db
      .collection("orders")
      .aggregate([
        {
          $match: {
            provider_id: providerId,
            payment_status: { $in: ["paid", "released", "held"] },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$total_price" },
          },
        },
      ])
      .toArray();
    const totalRevenue = revenueStats[0]?.totalRevenue || 0;

    // 2. Count Deliveries Due (Ready or Out for Delivery)
    const deliveriesDue = await db.collection("orders").countDocuments({
      provider_id: providerId,
      process_status: { $in: ["ready", "out_for_delivery"] },
    });

    const pendingPickups = await db.collection("bookings").countDocuments({
      provider_id: providerId,
      status: {
        $in: ["requested", "accepted", "pickup_proposed", "confirmed"],
      },
    });

    // We can also count "Processing" orders separately if needed
    const processingOrders = await db.collection("orders").countDocuments({
      provider_id: providerId,
      process_status: { $in: ["washing", "ironing", "processing"] },
    });

    return successResponse({
      revenue: totalRevenue,
      deliveriesDue: deliveriesDue,
      pendingPickups: pendingPickups, // Representing "Actionable Inbound"
      activeProcessing: processingOrders,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("PROVIDER", "Error fetching provider dashboard stats", error);
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"),
    );
  }
}
