import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== Role.PROVIDER) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();

    // 1. Find all active bookings for this provider
    // 2. Lookup messages for each booking
    // 3. Filter out bookings with no messages
    const chats = await db
      .collection("bookings")
      .aggregate([
        {
          $match: {
            provider_id: new ObjectId(session.user.id),
            // status: { $ne: "cancelled" } // Optional: Keep cancelled chats if history needed?
            // Usually valid to see history even if cancelled. Let's keep filters minimal.
          },
        },
        // Join with Chats collection
        {
          $lookup: {
            from: "chats",
            localField: "_id",
            foreignField: "booking_id",
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
        // Join with Orders (optional, for status context)
        {
          $lookup: {
            from: "orders",
            localField: "_id",
            foreignField: "booking_id",
            as: "order",
          },
        },
        // Project strict structure for frontend
        {
          $project: {
            _id: 1, // booking_id
            booking_status: "$status",
            createdAt: 1,
            seeker: {
              name: 1,
              email: 1,
              phone: 1,
            },
            order: { $arrayElemAt: ["$order", 0] },
            // Get last message efficiently from the looked-up array
            // Note: Chats lookup might return unsorted, so we should sort messages
            messages: 1, // Need to sort this array first?
          },
        },
        // Add fields for sorting
        {
           $addFields: {
              lastMessage: { 
                 $arrayElemAt: [
                    {
                       $filter: {
                          input: { 
                              $sortArray: { input: "$messages", sortBy: { createdAt: -1 } } 
                          },
                          as: "m",
                          cond: true // just take the sorted array
                       }
                    }, 
                    0
                 ] 
              },
              messageCount: { $size: "$messages" }
           }
        },
        // Cleanup: We don't need the full messages array anymore
        {
           $project: {
              messages: 0 
           }
        },
        // Sort entire conversation list by latest message
        {
          $sort: {
            "lastMessage.createdAt": -1,
          },
        },
      ])
      .toArray();

    // Transform to match frontend types if needed
    const formattedChats = chats.map(chat => ({
        _id: chat._id,
        status: chat.order?.process_status || chat.booking_status, // Use order status if available
        createdAt: chat.createdAt,
        seeker: chat.seeker,
        lastMessage: chat.lastMessage ? {
            text: chat.lastMessage.message,
            sender: chat.lastMessage.sender_id.toString(),
            timestamp: chat.lastMessage.createdAt
        } : null,
        messageCount: chat.messageCount
    }));

    return NextResponse.json(formattedChats);
  } catch (error) {
    logger.error("PROVIDER", "Error fetching provider chats", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
