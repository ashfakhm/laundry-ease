import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = params;
  const { role } = await req.json();
  if (!role || !["seeker", "provider"].includes(role)) {
    return NextResponse.json(
      { error: "Missing or invalid parameters" },
      { status: 400 }
    );
  }
  const { db } = await getDb();
  const collection = role === "provider" ? "providers" : "seekers";
  const result = await db.collection(collection).deleteOne({ _id: id });
  if (result.deletedCount === 1) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(
    { error: "User not found or not deleted" },
    { status: 404 }
  );
}
