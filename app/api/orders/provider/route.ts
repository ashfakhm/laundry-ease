import { successResponse } from "@/lib/api/response";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/api/errors";
import { requireProvider } from "@/lib/api/auth";

/**
 * GET /api/orders/provider
 * Fetch all orders for the logged-in provider
 */
export async function GET() {
  try {
    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) {
      return NextResponse.json({
        success: false,
        error: "Unauthorized"
      }, {
        status: 401
      });
    }

    const { db } = await getDb();
    const providerId = new ObjectId(user.id);

    const provider = await db.collection("providers").findOne({ _id: providerId });

    if (!provider) {
      return NextResponse.json({
        success: false,
        error: "Provider not found"
      }, {
        status: 404
      });
    }

    // Fetch all orders for this provider
    const orders = await db
      .collection("orders")
      .find({ provider_id: providerId })
      .sort({ createdAt: -1 })
      .toArray();

    // Fetch seeker details for each order
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        const seeker = await db
          .collection("seekers")
          .findOne(
            { _id: new ObjectId(order.seeker_id) },
            { projection: { name: 1, email: 1, phone: 1 } }
          );

        return {
          ...order,
          seeker: seeker || null,
        };
      })
    );

    return successResponse(enrichedOrders, 200);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({
        success: false,
        error: error.message,

        ...(error.details ? {
          details: error.details
        } : {})
      }, {
        status: error.statusCode || 400
      });
    }

    logger.error("ORDERS", "Error fetching provider orders", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error"
    }, {
      status: 500
    });
  }
}
