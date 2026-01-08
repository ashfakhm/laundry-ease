import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { db } = await getDb();
  const { approved } = await req.json();
  const { id } = await params;
  // Only seeker can review
  const booking = await db
    .collection("bookings")
    .findOne({ _id: new ObjectId(id) });
  if (!booking || booking.seeker_id.toString() !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // Update invoice status
  await db.collection("invoices").updateOne(
    { booking_id: new ObjectId(id) },
    {
      $set: {
        status: approved ? "approved" : "rejected",
        reviewedAt: new Date(),
      },
    }
  );
  return NextResponse.json({ ok: true });
}
