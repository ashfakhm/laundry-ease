import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserByEmail } from "@/lib/db";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { ComplaintMessage } from "@/types/complaints";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify Admin
    const dbUser = await getUserByEmail(session.user.email);
    if (!dbUser || dbUser.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { db } = await getDb();
    const complaintId = new ObjectId(id);

    const complaint = await db.collection("complaints").findOne({ _id: complaintId });
    if (!complaint) return NextResponse.json({ error: "Not Found" }, { status: 404 });

    // Check if provider already has access
    if (complaint.provider_access_granted) {
        return NextResponse.json({ error: "Provider already has access" }, { status: 400 });
    }

    // Update complaint to grant provider access
    await db.collection("complaints").updateOne(
        { _id: complaintId },
        { 
            $set: { provider_access_granted: true },
            $addToSet: { participants: complaint.provider_id } // Add to participants if not present
        }
    );

    // Get provider name for system message
    const provider = await db.collection("providers").findOne({ _id: complaint.provider_id });
    const providerName = provider?.businessName || provider?.name || "Provider";

    // Insert system message
    const systemMsg: Omit<ComplaintMessage, "_id"> = {
        complaint_id: complaintId,
        sender_id: dbUser!._id as ObjectId,
        sender_role: "system",
        message_type: "SYSTEM",
        content: `${providerName} has been added to this conversation by Admin`,
        createdAt: new Date()
    };
    
    await db.collection("complaint_messages").insertOne(systemMsg);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Error adding provider to complaint:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
