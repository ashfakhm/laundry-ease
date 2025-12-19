import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/**
 * GET /api/orders/provider
 * Fetch all orders for the logged-in provider
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();

    // Get provider by email
    const provider = await db
      .collection("providers")
      .findOne({ email: session.user.email });

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    // Fetch all orders for this provider
    const orders = await db
      .collection("orders")
      .find({ provider_id: provider._id })
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
    console.error("Error fetching provider orders:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
