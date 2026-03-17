import { successResponse, errorResponse } from "@/lib/api/response";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { requireAdminWithDbCheck } from "@/lib/api/auth";
import { Role } from "@/types/enums";
import { z } from "zod";
import { requireSameOrigin } from "@/lib/api/security";

const banUserSchema = z.object({
  blocked_until: z.string().datetime(),
  role: z.enum([Role.SEEKER, Role.PROVIDER]),
  reason: z.string().min(1, "Reason is required"),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSameOrigin(req);
    await requireAdminWithDbCheck();

    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = banUserSchema.safeParse(body);

    if (!ObjectId.isValid(id) || !parsed.success) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Missing or invalid parameters"));
    }

    const blockedUntil = new Date(parsed.data.blocked_until);
    const collection =
      parsed.data.role === Role.PROVIDER ? "providers" : "seekers";

    const { db } = await getDb();
    const result = await db
      .collection(collection)
      .updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: { 
            blocked_until: blockedUntil,
            blocked_reason: parsed.data.reason,
          } 
        },
      );

    if (result.modifiedCount === 1) {
      return successResponse({
        success: true
      }, 200);
    }

    return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "User not found or not updated"));
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    const { logger } = await import("@/lib/logger");
    logger.error("ADMIN_USERS", "Failed to ban user", error);
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"));
  }
}
