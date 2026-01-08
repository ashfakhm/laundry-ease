import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getBookingById, createOrder, getUserByEmail } from "@/lib/db";
import { getDb } from "@/lib/mongodb";
import { createRazorpayOrder, verifyRazorpaySignature } from "@/lib/razorpay";
import { ObjectId } from "mongodb";
import { calculateDistance } from "@/lib/distance";
import { Role } from "@/types/enums";
import { OrderItem } from "@/types/orders";
import { logger } from "@/lib/logger";

// POST: Create Razorpay Order for Invoice Amount
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    if (booking.seeker_id.toString() !== session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    if (booking.status !== "invoice_created" || !booking.invoice) {
      return NextResponse.json(
        { message: "Invoice not ready for payment" },
        { status: 400 }
      );
    }

    // Calculate Delivery (Duplicated logic for consistency)
    const { db } = await getDb();
    const provider = await db.collection("providers").findOne({ _id: new ObjectId(booking.provider_id) });
    
    let delivery_charge = 0;
    if (booking.seeker_coordinates && provider?.coordinates) {
      const { calculateDistance } = await import("@/lib/distance");
      const dist = calculateDistance(booking.seeker_coordinates, provider.coordinates);
      const freeRadius = provider.free_radius_km || 5;
      const perKmRate = provider.per_km_rate || 10;
      const extra = Math.max(0, dist - freeRadius);
      delivery_charge = Math.round(extra * perKmRate);
    }

    const itemsTotal = booking.invoice.items.reduce(
      (sum: number, item: any) => sum + item.quantity * item.unitPrice,
      0
    );
    const totalAmount = itemsTotal + delivery_charge;
    
    const amountInPaise = Math.round(totalAmount * 100);

    const razorpayOrder = await createRazorpayOrder(amountInPaise, id); // id is booking_id

    return NextResponse.json({
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    });
  } catch (error) {
    logger.error("BOOKINGS", "Payment init error", error, { bookingId: id });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT: Verify Payment and Create Order
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return NextResponse.json(
        { message: "Invalid signature" },
        { status: 400 }
      );
    }

    const booking_id = new ObjectId(id);
    const booking = await getBookingById(booking_id);
    if (!booking || !booking.invoice) throw new Error("Booking invalid state");

    // --- LOGIC MOVED FROM api/orders/route.ts ---
    // 1. Calculate Delivery
    const booking_coords = booking.seeker_coordinates;
    const { db } = await import("@/lib/mongodb").then((m) => m.getDb());
    const provider = await db
      .collection("providers")
      .findOne({ _id: new ObjectId(booking.provider_id) });
      
    let delivery_distance_km = 0;
    let delivery_charge = 0;
    if (booking_coords && provider?.coordinates) {
      const { calculateDistance } = await import("@/lib/distance");
      delivery_distance_km = calculateDistance(
        booking_coords,
        provider.coordinates
      );
      const freeRadius = provider.free_radius_km || 5;
      const perKmRate = provider.per_km_rate || 10;
      const extraDistance = Math.max(0, delivery_distance_km - freeRadius);
      delivery_charge = Math.round(extraDistance * perKmRate);
    }

    const processedItems: OrderItem[] = booking.invoice.items.map(
      (item: any) => ({
        name: item.itemType, // Mapping 'itemType' from Invoice to 'name' in OrderItem
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_total: item.quantity * item.unitPrice,
      })
    );

    const total_price =
      processedItems.reduce((acc, item) => acc + item.line_total, 0) +
      delivery_charge;

    // Commission Split (5%)
    const platform_commission = total_price * 0.05;
    const provider_payout_amount = total_price - platform_commission;

    const now = new Date();

    const orderData: any = {
      booking_id: booking_id,
      seeker_id: new ObjectId(booking.seeker_id.toString()),
      provider_id: new ObjectId(booking.provider_id.toString()),
      items: processedItems,
      total_price,
      delivery_distance_km,
      delivery_charge,
      deadline: booking.deadline ? new Date(booking.deadline) : undefined,
      
      // Payment & Escrow
      payment_status: "paid", 
      payment_made_at: now,
      process_status: "invoiced", // Start status
      
      escrow_started_at: undefined, // Starts on Delivery? Or Now? User said "After provider completes delivery... Escrow timer starts"
      // But payment is held NOW. 
      // We will leave escrow_started_at undefined until delivery.
      
      platform_commission,
      provider_payout_amount,
      razorpay_order_id,
      razorpay_payment_id,
      payout_status: "pending",
      createdAt: now
    };

    const res = await db.collection("orders").insertOne(orderData);

    return NextResponse.json({ success: true, orderId: res.insertedId });
  } catch (error) {
    logger.error("BOOKINGS", "Payment verification error", error, { bookingId: id });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
