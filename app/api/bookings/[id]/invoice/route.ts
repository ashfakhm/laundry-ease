import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// POST: Provider creates invoice for a confirmed booking
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { items, notes, photos, discount, total, subtotal } = body;
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Invoice items required" },
        { status: 400 }
      );
    }

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
    // Helper to generic safe parse numbers
    const safeNum = (val: unknown) => {
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    };

    const cleanDiscount = safeNum(discount);
    // Recalculate subtotal from items if missing/invalid
    const calculatedSubtotal = items.reduce(
      (sum: number, it: { quantity: unknown; unitPrice: unknown }) =>
        sum + safeNum(it.quantity) * safeNum(it.unitPrice),
      0
    );
    const cleanSubtotal =
      subtotal !== undefined ? safeNum(subtotal) : calculatedSubtotal;

    // Recalculate total if missing
    // Default total is subtotal - discount
    let cleanTotal =
      body.total !== undefined
        ? safeNum(body.total)
        : Math.max(0, cleanSubtotal - cleanDiscount);
    // Ensure total is never negative
    cleanTotal = Math.max(0, cleanTotal);

    // Invoice structure: items, notes, photos, discount, subtotal, total
    const invoice = {
      items,
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

    // TODO: Notify seeker to review invoice

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Create invoice error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
