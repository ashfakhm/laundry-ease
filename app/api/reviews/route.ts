import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { Review, Provider } from "@/lib/db";
import { requireSeeker } from "@/lib/api/auth";

// POST /api/reviews
export async function POST(req: NextRequest) {
  try {
    // Only authenticated seekers can create reviews
    const { user } = await requireSeeker();

    const { order_id, provider_id, rating, comment } = await req.json();

    if (!order_id || !provider_id || !rating) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Validate rating range
    const ratingNum = Number(rating);
    if (ratingNum < 1 || ratingNum > 5 || !Number.isInteger(ratingNum)) {
      return NextResponse.json(
        { error: "Rating must be an integer between 1 and 5" },
        { status: 400 }
      );
    }

    const { db } = await getDb();

    // Verify the order belongs to this seeker
    const order = await db.collection("orders").findOne({
      _id: new ObjectId(order_id),
      seeker_id: new ObjectId(user.id),
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found or doesn't belong to you" },
        { status: 404 }
      );
    }

    // Check duplicate
    const existing = await db
      .collection("reviews")
      .findOne({ order_id: new ObjectId(order_id) });
    if (existing) {
      return NextResponse.json(
        { error: "You have already reviewed this order" },
        { status: 400 }
      );
    }

    // Create Review using authenticated user's ID (not from request)
    const review: Review = {
      order_id: new ObjectId(order_id),
      seeker_id: new ObjectId(user.id),
      provider_id: new ObjectId(provider_id),
      rating: ratingNum,
      comment,
      createdAt: new Date(),
    };

    await db.collection<Review>("reviews").insertOne(review);

    // Update Provider Average Rating
    const reviews = await db
      .collection<Review>("reviews")
      .find({ provider_id: new ObjectId(provider_id) })
      .toArray();
    const totalRating = reviews.reduce((acc, curr) => acc + curr.rating, 0);
    const avgRating = totalRating / reviews.length;

    await db
      .collection<Provider>("providers")
      .updateOne(
        { _id: new ObjectId(provider_id) },
        { $set: { rating: avgRating, reviewCount: reviews.length } }
      );

    return NextResponse.json({ success: true, message: "Review submitted" });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    console.error("Review Error:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
// GET /api/reviews?provider_id=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const provider_id = searchParams.get("provider_id");

    if (!provider_id) {
      return NextResponse.json(
        { error: "Provider ID required" },
        { status: 400 }
      );
    }

    const { db } = await getDb();
    const reviews = await db
      .collection("reviews")
      .aggregate([
        { $match: { provider_id: new ObjectId(provider_id) } },
        {
          $lookup: {
            from: "seekers",
            localField: "seeker_id",
            foreignField: "_id",
            as: "seeker",
          },
        },
        { $unwind: { path: "$seeker", preserveNullAndEmptyArrays: true } },
        // Lookup Order
        {
          $lookup: {
            from: "orders",
            localField: "order_id",
            foreignField: "_id",
            as: "order",
          },
        },
        { $unwind: { path: "$order", preserveNullAndEmptyArrays: true } },

        {
          $project: {
            rating: 1,
            comment: 1,
            createdAt: 1,
            order_id: 1,
            booking_id: "$order.booking_id",
            "seeker.name": 1,
          },
        },
        { $sort: { createdAt: -1 } },
      ])
      .toArray();

    return NextResponse.json(reviews);
  } catch (error: unknown) {
    console.error("Fetch Reviews Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
