import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// POST: Seeker reviews invoice (approve/reject)
export async function POST(req: Request, context: { params: { id: string } }) {
  try {
    const { id } = context.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { db } = await getDb();
    const { action } = await req.json(); // action: "approve" | "reject" | "edit"
    const bookingQuery = { _id: new ObjectId(id) };
    const booking = await db.collection("bookings").findOne(bookingQuery);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    // Only seeker can review
    const seeker = await db
      .collection("seekers")
      .findOne({ email: session.user.email });
    if (!seeker || booking.seeker_id.toString() !== seeker._id.toString()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (action === "approve") {
      // Create order from booking/invoice
      const invoice = booking.invoice;
      if (
        !invoice ||
        !Array.isArray(invoice.items) ||
        invoice.items.length === 0
      ) {
        return NextResponse.json(
          { error: "No invoice to approve" },
          { status: 400 }
        );
      }
      // Use stored total (with discount) if present
      const total =
        typeof invoice.total === "number"
          ? invoice.total
          : invoice.items.reduce(
              (sum: number, it: { unitPrice: number; quantity: number }) =>
                sum + it.unitPrice * it.quantity,
              0
            );
      // Create order
      await db.collection("orders").insertOne({
        booking_id: booking._id,
        seeker_id: booking.seeker_id,
        provider_id: booking.provider_id,
        items: invoice.items.map(
          (it: { itemType: string; quantity: number; unitPrice: number }) => ({
            name: it.itemType,
            quantity: it.quantity,
            unit_price: it.unitPrice,
            line_total: it.unitPrice * it.quantity,
          })
        ),
        total_price: total,
        delivery_distance_km: booking.delivery_distance_km,
        delivery_charge: booking.delivery_charge,
        payment_status: "unpaid",
        process_status: "invoiced",
        deadline: booking.deadline,
        createdAt: new Date(),
      });
      // Mark booking as completed, apply booking fee
      await db.collection("bookings").updateOne(bookingQuery, {
        $set: {
          status: "completed",
          bookingFeeStatus: "applied",
          updatedAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, orderCreated: true });
    } else if (action === "reject") {
      // Forfeit booking fee, mark booking as rejected
      await db.collection("bookings").updateOne(bookingQuery, {
        $set: {
          status: "rejected",
          bookingFeeStatus: "forfeited",
          updatedAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, feeForfeited: true });
    } else if (action === "edit") {
      // Mark booking as invoice_created, allow provider to edit
      await db.collection("bookings").updateOne(bookingQuery, {
        $set: {
          status: "invoice_created",
          updatedAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, editRequested: true });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Invoice review error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
