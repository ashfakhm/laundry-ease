import {
  legacyErrorResponse,
  legacySuccessResponse,
} from "@/lib/api/legacy-response";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { requireProvider } from "@/lib/api/auth";
import { invoiceCreateSchema } from "@/lib/api/schemas";
import { AppError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";

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
    const { user } = await requireProvider();

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return legacyErrorResponse("Invalid booking ID", 400);
    }
    if (!ObjectId.isValid(user.id)) {
      return legacyErrorResponse("Unauthorized", 401);
    }

    const body = await req.json();
    const parsed = invoiceCreateSchema.safeParse(body);
    if (!parsed.success) {
      return legacyErrorResponse(
        "Invalid invoice data",
        400,
        parsed.error.flatten().fieldErrors,
      );
    }

    const { db } = await getDb();
    const bookingId = new ObjectId(id);
    const providerId = new ObjectId(user.id);

    const booking = await db.collection("bookings").findOne({
      _id: bookingId,
    });
    if (!booking) {
      return legacyErrorResponse("Booking not found", 404);
    }

    if (String(booking.provider_id) !== user.id) {
      return legacyErrorResponse("Unauthorized", 403);
    }

    if (
      booking.status !== "confirmed" &&
      booking.status !== "invoice_created"
    ) {
      return legacyErrorResponse(
        "Invoice can only be created for confirmed bookings",
        409,
      );
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

    return legacySuccessResponse();
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.statusCode },
      );
    }

    logger.error("INVOICES", "Error creating invoice", error);
    return legacyErrorResponse("Failed to create invoice", 500);
  }
}
