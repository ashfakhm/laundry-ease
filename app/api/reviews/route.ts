import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/**
 * POST /api/reviews
 * Body: { bookingId, rating, comment }
 * Only seekers can submit reviews for completed orders (after invoice approval)
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { db } = await getDb();
  const { bookingId, rating, comment } = await req.json();
  if (!bookingId || !rating || !comment) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  // Find booking and ensure seeker matches
  const booking = await db
    .collection("bookings")
    .findOne({ _id: new ObjectId(bookingId) });
  if (!booking || booking.seeker_id.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Only allow review if invoice is approved
  const invoice = await db
    .collection("invoices")
    .findOne({ booking_id: new ObjectId(bookingId) });
  if (!invoice || invoice.status !== "approved") {
    return NextResponse.json(
      { error: "Invoice not approved" },
      { status: 400 }
    );
  }
  // Prevent duplicate reviews
  const existing = await db
    .collection("reviews")
    .findOne({
      booking_id: new ObjectId(bookingId),
      seeker_id: booking.seeker_id,
    });
  if (existing) {
    return NextResponse.json(
      { error: "Review already submitted" },
      { status: 409 }
    );
  }
  // Insert review
  const review = {
    booking_id: new ObjectId(bookingId),
    provider_id: booking.provider_id,
    seeker_id: booking.seeker_id,
    rating,
    comment,
    createdAt: new Date(),
  };
  await db.collection("reviews").insertOne(review);
  return NextResponse.json({ ok: true });
}
