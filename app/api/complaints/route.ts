import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createComplaint, getOrderById } from "@/lib/db";
import { Role } from "@/types/enums";
import { ObjectId } from "mongodb";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== Role.SEEKER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { order_id, complaint_type, description, photos } = body;

    if (!order_id || !complaint_type || !description) {
      return NextResponse.json(
        { message: "Order ID, complaint type and description are required" },
        { status: 400 }
      );
    }

    const order = await getOrderById(new ObjectId(order_id));

    if (!order) {
      return NextResponse.json(
        { message: "Order not found" },
        { status: 404 }
      );
    }

    if (order.seeker_id.toString() !== session.user.id) {
      return NextResponse.json(
        { message: "You are not authorized to raise a complaint for this order" },
        { status: 403 }
      );
    }

    const complaint = await createComplaint({
      order_id: new ObjectId(order_id),
      seeker_id: new ObjectId(session.user.id),
      provider_id: order.provider_id,
      complaint_type,
      description,
      photos,
    });

    return NextResponse.json(complaint, { status: 201 });
  } catch (error) {
    console.error("Error creating complaint:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
