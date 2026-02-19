import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { invoiceReviewSchema } from "@/lib/api/schemas";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireSeeker } from "@/lib/api/auth";

export const runtime = "nodejs";

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
      windowMs: 5 * 60 * 1000,
    });

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
    }

    const session = await requireSeeker();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = invoiceReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid invoice review data",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { approved, reason } = parsed.data;

    const { db } = await getDb();
    const bookingId = new ObjectId(id);

    // 1. Fetch Booking and Validate Seeker
    const booking = await db.collection("bookings").findOne({ _id: bookingId });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.seeker_id.toString() !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized access to this booking" },
        { status: 403 },
      );
    }

    if (booking.status !== "invoice_created") {
      // Allow idempotency if already converted
      if (booking.status === "completed" || booking.status === "confirmed") {
        const existing = await db
          .collection("orders")
          .findOne({ booking_id: bookingId });
        if (existing)
          return NextResponse.json({ success: true, orderId: existing._id });
      }
      return NextResponse.json(
        { error: "Booking is not in invoice review state" },
        { status: 400 },
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
      return NextResponse.json({ success: true, status: "rejected" });
    }

    // HANDLE APPROVAL -> CREATE ORDER
    const existingOrder = await db.collection("orders").findOne({ booking_id: bookingId });
    if (existingOrder) {
      return NextResponse.json({
        success: true,
        orderId: existingOrder._id,
        status: "approved",
      });
    }

    const invoice = booking.invoice;
    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice data missing" },
        { status: 500 },
      );
    }

    // Map Invoice Items to Order Items
    const orderItems = invoice.items.map(
      (item: {
        itemType: string;
        quantity: number;
        unitPrice: number;
        photoUrl?: string;
      }) => ({
      name: item.itemType,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.quantity * item.unitPrice,
      photoUrl: item.photoUrl,
      notes: booking.invoice.notes, // Apply general notes to items or handle appropriately. PRD says notes per item possible, but MVP invoice has general notes.
      }),
    );

    // Calculate totals
    const subtotal =
      invoice.subtotal ||
      orderItems.reduce((sum: number, i: { line_total: number }) => sum + i.line_total, 0);
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

    const result = await db.collection("orders").insertOne(newOrder);

    // Update Booking to link to Order
    await db.collection("bookings").updateOne(
      { _id: bookingId },
      {
        $set: {
          status: "completed", // Or "converted"? Using "completed" as booking lifecycle is technically done, order lifecycle begins. PRD says "Booking converts to confirmed Order".
          order_id: result.insertedId,
          updatedAt: new Date(),
        },
      },
    );

    return NextResponse.json({
      success: true,
      orderId: result.insertedId,
      status: "approved",
    });
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

    logger.error("INVOICES", "Invoice review error", error, { bookingId: id });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
