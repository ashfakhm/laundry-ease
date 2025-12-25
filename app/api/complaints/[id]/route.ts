import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { getUserByEmail } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();
    const complaintId = new ObjectId(id);

    const complaint = await db.collection("complaints").findOne({ _id: complaintId });
    if (!complaint) {
        return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
    }

    const userId = session.user.id;
    const dbUser = await getUserByEmail(session.user.email);
    const userRole = dbUser?.role || "seeker";

    const isSeeker = complaint.seeker_id.toString() === userId;
    const isProvider = complaint.provider_id.toString() === userId;
    const isAdmin = userRole === "admin";

    let allowed = false;
    if (isAdmin) allowed = true;
    else if (isSeeker) allowed = true;
    else if (isProvider && complaint.provider_access_granted) allowed = true;

    if (!allowed) {
        // Obscurity: if provider and not granted, maybe 404 or 403?
        // 403 tells them it exists. 
        // We'll say 403 "Access Denied".
        return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    return NextResponse.json(complaint);

  } catch (error) {
    console.error("Error fetching complaint:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
