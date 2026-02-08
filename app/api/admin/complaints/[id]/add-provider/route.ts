import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserByEmail } from "@/lib/db";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { ComplaintMessage } from "@/types/complaints";
import { Role } from "@/types/enums";
import { logger } from "@/lib/logger";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid complaint ID" }, { status: 400 });
    }

    // Verify Admin
    const dbUser = await getUserByEmail(session.user.email);
    if (!dbUser || dbUser.role !== Role.ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { db } = await getDb();
    const complaintId = new ObjectId(id);

    const complaint = await db
      .collection("complaints")
      .findOne({ _id: complaintId });
    if (!complaint)
      return NextResponse.json({ error: "Not Found" }, { status: 404 });

    if (complaint.status === "resolved" || complaint.status === "rejected") {
      return NextResponse.json(
        { error: "Cannot add provider after complaint is finalized" },
        { status: 409 },
      );
    }

    if (complaint.status !== "accepted" && complaint.status !== "in_review") {
      return NextResponse.json(
        { error: "Complaint must be accepted before adding provider" },
        { status: 409 },
      );
    }

    // Check if provider already has access
    if (complaint.provider_access_granted) {
      return NextResponse.json(
        { success: true, idempotent: true, message: "Provider already added" },
        { status: 200 },
      );
    }

    // Update complaint to grant provider access and change status to in_review
    await db.collection("complaints").updateOne(
      { _id: complaintId },
      {
        $set: {
          provider_access_granted: true,
          status: "in_review", // Move to in_review when provider is added
        },
        $addToSet: { participants: complaint.provider_id }, // Add to participants if not present
      },
    );

    // Get provider name for system message
    const provider = await db
      .collection("providers")
      .findOne({ _id: complaint.provider_id });
    const providerName = provider?.businessName || provider?.name || "Provider";

    // Insert system message
    const systemMsg: Omit<ComplaintMessage, "_id"> = {
      complaint_id: complaintId,
      sender_id: dbUser!._id as ObjectId,
      sender_role: "system",
      message_type: "SYSTEM",
      content: `${providerName} has been added to this conversation by Admin`,
      createdAt: new Date(),
    };

    await db.collection("complaint_messages").insertOne(systemMsg);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      "ADMIN_COMPLAINTS",
      "Error adding provider to complaint",
      error,
      { complaintId: id },
    );
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
