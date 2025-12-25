import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { getUserByEmail } from "@/lib/db";
import { ComplaintMessage } from "@/types/complaints";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify Admin
    const dbUser = await getUserByEmail(session.user.email);
    if (dbUser?.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { granted } = await req.json(); // true/false
    const { db } = await getDb();
    const complaintId = new ObjectId(id);

    const complaint = await db.collection("complaints").findOne({ _id: complaintId });
    if (!complaint) return NextResponse.json({ error: "Not Found" }, { status: 404 });

    const providerId = complaint.provider_id;

    // Update Access
    await db.collection("complaints").updateOne(
        { _id: complaintId },
        { 
            $set: { 
                provider_access_granted: granted,
                status: granted ? "in_review" : complaint.status // Update status if granting
            },
            $addToSet: { participants: providerId } // Ensure provider is in participants
        }
    );

    // System Message
    const systemMsg: Omit<ComplaintMessage, "_id"> = {
        complaint_id: complaintId,
        sender_id: new ObjectId(session.user.id), // Admin ID
        sender_role: "system",
        message_type: "SYSTEM",
        content: granted ? "Admin added Provider to the chat." : "Admin revoked Provider access.",
        createdAt: new Date()
    };
    
    await db.collection("complaint_messages").insertOne(systemMsg);

    return NextResponse.json({ success: true, granted });

  } catch (error) {
    console.error("Error updating access:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
