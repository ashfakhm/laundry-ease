import { successResponse, errorResponse } from "@/lib/api/response";
import { RATE_LIMIT_STRICT_WINDOW_MS } from "@/lib/constants";
import { getDb } from "@/lib/mongodb";
import {
  Db,
  MongoClient,
  MongoServerError,
  ObjectId,
  type ClientSession,
} from "mongodb";
import { logger } from "@/lib/logger";
import { invoiceReviewSchema } from "@/lib/api/schemas";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireSeeker } from "@/lib/api/auth";

export const runtime = "nodejs";

type InvoiceReviewLineItem = {
  itemType: string;
  quantity: number;
  unitPrice: number;
  photoUrl?: string;
};

type FinalizeInvoiceReviewInput = {
  db: Db;
  client: MongoClient;
  bookingId: ObjectId;
  orderData: Record<string, unknown>;
  now: Date;
};

type FinalizeInvoiceReviewResult = {
  orderId: ObjectId;
};

function isTransactionUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("transaction numbers are only allowed on a replica set") ||
    message.includes("replica set") ||
    message.includes("mongos") ||
    message.includes("transactions are not supported")
  );
}

async function syncBookingOrderLink(params: {
  db: Db;
  bookingId: ObjectId;
  orderId: ObjectId;
  now: Date;
  session?: ClientSession;
}) {
  const { db, bookingId, orderId, now, session } = params;
  await db.collection("bookings").updateOne(
    { _id: bookingId, status: "invoice_created" },
    {
      $set: {
        status: "completed",
        order_id: orderId,
        updatedAt: now,
      },
    },
    session ? { session } : undefined,
  );
}

async function finalizeInvoiceReviewWithCompensation({
  db,
  bookingId,
  orderData,
  now,
}: Omit<
  FinalizeInvoiceReviewInput,
  "client"
>): Promise<FinalizeInvoiceReviewResult> {
  let insertedOrderId: ObjectId | null = null;
  try {
    const insertResult = await db.collection("orders").insertOne(orderData);
    insertedOrderId = insertResult.insertedId;
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      const existingOrder = await db
        .collection("orders")
        .findOne({ booking_id: bookingId });
      if (!existingOrder?._id) {
        throw error;
      }
      const orderId = existingOrder._id as ObjectId;
      await syncBookingOrderLink({ db, bookingId, orderId, now });
      return { orderId };
    }
    throw error;
  }

  const bookingUpdateResult = await db.collection("bookings").updateOne(
    {
      _id: bookingId,
      status: "invoice_created",
      $or: [{ order_id: { $exists: false } }, { order_id: null }],
    },
    {
      $set: {
        status: "completed",
        order_id: insertedOrderId,
        updatedAt: now,
      },
    },
  );

  if (bookingUpdateResult.modifiedCount === 0) {
    if (insertedOrderId) {
      await db.collection("orders").deleteOne({
        _id: insertedOrderId,
        booking_id: bookingId,
      });
    }

    const latestBooking = await db
      .collection("bookings")
      .findOne({ _id: bookingId });
    if (
      latestBooking?.order_id &&
      ObjectId.isValid(String(latestBooking.order_id))
    ) {
      return { orderId: new ObjectId(String(latestBooking.order_id)) };
    }

    throw new AppError(
      ErrorCode.DUPLICATE_RESOURCE,
      409,
      "Booking state changed while finalizing order. Please retry.",
    );
  }

  return { orderId: insertedOrderId as ObjectId };
}

async function finalizeInvoiceReviewWithTransaction({
  db,
  client,
  bookingId,
  orderData,
  now,
}: FinalizeInvoiceReviewInput): Promise<FinalizeInvoiceReviewResult> {
  const session = client.startSession();
  let outcome: FinalizeInvoiceReviewResult | null = null;
  try {
    await session.withTransaction(async () => {
      const existingOrder = await db
        .collection("orders")
        .findOne({ booking_id: bookingId }, { session });

      if (existingOrder?._id) {
        const orderId = existingOrder._id as ObjectId;
        await syncBookingOrderLink({ db, bookingId, orderId, now, session });
        outcome = { orderId };
        return;
      }

      const insertResult = await db
        .collection("orders")
        .insertOne(orderData, { session });

      const bookingUpdateResult = await db.collection("bookings").updateOne(
        {
          _id: bookingId,
          status: "invoice_created",
          $or: [{ order_id: { $exists: false } }, { order_id: null }],
        },
        {
          $set: {
            status: "completed",
            order_id: insertResult.insertedId,
            updatedAt: now,
          },
        },
        { session },
      );

      if (bookingUpdateResult.modifiedCount === 0) {
        const latestBooking = await db
          .collection("bookings")
          .findOne({ _id: bookingId }, { session });
        if (
          latestBooking?.order_id &&
          ObjectId.isValid(String(latestBooking.order_id))
        ) {
          outcome = { orderId: new ObjectId(String(latestBooking.order_id)) };
          return;
        }

        throw new AppError(
          ErrorCode.DUPLICATE_RESOURCE,
          409,
          "Booking state changed while finalizing order. Please retry.",
        );
      }

      outcome = { orderId: insertResult.insertedId };
    });

    if (!outcome) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        500,
        "Unable to finalize invoice review",
      );
    }

    return outcome;
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      const existingOrder = await db
        .collection("orders")
        .findOne({ booking_id: bookingId });
      if (existingOrder?._id) {
        const orderId = existingOrder._id as ObjectId;
        await syncBookingOrderLink({ db, bookingId, orderId, now });
        return { orderId };
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

async function finalizeInvoiceReviewOrder(
  input: FinalizeInvoiceReviewInput,
): Promise<FinalizeInvoiceReviewResult> {
  try {
    return await finalizeInvoiceReviewWithTransaction(input);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (isTransactionUnavailable(error)) {
      logger.warn(
        "INVOICES",
        "Transactions unavailable; using compensating invoice review finalize path",
        { bookingId: input.bookingId.toString() },
      );
      return finalizeInvoiceReviewWithCompensation({
        db: input.db,
        bookingId: input.bookingId,
        orderData: input.orderData,
        now: input.now,
      });
    }

    throw error;
  }
}

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

    const { orderId } = await finalizeInvoiceReviewOrder({
      db,
      client,
      bookingId,
      orderData: newOrder,
      now: new Date(),
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
