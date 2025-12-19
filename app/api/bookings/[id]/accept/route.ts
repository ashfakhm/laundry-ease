import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getBookingById, updateBookingStatus } from "@/lib/db";
import { Role } from "@/types/enums";
import { ObjectId } from "mongodb";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== Role.PROVIDER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const booking_id = new ObjectId(params.id);
    const booking = await getBookingById(booking_id);

    if (!booking) {
      return NextResponse.json(
        { message: "Booking not found" },
        { status: 404 }
      );
    }

    if (booking.provider_id.toString() !== session.user.id) {
      return NextResponse.json(
        { message: "You are not authorized to accept this booking" },
        { status: 403 }
      );
    }
    
    if (booking.status !== "requested") {
        return NextResponse.json(
          { message: "Booking has already been acted upon" },
          { status: 400 }
        );
    }

    const success = await updateBookingStatus(booking_id, "accepted");

    if (success) {
      return NextResponse.json({ message: "Booking accepted" });
    } else {
      return NextResponse.json(
        { message: "Failed to accept booking" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error accepting booking:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
