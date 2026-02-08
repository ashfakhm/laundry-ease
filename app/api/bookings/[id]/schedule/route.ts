import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { bookingScheduleSchema } from "@/lib/api/schemas";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "bookings:schedule",
      max: 30,
      windowMs: 5 * 60 * 1000,
    });

    const session = await getServerSession(authOptions);
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = bookingScheduleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid schedule data",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { dateTime, action } = parsed.data;

    let bookingId: ObjectId;
    try {
      bookingId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
    }

    const { db } = await getDb();
    const bookingQuery = { _id: bookingId };

    const booking = await db.collection("bookings").findOne(bookingQuery);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // If seeker is confirming the slot
    if (action === "confirm") {
      // Check if user is the seeker
      const seekerOr: Array<{ _id?: ObjectId; email?: string }> = [];
      if (session.user.id && ObjectId.isValid(String(session.user.id))) {
        seekerOr.push({ _id: new ObjectId(String(session.user.id)) });
      }
      if (session.user.email) {
        seekerOr.push({ email: session.user.email });
      }

      const seeker = await db.collection("seekers").findOne({ $or: seekerOr });
      if (!seeker) {
        return NextResponse.json(
          { error: "Seeker not found" },
          { status: 404 }
        );
      }
      if (booking.seeker_id.toString() !== seeker._id.toString()) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      if (booking.status !== "pickup_proposed") {
        return NextResponse.json(
          { error: "Slot can only be confirmed when pickup is proposed" },
          { status: 400 }
        );
      }
      // Confirm the slot
      await db.collection("bookings").updateOne(bookingQuery, {
        $set: {
          status: "confirmed",
          "pickupSlot.confirmedAt": new Date(),
        },
      });
      // NOTE: Provider notification on slot confirmation could be added here using existing Twilio/email infrastructure
      return NextResponse.json({ success: true });
    }

    // Otherwise, provider proposes a slot
    if (!dateTime) {
      return NextResponse.json(
        { error: "Date and time required" },
        { status: 400 }
      );
    }

    // Verify booking belongs to this provider
    const provider = await db
      .collection("providers")
      .findOne({ email: session.user.email });

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }
    if (booking.provider_id.toString() !== provider._id.toString()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (
      booking.status !== "accepted" &&
      booking.status !== "reschedule_requested"
    ) {
      return NextResponse.json(
        {
          error:
            "Slot can only be proposed for accepted bookings or reschedules",
        },
        { status: 400 }
      );
    }
    // Validate slot time
    const now = new Date();
    const slotTime = new Date(dateTime);
    const minTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    const deadline = booking.deadline ? new Date(booking.deadline) : null;
    if (slotTime < minTime) {
      return NextResponse.json(
        { error: "Pickup must be at least 2 hours from now" },
        { status: 400 }
      );
    }
    if (deadline && slotTime > deadline) {
      return NextResponse.json(
        { error: "Pickup cannot be after seeker's deadline" },
        { status: 400 }
      );
    }
    // Update booking with proposed pickup time
    await db.collection("bookings").updateOne(bookingQuery, {
      $set: {
        status: "pickup_proposed",
        pickupSlot: {
          proposedBy: "provider",
          dateTime: slotTime,
          confirmedAt: undefined,
        },
      },
    });

    // NOTE: Seeker notification on new pickup proposal could be added here using existing Twilio/email infrastructure

    return NextResponse.json({ success: true });
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

    logger.error("BOOKINGS", "Schedule pickup error", error, { bookingId: id });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
