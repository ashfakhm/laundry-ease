import { successResponse, errorResponse } from "@/lib/api/response";
import { RATE_LIMIT_STRICT_WINDOW_MS } from "@/lib/constants";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { invoiceReviewSchema } from "@/lib/api/schemas";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireSeeker } from "@/lib/api/auth";
import { finalizeInvoiceOrder } from "@/lib/services/invoice-finalization";

export const runtime = "nodejs";

type InvoiceReviewLineItem = {
  itemType: string;
  quantity: number;
  unitPrice: number;
  photoUrl?: string;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "invoices:review",
      max: 15,
      windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
    });

    if (!ObjectId.isValid(id)) {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid booking id"),
      );
    }

    const { user } = await requireSeeker();
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );
    }

    const body = await req.json();
    const parsed = invoiceReviewSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "Invalid invoice review data",
          parsed.error.flatten().fieldErrors,
        ),
      );
    }

    const { approved, reason } = parsed.data;

    const { db, client } = await getDb();
    const bookingId = new ObjectId(id);

    // 1. Fetch Booking and Validate Seeker
    const booking = await db.collection("bookings").findOne({ _id: bookingId });

    if (!booking) {
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found"),
      );
    }

    if (booking.seeker_id.toString() !== user.id) {
      return errorResponse(
        new AppError(
          ErrorCode.FORBIDDEN,
          403,
          "Unauthorized access to this booking",
        ),
      );
    }

    if (booking.status !== "invoice_created") {
      // Allow idempotency if already converted
      if (booking.status === "completed" || booking.status === "confirmed") {
        const existing = await db
          .collection("orders")
          .findOne({ booking_id: bookingId });
        if (existing) return successResponse({ orderId: existing._id });
      }
      return errorResponse(
        new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "Booking is not in invoice review state",
        ),
      );
    }

    if (!approved) {
      // HANDLE REJECTION
      // PRD: "Booking fee retained by provider as compensation; Process ends"
      // Status update
      await db.collection("bookings").updateOne(
        { _id: bookingId },
        {
          $set: {
            status: "cancelled",
            rejection_reason: reason || "No reason provided",
            updatedAt: new Date(),
            bookingFeeStatus: "forfeited",
          },
        },
      );
      return successResponse({ status: "rejected" });
    }

    // HANDLE APPROVAL -> CREATE ORDER (transaction-first with fallback compensation)
    const invoice = booking.invoice as
      | {
          items?: InvoiceReviewLineItem[];
          notes?: string;
          subtotal?: number;
          discount?: number;
          total?: number;
        }
      | undefined;
    if (
      !invoice ||
      !Array.isArray(invoice.items) ||
      invoice.items.length === 0
    ) {
      return errorResponse(
        new AppError(ErrorCode.INTERNAL_ERROR, 500, "Invoice data missing"),
      );
    }

    // Map Invoice Items to Order Items
    const orderItems = invoice.items.map((item) => ({
      name: item.itemType,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.quantity * item.unitPrice,
      photoUrl: item.photoUrl,
      notes: invoice.notes,
    }));

    // Calculate totals
    const subtotal =
      invoice.subtotal ||
      orderItems.reduce(
        (sum: number, i: { line_total: number }) => sum + i.line_total,
        0,
      );
    const discount = invoice.discount || 0;
    const total = invoice.total || Math.max(0, subtotal - discount);

    // Prepare Order Object
    const newOrder = {
      booking_id: bookingId,
      seeker_id: new ObjectId(booking.seeker_id),
      provider_id: new ObjectId(booking.provider_id),
      items: orderItems,
      subtotal,
      discount,
      delivery_charge: 0,
      total_price: total,
      payment_status: "unpaid",
      process_status: "invoiced",
      deadline: booking.deadline ? new Date(booking.deadline) : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { orderId } = await finalizeInvoiceOrder({
      db,
      client,
      bookingId,
      orderData: newOrder,
      now: new Date(),
      domain: "INVOICES",
    });

    return successResponse({
      orderId,
      status: "approved",
    });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("INVOICES", "Invoice review error", error, { bookingId: id });
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"),
    );
  }
}
