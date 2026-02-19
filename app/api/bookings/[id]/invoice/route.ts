import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { invoiceCreateSchema } from "@/lib/api/schemas";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireProvider } from "@/lib/api/auth";

// POST: Provider creates invoice for a confirmed booking
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "bookings:invoice:create",
      max: 20,
      windowMs: 5 * 60 * 1000,
    });

    // Always use ObjectId for MongoDB queries
    let bookingQuery: { _id: ObjectId };
    try {
      bookingQuery = { _id: new ObjectId(id) };
    } catch {
      return NextResponse.json(
        { error: "Invalid booking id" },
        { status: 400 }
      );
    }

    const session = await requireProvider();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = invoiceCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid invoice data",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { items, notes, photos, discount, total, subtotal } = parsed.data;

    const { db } = await getDb();

    const booking = await db.collection("bookings").findOne(bookingQuery);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Only provider can create invoice for their booking
    const provider = await db
      .collection("providers")
      .findOne({ email: session.user.email });
    if (
      !provider ||
      booking.provider_id.toString() !== provider._id.toString()
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (booking.status !== "confirmed") {
      return NextResponse.json(
        { error: "Invoice can only be created for confirmed bookings" },
        { status: 400 }
      );
    }

    // Invoice structure: items, notes, photos, discount, subtotal, total
    // Calculate totals - Zod already validates all numbers are nonnegative
    const calculatedSubtotal = items.reduce(
      (sum: number, it) => sum + it.quantity * it.unitPrice,
      0
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

    return NextResponse.json({ success: true });
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

    logger.error("BOOKINGS", "Create invoice error", error, { bookingId: id });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
