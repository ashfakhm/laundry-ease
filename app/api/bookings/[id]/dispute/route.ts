import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/**
 * POST /api/bookings/[id]/dispute
 * Body: { reason, details }
 * Allows seeker or provider to raise a dispute for a booking
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { db } = await getDb();
  const { reason, details } = await req.json();
  if (!reason || !details) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const booking = await db
    .collection("bookings")
    .findOne({ _id: new ObjectId(id) });
  if (!booking)
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  // Only allow seeker or provider
  let role: "seeker" | "provider" | null = null;
  if (session.user.id === booking.seeker_id.toString()) role = "seeker";
  if (session.user.id === booking.provider_id.toString()) role = "provider";
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Insert dispute
  const dispute = {
    booking_id: new ObjectId(id),
    raised_by: role,
    user_id: session.user.id,
    reason,
    details,
    status: "open",
    createdAt: new Date(),
  };
  await db.collection("disputes").insertOne(dispute);
  // Optionally, freeze escrow/payment here
  return NextResponse.json({ ok: true });
}
