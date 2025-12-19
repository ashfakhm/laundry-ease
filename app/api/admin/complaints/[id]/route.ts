import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/**
 * PATCH /api/admin/complaints/:id
 * Update complaint status
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();

    // Verify admin
    const admin = await db
      .collection("admins")
      .findOne({ email: session.user.email });
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized - Admin only" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { status } = body;

    if (!["open", "in_progress", "resolved"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const result = await db
      .collection("complaints")
      .updateOne({ _id: new ObjectId(id) }, { $set: { status } });

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Complaint not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Error updating complaint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
