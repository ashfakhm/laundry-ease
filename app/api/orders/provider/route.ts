import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/api/errors";
import { requireProvider } from "@/lib/api/auth";
import {
  appErrorLegacyResponse,
  legacyErrorResponse,
} from "@/lib/api/legacy-response";

/**
 * GET /api/orders/provider
 * Fetch all orders for the logged-in provider
 */
export async function GET() {
  try {
    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) {
      return legacyErrorResponse("Unauthorized", 401);
    }

    const { db } = await getDb();
    const providerId = new ObjectId(user.id);

    const provider = await db.collection("providers").findOne({ _id: providerId });

    if (!provider) {
      return legacyErrorResponse("Provider not found", 404);
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

    return NextResponse.json(enrichedOrders, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return appErrorLegacyResponse(error);
    }

    logger.error("ORDERS", "Error fetching provider orders", error);
    return legacyErrorResponse("Internal server error", 500);
  }
}
