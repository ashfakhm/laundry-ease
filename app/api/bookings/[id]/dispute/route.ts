import { successResponse, errorResponse } from "@/lib/api/response";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { bookingDisputeSchema } from "@/lib/api/schemas";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireAuth } from "@/lib/api/auth";

/**
 * POST /api/bookings/[id]/dispute
 * Body: { reason, details }
 * Allows seeker or provider to raise a dispute for a booking
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "bookings:dispute:create",
      max: 10,
      windowMs: 5 * 60 * 1000,
    });

    if (!ObjectId.isValid(id)) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid booking id"));
    }

    const { user } = await requireAuth();
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"));
    }

    const body = await req.json();
    const parsed = bookingDisputeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: "Invalid dispute data",
        details: parsed.error.flatten().fieldErrors
      }, {
        status: 400
      });
    }

    const { reason, details } = parsed.data;
    const bookingId = new ObjectId(id);
    const { db } = await getDb();

    const booking = await db.collection("bookings").findOne({ _id: bookingId });
    if (!booking)
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found"));

    // Only allow seeker or provider
    let role: "seeker" | "provider" | null = null;
    if (user.id === booking.seeker_id.toString()) role = "seeker";
    if (user.id === booking.provider_id.toString()) role = "provider";
    if (!role) {
      return errorResponse(new AppError(ErrorCode.FORBIDDEN, 403, "Forbidden"));
    }

    const dispute = {
      booking_id: bookingId,
      raised_by: role,
      user_id: user.id,
      reason,
      details,
      status: "open",
      createdAt: new Date(),
    };
    await db.collection("disputes").insertOne(dispute);

    return successResponse({
      success: true
    }, 200);
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

    logger.error("BOOKINGS", "Create dispute error", error, { bookingId: id });
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal error"));
  }
}
