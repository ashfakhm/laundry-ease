import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { blocked_until, role } = await req.json();
  if (!blocked_until || !role || !["seeker", "provider"].includes(role)) {
    return NextResponse.json(
      { error: "Missing or invalid parameters" },
      { status: 400 }
    );
  }
  const { db } = await getDb();
  const collection = role === "provider" ? "providers" : "seekers";
  const result = await db
    .collection(collection)
    .updateOne({ _id: new ObjectId(id) }, { $set: { blocked_until } });
  if (result.modifiedCount === 1) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(
    { error: "User not found or not updated" },
    { status: 404 }
  );
}
