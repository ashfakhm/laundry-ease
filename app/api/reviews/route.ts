import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { Review } from "@/types/reviews";
import { Provider } from "@/types/users";
import { requireSeeker } from "@/lib/api/auth";
import { logger } from "@/lib/logger";
import { z } from "zod";

const createReviewSchema = z.object({
  booking_id: z.string().min(1),
  provider_id: z.string().min(1),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
});

// POST /api/reviews — accepts booking_id, looks up order internally
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireSeeker();

    const body = await req.json();
    const parsed = createReviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid review data",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { booking_id, provider_id, rating: ratingNum, comment } = parsed.data;
    const { db } = await getDb();

    // Look up the order by booking_id and seeker_id
    const order = await db.collection("orders").findOne({
      booking_id: new ObjectId(booking_id),
      seeker_id: new ObjectId(user.id),
    });

    if (!order) {
      return NextResponse.json(
        { error: "No completed order found for this booking" },
        { status: 404 },
      );
    }

    // Check duplicate review
    const existing = await db
      .collection("reviews")
      .findOne({ order_id: order._id });
    if (existing) {
      return NextResponse.json(
        { error: "You have already reviewed this order" },
        { status: 400 },
      );
    }

    // Get seeker name for denormalization
    const seeker = await db.collection("seekers").findOne({
      _id: new ObjectId(user.id),
    });

    const review: Review = {
      order_id: order._id,
      seeker_id: new ObjectId(user.id),
      provider_id: new ObjectId(provider_id),
      seeker_name: seeker?.name || user.name || "User",
      rating: ratingNum,
      comment: comment || undefined,
      createdAt: new Date(),
    };

    await db.collection<Review>("reviews").insertOne(review);

    // Update Provider Average Rating atomically
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
        { $set: { rating: avgRating, reviewCount: reviews.length } },
      );

    return NextResponse.json({ success: true, message: "Review submitted" });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    logger.error("REVIEWS", "Error creating review", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
