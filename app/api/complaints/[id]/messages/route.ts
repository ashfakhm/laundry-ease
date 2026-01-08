import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { getUserByEmail } from "@/lib/db";
import { ComplaintMessage } from "@/types/complaints";
import { Role } from "@/types/enums";
import { logger } from "@/lib/logger";
import { complaintMessageSchema } from "@/lib/api/schemas";

async function checkAccess(userId: string, userRole: string, complaint: any) {
  const isSeeker = complaint.seeker_id.toString() === userId;
  const isProvider = complaint.provider_id.toString() === userId;
  const isAdmin = userRole === Role.ADMIN;

  // 1. Audit Visibility Guard
  // "Seeker/provider NEVER can after resolution"
  const isResolved = ["resolved", "rejected"].includes(complaint.status);

  if (isResolved && !isAdmin) {
    return {
      allowed: false,
      error: "Dispute is resolved. Access is restricted to Admin only.",
    };
  }

  // 2. Participation Guard
  if (isAdmin) return { allowed: true, role: "admin" };

  if (isSeeker) return { allowed: true, role: "seeker" };

  if (isProvider) {
    if (!complaint.provider_access_granted) {
      return { allowed: false, error: "Provider access has not been granted." };
    }
    return { allowed: true, role: "provider" };
  }

  return { allowed: false, error: "Forbidden" };
}

/**
 * GET /api/complaints/[id]/messages
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();
    const complaintId = new ObjectId(id);

    const complaint = await db
      .collection("complaints")
      .findOne({ _id: complaintId });
    if (!complaint) {
      return NextResponse.json(
        { error: "Complaint not found" },
        { status: 404 }
      );
    }

    // Robust Role Check
    const dbUser = await getUserByEmail(session.user.email);
    const userRole = dbUser?.role || Role.SEEKER; // Fallback, but getUserByEmail returns correct role

    const access = await checkAccess(session.user.id, userRole, complaint);
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    // Fetch Messages
    const messages = await db
      .collection("complaint_messages")
      .find({ complaint_id: complaintId })
      .sort({ createdAt: 1 })
      .toArray();

    return NextResponse.json(messages);
  } catch (error) {
    logger.error("COMPLAINTS", "Error fetching messages", error, {
      complaintId: id,
    });
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

/**
 * POST /api/complaints/[id]/messages
 * Body: { content, attachments }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = complaintMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid message data",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { content, attachments } = parsed.data;

    const { db } = await getDb();
    const complaintId = new ObjectId(id);

    const complaint = await db
      .collection("complaints")
      .findOne({ _id: complaintId });
    if (!complaint) {
      return NextResponse.json(
        { error: "Complaint not found" },
        { status: 404 }
      );
    }

    const dbUser = await getUserByEmail(session.user.email);
    const userRole = dbUser?.role || Role.SEEKER;

    const access = await checkAccess(session.user.id, userRole, complaint);
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    // Construct Message
    // FORCE message_type = TEXT (or IMAGE if only attachments).
    // User CANNOT send SYSTEM messages.

    const message: Omit<ComplaintMessage, "_id"> = {
      complaint_id: complaintId,
      sender_id: new ObjectId(session.user.id),
      sender_role: access.role as "seeker" | "provider" | "admin",
      message_type: "TEXT",
      content,
      attachments: attachments || [],
      createdAt: new Date(),
    };

    await db.collection("complaint_messages").insertOne(message);

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    logger.error("COMPLAINTS", "Error creating message", error, {
      complaintId: id,
    });
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
