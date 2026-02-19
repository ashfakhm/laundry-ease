import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { AppError } from "@/lib/api/errors";
import { requireAdminWithDbCheck } from "@/lib/api/auth";
import { Role } from "@/types/enums";
import { z } from "zod";

const banUserSchema = z.object({
  blocked_until: z.string().datetime(),
  role: z.enum([Role.SEEKER, Role.PROVIDER]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminWithDbCheck();

    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = banUserSchema.safeParse(body);

    if (!ObjectId.isValid(id) || !parsed.success) {
      return NextResponse.json(
        { error: "Missing or invalid parameters" },
        { status: 400 }
      );
    }

    const blockedUntil = new Date(parsed.data.blocked_until);
    const collection =
      parsed.data.role === Role.PROVIDER ? "providers" : "seekers";

    const { db } = await getDb();
    const result = await db
      .collection(collection)
      .updateOne({ _id: new ObjectId(id) }, { $set: { blocked_until: blockedUntil } });

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
