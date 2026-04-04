import { successResponse, errorResponse } from "@/lib/api/response";
import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { requireAdminWithDbCheck } from "@/lib/api/auth";
import { z } from "zod";
import { requireSameOrigin } from "@/lib/api/security";
import { softDeleteAccount } from "@/lib/services/account-deletion";

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
    const success = await softDeleteAccount(id, role, "admin");
    if (success) {
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
