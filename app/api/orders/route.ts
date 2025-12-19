import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createOrder, getBookingById, getUserByEmail } from "@/lib/db";
import { Role } from "@/types/enums";
import { ObjectId } from "mongodb";
import { OrderItem } from "@/types/orders";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== Role.PROVIDER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { booking_id, items, seeker_location } = body;

    if (!booking_id || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { message: "Booking ID and items are required" },
        { status: 400 }
      );
    }

    const booking = await getBookingById(new ObjectId(booking_id));

    if (!booking) {
      return NextResponse.json(
        { message: "Booking not found" },
        { status: 404 }
      );
    }

    if (booking.provider_id.toString() !== session.user.id) {
      return NextResponse.json(
        {
          message: "You are not authorized to create an order for this booking",
        },
        { status: 403 }
      );
    }

    if (booking.status !== "accepted") {
      return NextResponse.json(
        { message: "Booking must be accepted before creating an order" },
        { status: 400 }
      );
    }

    // Calculate total price
    const total_price = items.reduce((acc: number, item: OrderItem) => {
      item.line_total = item.quantity * item.unit_price;
      return acc + item.line_total;
    }, 0);

    // TODO: Implement Haversine formula for distance calculation
    const delivery_distance_km = 10;

    const provider = await getUserByEmail(session.user.email);
    let delivery_charge = 0;
    if (provider && provider.role === Role.PROVIDER) {
      const providerData = provider as any;
      if (
        providerData.radius_km &&
        providerData.per_km_rate &&
        providerData.covers_beyond_radius
      ) {
        if (delivery_distance_km > providerData.radius_km) {
          delivery_charge =
            (delivery_distance_km - providerData.radius_km) *
            providerData.per_km_rate;
        }
      }
    }

    const order = await createOrder({
      booking_id: new ObjectId(booking_id),
      seeker_id: booking.seeker_id,
      provider_id: booking.provider_id,
      items,
      total_price,
      delivery_distance_km,
      delivery_charge,
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
