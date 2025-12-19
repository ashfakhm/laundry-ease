import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createBooking } from "@/lib/db";
import { Role } from "@/types/enums";
import { ObjectId } from "mongodb";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== Role.SEEKER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { provider_id } = body;

    if (!provider_id) {
      return NextResponse.json(
        { message: "Provider ID is required" },
        { status: 400 }
      );
    }

    const seeker_id = new ObjectId(session.user.id);
    const booking = await createBooking({
      seeker_id,
      provider_id: new ObjectId(provider_id),
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
