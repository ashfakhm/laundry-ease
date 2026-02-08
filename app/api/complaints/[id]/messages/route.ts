import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { getUserByEmail } from "@/lib/db";
import { ComplaintMessage } from "@/types/complaints";
import { Role } from "@/types/enums";
import { logger } from "@/lib/logger";
import { complaintMessageSchema } from "@/lib/api/schemas";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";

type ComplaintAccessDoc = {
  seeker_id: ObjectId;
  provider_id: ObjectId;
  provider_access_granted?: boolean;
  status: string;
};

function checkAccess(
  actorId: ObjectId,
  userRole: Role,
  complaint: ComplaintAccessDoc,
) {
  const actorIdStr = actorId.toString();
  const isSeeker = complaint.seeker_id.toString() === actorIdStr;
  const isProvider = complaint.provider_id.toString() === actorIdStr;
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid complaint ID" }, { status: 400 });
    }

    const dbUser = await getUserByEmail(session.user.email);
    if (!dbUser?._id || !dbUser.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actorId = new ObjectId(dbUser._id);

    const { db } = await getDb();
    const complaintId = new ObjectId(id);

    const complaint = await db
      .collection<ComplaintAccessDoc>("complaints")
      .findOne({ _id: complaintId });
    if (!complaint) {
      return NextResponse.json(
        { error: "Complaint not found" },
        { status: 404 }
      );
    }

    const access = checkAccess(actorId, dbUser.role, complaint);
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
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "complaints:messages:create",
      max: 25,
      windowMs: 60 * 1000,
    });

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid complaint ID" }, { status: 400 });
    }

    const dbUser = await getUserByEmail(session.user.email);
    if (!dbUser?._id || !dbUser.role) {
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
    const actorId = new ObjectId(dbUser._id);

    const { db } = await getDb();
    const complaintId = new ObjectId(id);

    const complaint = await db
      .collection<ComplaintAccessDoc>("complaints")
      .findOne({ _id: complaintId });
    if (!complaint) {
      return NextResponse.json(
        { error: "Complaint not found" },
        { status: 404 }
      );
    }

    const access = checkAccess(actorId, dbUser.role, complaint);
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    // Construct Message
    // FORCE message_type = TEXT (or IMAGE if only attachments).
    // User CANNOT send SYSTEM messages.

    const message: Omit<ComplaintMessage, "_id"> = {
      complaint_id: complaintId,
      sender_id: actorId,
      sender_role: access.role as "seeker" | "provider" | "admin",
      message_type: "TEXT",
      content,
      attachments: attachments || [],
      createdAt: new Date(),
    };

    await db.collection("complaint_messages").insertOne(message);

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.statusCode },
      );
    }

    logger.error("COMPLAINTS", "Error creating message", error, {
      complaintId: id,
    });
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
