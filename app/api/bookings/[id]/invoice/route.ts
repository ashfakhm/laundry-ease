import { getDb } from "@/lib/mongodb";
import { RATE_LIMIT_STRICT_WINDOW_MS } from "@/lib/constants";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { invoiceCreateSchema } from "@/lib/api/schemas";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireProvider } from "@/lib/api/auth";
import { successResponse, errorResponse } from "@/lib/api/response";

// POST: Provider creates invoice for a confirmed booking
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "bookings:invoice:create",
      max: 20,
      windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
    });

    if (!ObjectId.isValid(id)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid booking id");
    }
    const bookingQuery: { _id: ObjectId } = { _id: new ObjectId(id) };

    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized");
    }

    const body = await req.json();
    const parsed = invoiceCreateSchema.safeParse(body);

    if (!parsed.success) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "Invalid invoice data",
        parsed.error.flatten().fieldErrors,
      );
    }

    const { items, notes, photos, discount, total, subtotal } = parsed.data;
    // Explicitly reject negative discounts (defense-in-depth)
    if (typeof discount === "number" && discount < 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "Discount cannot be negative",
      );
    }

    const { db } = await getDb();

    const booking = await db.collection("bookings").findOne(bookingQuery);
    if (!booking) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found");
    }

    // Only provider can create invoice for their booking
    const provider = await db
      .collection("providers")
      .findOne({ _id: new ObjectId(user.id) });
    if (
      !provider ||
      booking.provider_id.toString() !== provider._id.toString()
    ) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found");
    }
    if (booking.status !== "confirmed") {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "Invoice can only be created for confirmed bookings",
      );
    }

    // Invoice structure: items, notes, photos, discount, subtotal, total
    // Calculate totals - Zod already validates all numbers are nonnegative
    const calculatedSubtotal = items.reduce(
      (sum: number, it) => sum + it.quantity * it.unitPrice,
      0,
    );
    const cleanSubtotal =
      subtotal !== undefined ? subtotal : calculatedSubtotal;
    const cleanDiscount = discount || 0;
    // Recalculate total if missing - ensure it's never negative
    const cleanTotal =
      total !== undefined
        ? Math.max(0, total)
        : Math.max(0, cleanSubtotal - cleanDiscount);

    // Invoice structure - validated by Zod schema
    const invoice = {
      items: items.map((it) => ({
        itemType: it.itemType,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        photoUrl: it.photoUrl,
      })),
      notes: notes || "",
      photos: photos || [],
      discount: cleanDiscount,
      subtotal: cleanSubtotal,
      total: cleanTotal,
      createdAt: new Date(),
    };

    await db.collection("bookings").updateOne(bookingQuery, {
      $set: {
        status: "invoice_created",
        invoice,
        updatedAt: new Date(),
      },
    });

    // NOTE: Seeker notification for invoice review could be added here using existing Twilio/email infrastructure

    return successResponse({});
  } catch (error) {
    if (!(error instanceof AppError)) {
      logger.error("BOOKINGS", "Create invoice error", error, {
        bookingId: id,
      });
    }
    return errorResponse(error);
  }
}
