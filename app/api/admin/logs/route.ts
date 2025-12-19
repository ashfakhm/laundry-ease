import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();

    // Check if logs collection exists
    const collections = await db.listCollections({ name: "logs" }).toArray();

    if (collections.length === 0) {
      // Return empty array if logs collection doesn't exist yet
      return NextResponse.json([]);
    }

    const logs = await db
      .collection("logs")
      .find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Error fetching logs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Utility function to create log entries (can be used by other endpoints)
export async function createLog(
  level: "info" | "warning" | "error" | "success",
  action: string,
  message: string,
  userId?: string,
  userRole?: string,
  userName?: string,
  metadata?: Record<string, unknown>
) {
  try {
    const { db } = await getDb();

    await db.collection("logs").insertOne({
      level,
      action,
      message,
      user_id: userId,
      user_role: userRole,
      user_name: userName,
      metadata,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error creating log:", error);
  }
}
