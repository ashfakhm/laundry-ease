import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { getUserByEmail } from "@/lib/db";
import { Role } from "@/types/enums";
import { logger } from "@/lib/logger";

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
    if (!dbUser?._id) {
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

    const actorId = dbUser._id.toString();
    const userRole = dbUser.role || Role.SEEKER;

    const isSeeker = complaint.seeker_id.toString() === actorId;
    const isProvider = complaint.provider_id.toString() === actorId;
    const isAdmin = userRole === Role.ADMIN;

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

    const [seeker, provider] = await Promise.all([
      db.collection("seekers").findOne(
        { _id: complaint.seeker_id },
        { projection: { name: 1 } },
      ),
      db.collection("providers").findOne(
        { _id: complaint.provider_id },
        { projection: { name: 1, businessName: 1 } },
      ),
    ]);

    return NextResponse.json({
      ...complaint,
      seeker: seeker
        ? {
            name: seeker.name || "Seeker",
          }
        : null,
      provider: provider
        ? {
            name: provider.name || "Provider",
            businessName: provider.businessName || null,
          }
        : null,
    });
  } catch (error) {
    logger.error("COMPLAINTS", "Error fetching complaint", error, {
      complaintId: id,
    });
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
