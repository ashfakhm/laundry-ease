import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { Role } from "@/types/enums";
import { AppError } from "@/lib/api/errors";
import { requireAdminWithDbCheck } from "@/lib/api/auth";
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

export async function GET() {
  try {
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
        new Date(a.createdAt || 0).getTime()
    );

    return NextResponse.json(users);
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
    logger.error("ADMIN_USERS", "Error fetching users", error);
    return NextResponse.json({ success: false, ok: false, message: "Internal server error" , error: { code: "ERROR", message: "Internal server error"  } }, { status: 500 });
  }
}
