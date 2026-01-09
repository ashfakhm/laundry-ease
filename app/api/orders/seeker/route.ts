import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { type Filter, ObjectId } from "mongodb";
import { logger } from "@/lib/logger";

/**
 * GET /api/orders/seeker
 * Fetch all orders for the logged-in seeker
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();

    // Get seeker by stable identity.
    // Email can change; session.user.id is stable and should be preferred for lookups.
    const seekerOr: Filter<unknown>[] = [];
    if (session.user.id && ObjectId.isValid(String(session.user.id))) {
      seekerOr.push({ _id: new ObjectId(String(session.user.id)) });
    }
    if (session.user.email) {
      seekerOr.push({ email: session.user.email });
    }

    const seeker = await db.collection("seekers").findOne({ $or: seekerOr });

    if (!seeker) {
      return NextResponse.json({ error: "Seeker not found" }, { status: 404 });
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

    return NextResponse.json(enrichedOrders, { status: 200 });
  } catch (error) {
    logger.error("ORDERS", "Error fetching seeker orders", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
