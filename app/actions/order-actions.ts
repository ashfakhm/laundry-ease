"use server";

import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { requireProvider } from "@/lib/api/auth";

export async function getProviderOrders() {
  let providerId: ObjectId;
  try {
    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id))
      return { success: false, error: "Unauthorized" };
    providerId = new ObjectId(user.id);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const { db } = await getDb();

  // Find provider to get the ID
  const provider = await db
    .collection("providers")
    .findOne({ _id: providerId });

  if (!provider) {
    return { success: false, error: "Provider not found" };
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
          booking_id: { $toString: "$booking_id" },
          items: 1,
          total_price: 1,
          delivery_charge: 1,
          payment_status: 1,
          process_status: 1,
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

  return { success: true, data: orders };
}
