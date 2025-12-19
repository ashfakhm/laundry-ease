import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

interface Order extends Record<string, unknown> {
  _id: ObjectId;
  seeker_id: string;
  provider_id: string;
  total_price: number;
  delivery_charge: number;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();

    const orders = await db
      .collection("orders")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    // Enrich with seeker and provider data
    const enrichedOrders = await Promise.all(
      (orders as Order[]).map(async (order: Order) => {
        const seeker = await db
          .collection("seekers")
          .findOne(
            { _id: new ObjectId(order.seeker_id) },
            { projection: { name: 1 } }
          );

        const provider = await db
          .collection("providers")
          .findOne(
            { _id: new ObjectId(order.provider_id) },
            { projection: { name: 1, businessName: 1 } }
          );

        return {
          ...order,
          seeker,
          provider,
        };
      })
    );

    return NextResponse.json(enrichedOrders);
  } catch (error) {
    console.error("Error fetching payments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
