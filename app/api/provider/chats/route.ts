import { successResponse, errorResponse } from "@/lib/api/response";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { requireProvider } from "@/lib/api/auth";

export async function GET() {
  try {
    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );
    }

    const { db } = await getDb();
    const providerId = new ObjectId(user.id);

    // Aggregate orders that have order_chats messages for this provider
    const chats = await db
      .collection("orders")
      .aggregate([
        {
          $match: {
            provider_id: providerId,
          },
        },
        // Join with order_chats collection
        {
          $lookup: {
            from: "order_chats",
            localField: "_id",
            foreignField: "order_id",
            as: "messages",
          },
        },
        // Filter: Must have at least one message
        {
          $match: {
            messages: { $not: { $size: 0 } },
          },
        },
        // Join with Seeker details
        {
          $lookup: {
            from: "seekers",
            localField: "seeker_id",
            foreignField: "_id",
            as: "seeker",
          },
        },
        { $unwind: "$seeker" },
        // Project strict structure for frontend
        {
          $project: {
            _id: 1, // order_id
            process_status: 1,
            payment_status: 1,
            createdAt: 1,
            seeker: {
              name: 1,
              email: 1,
              phone: 1,
            },
            messages: 1,
          },
        },
        // Derive last message and message count
        {
          $addFields: {
            lastMessage: {
              $arrayElemAt: [
                {
                  $sortArray: {
                    input: "$messages",
                    sortBy: { createdAt: -1 },
                  },
                },
                0,
              ],
            },
            messageCount: { $size: "$messages" },
          },
        },
        // Drop the full messages array
        {
          $project: {
            messages: 0,
          },
        },
        // Sort conversation list by latest message
        {
          $sort: {
            "lastMessage.createdAt": -1,
          },
        },
      ])
      .toArray();

    // Transform to match frontend ChatPreview type
    const formattedChats = chats.map((chat) => ({
      _id: chat._id,
      status: chat.process_status || "invoiced",
      createdAt: chat.createdAt,
      seeker: chat.seeker,
      lastMessage: chat.lastMessage
        ? {
            text: chat.lastMessage.message,
            sender: chat.lastMessage.sender_id?.toString?.() || "",
            timestamp: chat.lastMessage.createdAt,
          }
        : null,
      messageCount: chat.messageCount,
    }));

    return successResponse(formattedChats);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("PROVIDER", "Error fetching provider chats", error);
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"),
    );
  }
}
