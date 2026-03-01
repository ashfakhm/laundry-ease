import { successResponse, errorResponse } from "@/lib/api/response";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { requireProvider } from "@/lib/api/auth";
import { invoiceCreateSchema } from "@/lib/api/schemas";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { logger } from "@/lib/logger";
import { requireSameOrigin } from "@/lib/api/security";

/**
 * POST /api/invoices/[id]
 * Save invoice data for a booking/order
 * Body: { items: [{ itemType, quantity, unitPrice, photoUrl? }], total, notes? }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSameOrigin(req);
    const { user } = await requireProvider();

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid booking ID"));
    }
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"));
    }

    const body = await req.json();
    const parsed = invoiceCreateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid invoice data", parsed));
    }

    const { db } = await getDb();
    const bookingId = new ObjectId(id);
    const providerId = new ObjectId(user.id);

    const booking = await db.collection("bookings").findOne({
      _id: bookingId,
    });
    if (!booking) {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found"));
    }

    if (String(booking.provider_id) !== user.id) {
      return errorResponse(new AppError(ErrorCode.FORBIDDEN, 403, "Unauthorized"));
    }

    if (
      booking.status !== "confirmed" &&
      booking.status !== "invoice_created"
    ) {
      return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Invoice can only be created for confirmed bookings"));
    }

    const calculatedSubtotal = parsed.data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const cleanSubtotal =
      parsed.data.subtotal !== undefined
        ? parsed.data.subtotal
        : calculatedSubtotal;
    const cleanDiscount = parsed.data.discount || 0;
    const cleanTotal =
      parsed.data.total !== undefined
        ? Math.max(0, parsed.data.total)
        : Math.max(0, cleanSubtotal - cleanDiscount);

    const now = new Date();
    const invoicePayload = {
      items: parsed.data.items,
      notes: parsed.data.notes || "",
      photos: parsed.data.photos || [],
      discount: cleanDiscount,
      subtotal: cleanSubtotal,
      total: cleanTotal,
      createdAt: now,
    };

    await db.collection("invoices").updateOne(
      { booking_id: bookingId, provider_id: providerId },
      {
        $set: {
          ...invoicePayload,
          updatedAt: now,
        },
        $setOnInsert: {
          booking_id: bookingId,
          provider_id: providerId,
        },
      },
      { upsert: true },
    );

    await db.collection("bookings").updateOne(
      { _id: bookingId },
      {
        $set: {
          status: "invoice_created",
          invoice: invoicePayload,
          updatedAt: now,
        },
      },
    );

    return successResponse({
      success: true
    }, 200);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("INVOICES", "Error creating invoice", error);
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Failed to create invoice"));
  }
}
