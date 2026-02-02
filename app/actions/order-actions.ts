"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function getProviderOrders() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || (session.user as any).role !== "provider") {
    throw new Error("Unauthorized");
  }

  const { db } = await getDb();

  // Find provider to get the ID
  const provider = await db
    .collection("providers")
    .findOne({ email: session.user.email });

  if (!provider) {
    throw new Error("Provider not found");
  }

  // Fetch orders for this provider from the orders collection
  // Orders are created when seeker approves the invoice and pays
  const orders = await db
    .collection("orders")
    .aggregate([
      {
        $match: {
          provider_id: provider._id,
        },
      },
      {
        $lookup: {
          from: "seekers",
          localField: "seeker_id",
          foreignField: "_id",
          as: "seeker",
        },
      },
      {
        $unwind: {
          path: "$seeker",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: { $toString: "$_id" },
          items: 1,
          total_price: 1,
          delivery_charge: 1,
          payment_status: 1,
          status: 1,
          createdAt: { $toString: "$createdAt" },
          otp_confirmed_at: {
            $cond: {
              if: "$otp_confirmed_at",
              then: { $toString: "$otp_confirmed_at" },
              else: null,
            },
          },
          seeker: {
            name: "$seeker.name",
            email: "$seeker.email",
            phone: "$seeker.phone",
          },
        },
      },
      { $sort: { createdAt: -1 } },
    ])
    .toArray();

  return orders;
}
