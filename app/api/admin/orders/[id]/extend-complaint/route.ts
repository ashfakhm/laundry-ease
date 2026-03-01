import { NextRequest } from "next/server";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { successResponse, errorResponse } from "@/lib/api/response";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/auth";

const extendComplaintSchema = z.object({
  extensionDateAt: z.string().datetime(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id: orderId } = await params;

    if (!ObjectId.isValid(orderId)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid order ID");
    }

    const payload = await req.json();
    const parsed = extendComplaintSchema.safeParse(payload);

    if (!parsed.success) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "Invalid extension date string",
      );
    }

    const { db } = await getDb();

    // Verify the order exists and is delivered
    const order = await db.collection("orders").findOne({
      _id: new ObjectId(orderId),
      process_status: "delivered",
    });

    if (!order) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        404,
        "Order not found or not delivered",
      );
    }

    const updateResult = await db.collection("orders").updateOne(
      { _id: new ObjectId(orderId) },
      {
        $set: {
          extended_complaint_window_until: new Date(
            parsed.data.extensionDateAt,
          ),
          updated_at: new Date(),
        },
      },
    );

    if (updateResult.modifiedCount === 0) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        500,
        "Failed to apply extension",
      );
    }

    logger.info("ADMIN", `Complaint window extended for order ${orderId}`, {
      orderId,
      extendedUntil: parsed.data.extensionDateAt,
    });

    return successResponse({
      success: true,
      message: "Complaint window extended successfully",
    });
  } catch (error) {
    logger.error("ADMIN", "Error extending complaint window", error);
    return errorResponse(error);
  }
}
