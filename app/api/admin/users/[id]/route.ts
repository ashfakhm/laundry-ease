import { successResponse, errorResponse } from "@/lib/api/response";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { requireAdminWithDbCheck } from "@/lib/api/auth";
import { z } from "zod";
import { requireSameOrigin } from "@/lib/api/security";

const deleteUserSchema = z.object({
  role: z.enum([Role.SEEKER, Role.PROVIDER]),
});

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSameOrigin(req);
    await requireAdminWithDbCheck();

    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = deleteUserSchema.safeParse(body);

    if (!ObjectId.isValid(id) || !parsed.success) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Missing or invalid parameters"));
    }

    const { role } = parsed.data;
    const { db } = await getDb();
    const collection = role === Role.PROVIDER ? "providers" : "seekers";
    const result = await db
      .collection(collection)
      .updateOne(
        { _id: new ObjectId(id) },
        { $set: { isDeleted: true, deletedAt: new Date() } }
      );
    if (result.matchedCount === 1) {
      return successResponse({
        success: true
      }, 200);
    }
    return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "User not found or not deleted"));
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    const { logger } = await import("@/lib/logger");
    logger.error("ADMIN_USERS", "Failed to delete user", error);
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"));
  }
}
