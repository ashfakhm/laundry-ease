import { successResponse } from "@/lib/api/response";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";
import { AppError } from "@/lib/api/errors";
import { requireAdminWithDbCheck } from "@/lib/api/auth";
import { z } from "zod";

const deleteUserSchema = z.object({
  role: z.enum([Role.SEEKER, Role.PROVIDER]),
});

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminWithDbCheck();

    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = deleteUserSchema.safeParse(body);

    if (!ObjectId.isValid(id) || !parsed.success) {
      return NextResponse.json({
        success: false,
        error: "Missing or invalid parameters"
      }, {
        status: 400
      });
    }

    const { role } = parsed.data;
    const { db } = await getDb();
    const collection = role === Role.PROVIDER ? "providers" : "seekers";
    const result = await db
      .collection(collection)
      .deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 1) {
      return successResponse({
        success: true
      }, 200);
    }
    return NextResponse.json({
      success: false,
      error: "User not found or not deleted"
    }, {
      status: 404
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({
        success: false,
        error: error.message,

        ...(error.details ? {
          details: error.details
        } : {})
      }, {
        status: error.statusCode || 400
      });
    }

    const { logger } = await import("@/lib/logger");
    logger.error("ADMIN_USERS", "Failed to delete user", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error"
    }, {
      status: 500
    });
  }
}
