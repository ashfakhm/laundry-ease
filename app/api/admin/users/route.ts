import { successResponse, errorResponse } from "@/lib/api/response";
import { RATE_LIMIT_DEFAULT_WINDOW_MS } from "@/lib/constants";
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
      windowMs: RATE_LIMIT_DEFAULT_WINDOW_MS,
    });

    await requireAdminWithDbCheck();

    const url = new URL(req.url);
    const page = Math.max(0, parseInt(url.searchParams.get("page") || "0", 10) || 0);
    const limit = 50;

    const { db } = await getDb();

    // Fetch seekers and providers with pagination applied after merge
    const [seekers, providers] = await Promise.all([
      db
        .collection<UserDocument>("seekers")
        .find({ isDeleted: { $ne: true } }, { projection: { password: 0 } })
        .toArray(),
      db
        .collection<UserDocument>("providers")
        .find({ isDeleted: { $ne: true } }, { projection: { password: 0 } })
        .toArray(),
    ]);

    // Combine, sort, and paginate
    const allUsers: UserWithRole[] = [
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

    const users = allUsers.slice(page * limit, (page + 1) * limit);

    return successResponse({ users, total: allUsers.length, page, limit });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    const { logger } = await import("@/lib/logger");
    logger.error("ADMIN_USERS", "Error fetching users", error);
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"));
  }
}
