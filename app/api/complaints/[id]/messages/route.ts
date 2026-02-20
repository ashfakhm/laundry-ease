import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { ComplaintMessage } from "@/types/complaints";
import { logger } from "@/lib/logger";
import { complaintMessageSchema } from "@/lib/api/schemas";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { canAccessComplaintConversation } from "@/lib/complaints/access";
import { requireAuth } from "@/lib/api/auth";

type ComplaintAccessDoc = {
  seeker_id: ObjectId;
  provider_id: ObjectId;
  provider_access_granted?: boolean;
  status: string;
};

const DEFAULT_MESSAGES_LIMIT = 100;
const MAX_MESSAGES_LIMIT = 250;

function parseMessagesLimit(rawLimit: string | null): number {
  if (!rawLimit) return DEFAULT_MESSAGES_LIMIT;
  const value = Number(rawLimit);
  if (!Number.isFinite(value) || value < 1) {
    return DEFAULT_MESSAGES_LIMIT;
  }
  return Math.min(MAX_MESSAGES_LIMIT, Math.floor(value));
}

function parseSinceParam(rawSince: string | null): Date | null {
  if (!rawSince) return null;
  const since = new Date(rawSince);
  if (Number.isNaN(since.getTime())) {
    return null;
  }
  return since;
}

/**
 * GET /api/complaints/[id]/messages
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const { user } = await requireAuth();
    if (!user?.id || !ObjectId.isValid(user.id) || !user.role) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          message: "Unauthorized",
          error: { code: "ERROR", message: "Unauthorized" },
        },
        { status: 401 },
      );
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          message: "Invalid complaint ID",
          error: { code: "ERROR", message: "Invalid complaint ID" },
        },
        { status: 400 },
      );
    }

    const requestUrl = new URL(req.url);
    const sinceRaw = requestUrl.searchParams.get("since");
    const since = parseSinceParam(sinceRaw);
    if (sinceRaw && !since) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          message: "Invalid since timestamp",
          error: { code: "ERROR", message: "Invalid since timestamp" },
        },
        { status: 400 },
      );
    }
    const limit = parseMessagesLimit(requestUrl.searchParams.get("limit"));

    const actorId = new ObjectId(user.id);

    const { db } = await getDb();
    const complaintId = new ObjectId(id);

    const complaint = await db
      .collection<ComplaintAccessDoc>("complaints")
      .findOne({ _id: complaintId });
    if (!complaint) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          message: "Complaint not found",
          error: { code: "ERROR", message: "Complaint not found" },
        },
        { status: 404 },
      );
    }

    const access = canAccessComplaintConversation({
      actorId: actorId.toString(),
      actorRole: user.role,
      complaint: {
        seekerId: complaint.seeker_id.toString(),
        providerId: complaint.provider_id.toString(),
        providerAccessGranted: complaint.provider_access_granted,
        status: complaint.status,
      },
    });
    if (!access.allowed) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          message: access.error,
          error: { code: "ERROR", message: access.error },
        },
        { status: 403 },
      );
    }

    // Fetch Messages
    const messageQuery: {
      complaint_id: ObjectId;
      createdAt?: { $gt: Date };
      message_type?: { $ne: string };
    } = {
      complaint_id: complaintId,
    };
    if (since) {
      messageQuery.createdAt = { $gt: since };
    }
    // Hide internal system messages (error logs, financial details) from non-admin users
    if (user.role !== "admin") {
      messageQuery.message_type = { $ne: "SYSTEM" };
    }

    const messages = await db
      .collection("complaint_messages")
      .find(messageQuery)
      .sort({ createdAt: 1 })
      .limit(limit)
      .toArray();

    return NextResponse.json(messages);
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

    logger.error("COMPLAINTS", "Error fetching messages", error, {
      complaintId: id,
    });
    return NextResponse.json(
      {
        success: false,
        ok: false,
        message: "Internal Error",
        error: { code: "ERROR", message: "Internal Error" },
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/complaints/[id]/messages
 * Body: { content, attachments }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "complaints:messages:create",
      max: 25,
      windowMs: 60 * 1000,
    });

    const { user } = await requireAuth();
    if (!user?.id || !ObjectId.isValid(user.id) || !user.role) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          message: "Unauthorized",
          error: { code: "ERROR", message: "Unauthorized" },
        },
        { status: 401 },
      );
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          message: "Invalid complaint ID",
          error: { code: "ERROR", message: "Invalid complaint ID" },
        },
        { status: 400 },
      );
    }

    const body = await req.json();
    const parsed = complaintMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          message: "Invalid message data",
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid message data",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      );
    }

    const content = parsed.data.content?.trim() || "";
    const attachments = parsed.data.attachments || [];
    const actorId = new ObjectId(user.id);

    const { db } = await getDb();
    const complaintId = new ObjectId(id);

    const complaint = await db
      .collection<ComplaintAccessDoc>("complaints")
      .findOne({ _id: complaintId });
    if (!complaint) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          message: "Complaint not found",
          error: { code: "ERROR", message: "Complaint not found" },
        },
        { status: 404 },
      );
    }

    const access = canAccessComplaintConversation({
      actorId: actorId.toString(),
      actorRole: user.role,
      complaint: {
        seekerId: complaint.seeker_id.toString(),
        providerId: complaint.provider_id.toString(),
        providerAccessGranted: complaint.provider_access_granted,
        status: complaint.status,
      },
    });
    if (!access.allowed) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          message: access.error,
          error: { code: "ERROR", message: access.error },
        },
        { status: 403 },
      );
    }

    // Construct Message
    // FORCE message_type = TEXT (or IMAGE if only attachments).
    // User CANNOT send SYSTEM messages.

    const message: Omit<ComplaintMessage, "_id"> = {
      complaint_id: complaintId,
      sender_id: actorId,
      sender_role: access.role,
      message_type:
        attachments.length > 0 && content.length === 0 ? "IMAGE" : "TEXT",
      content,
      attachments,
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
    return NextResponse.json(
      {
        success: false,
        ok: false,
        message: "Internal Error",
        error: { code: "ERROR", message: "Internal Error" },
      },
      { status: 500 },
    );
  }
}
