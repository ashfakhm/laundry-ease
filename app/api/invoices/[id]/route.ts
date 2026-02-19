import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { requireProvider } from "@/lib/api/auth";
import { invoiceCreateSchema } from "@/lib/api/schemas";
import { AppError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";

/**
 * POST /api/invoices/[id]
 * Save invoice data for a booking/order
 * Body: { items: [{ itemType, quantity, unitPrice, photoUrl? }], total, notes? }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireProvider();

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 });
    }
    if (!ObjectId.isValid(user.id)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = invoiceCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid invoice data", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { db } = await getDb();

    const invoice = {
      booking_id: new ObjectId(id),
      provider_id: new ObjectId(user.id),
      items: parsed.data.items,
      total: parsed.data.total,
      notes: parsed.data.notes,
      createdAt: new Date(),
    };
    await db.collection("invoices").insertOne(invoice);
    return NextResponse.json({ ok: true });
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

    logger.error("INVOICES", "Error creating invoice", error);
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}
