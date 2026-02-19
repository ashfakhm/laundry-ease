import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { Role } from "@/types/enums";
import { AppError } from "@/lib/api/errors";
import { requireAdminWithDbCheck } from "@/lib/api/auth";

interface UserDocument extends Record<string, unknown> {
  name: string;
  email: string;
  phone?: string;
  createdAt?: string;
  businessName?: string;
}

export async function GET() {
  try {
    await requireAdminWithDbCheck();

    const { db } = await getDb();

    // Fetch seekers
    const seekers = await db
      .collection("seekers")
      .find({}, { projection: { password: 0 } })
      .toArray();

    // Fetch providers
    const providers = await db
      .collection("providers")
      .find({}, { projection: { password: 0 } })
      .toArray();

    // Combine and add role field
    const users = [
      ...(seekers as unknown as UserDocument[]).map((s) => ({
        ...s,
        role: Role.SEEKER,
      })),
      ...(providers as unknown as UserDocument[]).map((p) => ({
        ...p,
        role: Role.PROVIDER,
      })),
    ].sort(
      (a, b) =>
        new Date((b as UserDocument).createdAt || 0).getTime() -
        new Date((a as UserDocument).createdAt || 0).getTime()
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
