import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { Role } from "@/types/enums";

interface UserDocument extends Record<string, unknown> {
  name: string;
  email: string;
  phone?: string;
  createdAt?: string;
  businessName?: string;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session || session.user.role !== Role.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const { logger } = await import("@/lib/logger");
    logger.error("ADMIN_USERS", "Error fetching users", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
