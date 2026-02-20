import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { Review } from "@/types/reviews";
import { Provider } from "@/types/users";
import { requireSeeker } from "@/lib/api/auth";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { successResponse, errorResponse } from "@/lib/api/response";
import { AppError, ErrorCode } from "@/lib/api/errors";

const createReviewSchema = z.object({
  booking_id: z.string().min(1),
  provider_id: z.string().min(1).optional(),
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
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "Invalid review data",
        parsed.error.flatten().fieldErrors,
      );
    }

    const { booking_id, provider_id, rating: ratingNum, comment } = parsed.data;
    if (!ObjectId.isValid(booking_id)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid booking ID");
    }
    if (!ObjectId.isValid(user.id)) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized");
    }
    const { db } = await getDb();

    // Look up the order by booking_id and seeker_id
    const order = await db.collection("orders").findOne({
      booking_id: new ObjectId(booking_id),
      seeker_id: new ObjectId(user.id),
    });

    if (!order) {
      throw new AppError(
        ErrorCode.ORDER_NOT_FOUND,
        404,
        "No completed order found for this booking",
      );
    }

    const canonicalProviderId =
      order.provider_id instanceof ObjectId
        ? order.provider_id
        : ObjectId.isValid(String(order.provider_id))
          ? new ObjectId(String(order.provider_id))
          : null;

    if (!canonicalProviderId) {
      logger.error("REVIEWS", "Order has invalid provider id", undefined, {
        bookingId: booking_id,
        orderId: String(order._id),
      });
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        500,
        "Order provider data is invalid",
      );
    }

    if (provider_id && provider_id !== canonicalProviderId.toString()) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "Provider mismatch for this booking",
      );
    }

    // Check duplicate review
    const existing = await db
      .collection("reviews")
      .findOne({ order_id: order._id });
    if (existing) {
      throw new AppError(
        ErrorCode.DUPLICATE_RESOURCE,
        400,
        "You have already reviewed this order",
      );
    }

    // Get seeker name for denormalization
    const seeker = await db.collection("seekers").findOne({
      _id: new ObjectId(user.id),
    });

    const review: Review = {
      order_id: order._id,
      seeker_id: new ObjectId(user.id),
      provider_id: canonicalProviderId,
      seeker_name: seeker?.name || user.name || "User",
      rating: ratingNum,
      comment: comment || undefined,
      createdAt: new Date(),
    };

    await db.collection<Review>("reviews").insertOne(review);

    // Update provider counters and average atomically to avoid race conditions.
    await db
      .collection<Provider>("providers")
      .updateOne({ _id: canonicalProviderId }, [
        {
          $set: {
            ratingTotal: {
              $add: [
                {
                  $ifNull: [
                    "$ratingTotal",
                    {
                      $multiply: [
                        { $ifNull: ["$rating", 0] },
                        { $ifNull: ["$reviewCount", 0] },
                      ],
                    },
                  ],
                },
                ratingNum,
              ],
            },
            reviewCount: { $add: [{ $ifNull: ["$reviewCount", 0] }, 1] },
          },
        },
        {
          $set: {
            rating: {
              $cond: [
                { $gt: ["$reviewCount", 0] },
                { $divide: ["$ratingTotal", "$reviewCount"] },
                0,
              ],
            },
          },
        },
      ]);

    return successResponse({ message: "Review submitted" });
  } catch (error: unknown) {
    logger.error("REVIEWS", "Error creating review", error);
    return errorResponse(error);
  }
}
