import { successResponse } from "@/lib/api/response";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/api/errors";
import { requireSeeker } from "@/lib/api/auth";

/**
 * GET /api/orders/seeker
 * Fetch all orders for the logged-in seeker
 */
export async function GET() {
  try {
    const { user } = await requireSeeker();
    if (!ObjectId.isValid(user.id)) {
      return NextResponse.json({
        success: false,
        error: "Unauthorized"
      }, {
        status: 401
      });
    }

    const { db } = await getDb();
    const seekerId = new ObjectId(user.id);
    const seeker = await db.collection("seekers").findOne({ _id: seekerId });

    if (!seeker) {
      return NextResponse.json({
        success: false,
        error: "Seeker not found"
      }, {
        status: 404
      });
    }

    // Fetch all orders for this seeker
    const orders = await db
      .collection("orders")
      .find({ seeker_id: seeker._id })
      .sort({ createdAt: -1 })
      .toArray();

    // Fetch provider details for each order
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        const provider = await db.collection("providers").findOne(
          { _id: new ObjectId(order.provider_id) },
          {
            projection: {
              name: 1,
              businessName: 1,
              phone: 1,
              email: 1,
              profilePicture: 1,
              bannerImage: 1,
            },
          }
        );

        return {
          ...order,
          provider: provider || null,
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

    logger.error("ORDERS", "Error fetching seeker orders", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error"
    }, {
      status: 500
    });
  }
}
