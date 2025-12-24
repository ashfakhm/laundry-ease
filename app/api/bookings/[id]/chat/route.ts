import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/**
 * GET /api/bookings/[id]/chat
 * Returns all chat messages for a booking (seeker or provider must be participant)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { db } = await getDb();
  const booking = await db
    .collection("bookings")
    .findOne({ _id: new ObjectId(id) });
  if (!booking)
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  // Only allow seeker or provider
  if (
    session.user.id !== booking.seeker_id.toString() &&
    session.user.id !== booking.provider_id.toString()
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const messages = await db
    .collection("chats")
    .find({ booking_id: new ObjectId(id) })
    .sort({ createdAt: 1 })
    .toArray();
  return NextResponse.json(messages);
}

/**
 * POST /api/bookings/[id]/chat
 * Body: { message }
 * Adds a chat message (seeker or provider only)
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
  const { message } = await req.json();
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }
  const booking = await db
    .collection("bookings")
    .findOne({ _id: new ObjectId(id) });
  if (!booking)
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  // Only allow seeker or provider
  let senderRole: "seeker" | "provider" | null = null;
  if (session.user.id === booking.seeker_id.toString()) senderRole = "seeker";
  if (session.user.id === booking.provider_id.toString())
    senderRole = "provider";
  if (!senderRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const chatMsg = {
    booking_id: new ObjectId(id),
    sender_id: session.user.id,
    sender_role: senderRole,
    message,
    createdAt: new Date(),
  };
  await db.collection("chats").insertOne(chatMsg);
  return NextResponse.json({ ok: true });
}
