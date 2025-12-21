import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getBookingById } from "@/lib/db";
import { Role } from "@/types/enums";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { Booking } from "@/types/bookings";

// POST: Propose a Slot (Provider) or Confirm (Seeker)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const booking_id = new ObjectId(id);
    const booking = await getBookingById(booking_id);

    if (!booking) {
      return NextResponse.json(
        { message: "Booking not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { dateTime, action } = body;
    const { db } = await getDb();

    // Provider Proposes Slot
    if (session.user.role === Role.PROVIDER) {
      if (booking.provider_id.toString() !== session.user.id) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
      }

      await db.collection<Booking>("bookings").updateOne(
        { _id: booking_id },
        {
          $set: {
            status: "pickup_proposed",
            pickupSlot: {
              proposedBy: "provider",
              dateTime: new Date(dateTime),
            },
          },
        }
      );

      return NextResponse.json({ message: "Slot proposed" });
    }

    // Seeker Confirms Slot
    if (session.user.role === Role.SEEKER) {
      if (booking.seeker_id.toString() !== session.user.id) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
      }

      if (action === "confirm") {
        if (!booking.pickupSlot || !booking.pickupSlot.dateTime) {
          return NextResponse.json(
            { message: "No slot to confirm" },
            { status: 400 }
          );
        }

        await db.collection<Booking>("bookings").updateOne(
          { _id: booking_id },
          {
            $set: {
              status: "confirmed",
              "pickupSlot.confirmedAt": new Date(),
            },
          }
        );
        return NextResponse.json({ message: "Slot confirmed" });
      }
    }

    return NextResponse.json({ message: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error scheduling booking:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
