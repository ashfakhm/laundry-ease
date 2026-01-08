import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { role } = await req.json();
  if (!role || ![Role.SEEKER, Role.PROVIDER].includes(role as Role)) {
    return NextResponse.json(
      { error: "Missing or invalid parameters" },
      { status: 400 }
    );
  }
  const { db } = await getDb();
  const collection = role === Role.PROVIDER ? "providers" : "seekers";
  const result = await db
    .collection(collection)
    .deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount === 1) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(
    { error: "User not found or not deleted" },
    { status: 404 }
  );
}
