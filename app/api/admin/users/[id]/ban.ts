import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = params;
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
    .updateOne({ _id: id }, { $set: { blocked_until } });
  if (result.modifiedCount === 1) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(
    { error: "User not found or not updated" },
    { status: 404 }
  );
}
