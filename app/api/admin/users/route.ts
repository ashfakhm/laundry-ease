import { successResponse, errorResponse } from "@/lib/api/response";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { Role } from "@/types/enums";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { requireAdminWithDbCheck } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/security";
import { WithId } from "mongodb";

interface UserDocument {
  name: string;
  email: string;
  phone?: string;
  createdAt?: Date | string;
  businessName?: string;
  [key: string]: unknown;
}

type UserWithRole = WithId<UserDocument> & { role: Role };

export async function GET(req: Request) {
  try {
    await enforceRateLimit(req, {
      bucket: "admin:users:get",
      max: 40,
      windowMs: 60 * 1000,
    });

    await requireAdminWithDbCheck();

    const { db } = await getDb();

    // Fetch seekers
    const seekers = await db
      .collection<UserDocument>("seekers")
      .find({}, { projection: { password: 0 } })
      .toArray();

    // Fetch providers
    const providers = await db
      .collection<UserDocument>("providers")
      .find({}, { projection: { password: 0 } })
      .toArray();

    // Combine and add role field
    const users: UserWithRole[] = [
      ...seekers.map((s) => ({
        ...s,
        role: Role.SEEKER,
      })),
      ...providers.map((p) => ({
        ...p,
        role: Role.PROVIDER,
      })),
    ].sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime(),
    );

    return successResponse(users);
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
    logger.error("ADMIN_USERS", "Error fetching users", error);
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"));
  }
}
