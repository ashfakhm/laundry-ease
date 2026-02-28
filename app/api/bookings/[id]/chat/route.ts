import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { bookingChatMessageSchema } from "@/lib/api/schemas";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireAuth } from "@/lib/api/auth";

/**
 * GET /api/bookings/[id]/chat
 * Returns all chat messages for a booking (seeker or provider must be participant)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({
        success: false,
        error: "Invalid booking id"
      }, {
        status: 400
      });
    }

    await enforceRateLimit(req, {
      bucket: "bookings:chat:get",
      max: 120,
      windowMs: 60 * 1000,
    });

    const { user } = await requireAuth();
    if (!ObjectId.isValid(user.id)) {
      return NextResponse.json({
        success: false,
        error: "Unauthorized"
      }, {
        status: 401
      });
    }

    const bookingId = new ObjectId(id);
    const { db } = await getDb();
    const booking = await db.collection("bookings").findOne({ _id: bookingId });
    if (!booking)
      return NextResponse.json({
        success: false,
        error: "Booking not found"
      }, {
        status: 404
      });

    // Only allow seeker or provider
    if (
      user.id !== booking.seeker_id.toString() &&
      user.id !== booking.provider_id.toString()
    ) {
      return NextResponse.json({
        success: false,
        error: "Forbidden"
      }, {
        status: 403
      });
    }

    const messages = await db
      .collection("chats")
      .find({ booking_id: bookingId })
      .sort({ createdAt: 1 })
      .toArray();
    return NextResponse.json(messages);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({
        success: false,
        error: error.message,

        ...(error.details ? {
          details: error.details
        } : {})
      }, {
        status: error.statusCode || 400
      });
    }

    logger.error("BOOKINGS", "Fetch booking chat failed", error, {
      bookingId: id,
    });
    return NextResponse.json({
      success: false,
      error: "Internal error"
    }, {
      status: 500
    });
  }
}

/**
 * POST /api/bookings/[id]/chat
 * Body: { message }
 * Adds a chat message (seeker or provider only)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "bookings:chat:post",
      max: 40,
      windowMs: 60 * 1000,
    });

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({
        success: false,
        error: "Invalid booking id"
      }, {
        status: 400
      });
    }

    const { user } = await requireAuth();
    if (!ObjectId.isValid(user.id)) {
      return NextResponse.json({
        success: false,
        error: "Unauthorized"
      }, {
        status: 401
      });
    }

    const body = await req.json();
    const parsed = bookingChatMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: "Invalid chat message",
        details: parsed.error.flatten().fieldErrors
      }, {
        status: 400
      });
    }

    const bookingId = new ObjectId(id);
    const { db } = await getDb();

    const booking = await db.collection("bookings").findOne({ _id: bookingId });
    if (!booking)
      return NextResponse.json({
        success: false,
        error: "Booking not found"
      }, {
        status: 404
      });

    // Only allow seeker or provider
    let senderRole: "seeker" | "provider" | null = null;
    if (user.id === booking.seeker_id.toString()) senderRole = "seeker";
    if (user.id === booking.provider_id.toString())
      senderRole = "provider";
    if (!senderRole) {
      return NextResponse.json({
        success: false,
        error: "Forbidden"
      }, {
        status: 403
      });
    }

    const chatMsg = {
      booking_id: bookingId,
      sender_id: user.id,
      sender_role: senderRole,
      message: parsed.data.message.trim(),
      createdAt: new Date(),
    };
    await db.collection("chats").insertOne(chatMsg);
    return NextResponse.json({
      success: true
    }, {
      status: 200
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({
        success: false,
        error: error.message,

        ...(error.details ? {
          details: error.details
        } : {})
      }, {
        status: error.statusCode || 400
      });
    }

    logger.error("BOOKINGS", "Send booking chat failed", error, {
      bookingId: id,
    });
    return NextResponse.json({
      success: false,
      error: "Internal error"
    }, {
      status: 500
    });
  }
}
