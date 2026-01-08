import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { getUserByEmail } from "@/lib/db";
import { ComplaintMessage } from "@/types/complaints";
import { Role } from "@/types/enums";
import { logger } from "@/lib/logger";
import { adminComplaintAccessSchema } from "@/lib/api/schemas";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify Admin
    const dbUser = await getUserByEmail(session.user.email);
    if (dbUser?.role !== Role.ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = adminComplaintAccessSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid access data",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { granted } = parsed.data;
    const { db } = await getDb();
    const complaintId = new ObjectId(id);

    const complaint = await db
      .collection("complaints")
      .findOne({ _id: complaintId });
    if (!complaint)
      return NextResponse.json({ error: "Not Found" }, { status: 404 });

    const providerId = complaint.provider_id;

    // Update Access
    await db.collection("complaints").updateOne(
      { _id: complaintId },
      {
        $set: {
          provider_access_granted: granted,
          status: granted ? "in_review" : complaint.status, // Update status if granting
        },
        $addToSet: { participants: providerId }, // Ensure provider is in participants
      }
    );

    // System Message
    const systemMsg: Omit<ComplaintMessage, "_id"> = {
      complaint_id: complaintId,
      sender_id: new ObjectId(session.user.id), // Admin ID
      sender_role: "system",
      message_type: "SYSTEM",
      content: granted
        ? "Admin added Provider to the chat."
        : "Admin revoked Provider access.",
      createdAt: new Date(),
    };

    await db.collection("complaint_messages").insertOne(systemMsg);

    return NextResponse.json({ success: true, granted });
  } catch (error) {
    logger.error("ADMIN_COMPLAINTS", "Error updating access", error, {
      complaintId: id,
    });
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
