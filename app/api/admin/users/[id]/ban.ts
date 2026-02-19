import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { AppError } from "@/lib/api/errors";
import { requireAdminWithDbCheck } from "@/lib/api/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminWithDbCheck();

    const { id } = await params;
    const { blocked_until, role } = await req.json();
    if (!blocked_until || !role || !["seeker", "provider"].includes(role)) {
      return NextResponse.json(
        { error: "Missing or invalid parameters" },
        { status: 400 }
      );
    }
    const { db } = await getDb();
    const collection = role === "provider" ? "providers" : "seekers";
    const result = await db
      .collection(collection)
      .updateOne({ _id: new ObjectId(id) }, { $set: { blocked_until } });
    if (result.modifiedCount === 1) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { error: "User not found or not updated" },
      { status: 404 }
    );
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

    const { logger } = await import("@/lib/logger");
    logger.error("ADMIN_USERS", "Failed to ban user", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
