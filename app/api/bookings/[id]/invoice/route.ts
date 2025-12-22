import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// POST: Provider creates invoice for a confirmed booking
export async function POST(
  req: Request,
  context: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    // Support both sync and async params (Promise or object)
    const params =
      typeof (context.params as any).then === "function"
        ? await context.params
        : context.params;
    const { id } = params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { items, notes, photos } = body;
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Invoice items required" },
        { status: 400 }
      );
    }

    const { db } = await getDb();
    let bookingQuery;
    try {
      bookingQuery = { _id: new ObjectId(id) };
    } catch {
      bookingQuery = { _id: id };
    }

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

    // Invoice structure: items (array), notes (optional), photos (optional)
    const invoice = {
      items,
      notes: notes || "",
      photos: photos || [],
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
