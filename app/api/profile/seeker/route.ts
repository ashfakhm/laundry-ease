import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { Role } from "@/types/enums";

/**
 * GET /api/profile/seeker
 * Fetch seeker's profile information
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== Role.SEEKER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { db } = await getDb();
    const seeker = await db.collection("seekers").findOne(
      { email: session.user.email },
      {
        projection: {
          passwordHash: 0, // Exclude sensitive data
        },
      }
    );

    if (!seeker) {
      return NextResponse.json({ error: "Seeker not found" }, { status: 404 });
    }

    return NextResponse.json(seeker, { status: 200 });
  } catch (error) {
    console.error("Error fetching seeker profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
