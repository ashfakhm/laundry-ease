import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/**
 * POST /api/invoices/[id]
 * Save invoice data for a booking/order
 * Body: { items: [{ itemType, quantity, unitPrice, photoUrl? }], total, notes? }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { db } = await getDb();
  const { items, total, notes } = await req.json();
  const { id } = await params;

  // Save invoice to DB (can be in 'invoices' collection or embedded in order)
  const invoice = {
    booking_id: new ObjectId(id),
    provider_id: session.user.id,
    items,
    total,
    notes,
    createdAt: new Date(),
  };
  await db.collection("invoices").insertOne(invoice);
  return NextResponse.json({ ok: true });
}
