import { NextResponse } from "next/server";
import { getBookingById } from "@/lib/db/index";
import { getDb } from "@/lib/mongodb";
import { createRazorpayOrder, verifyRazorpaySignature } from "@/lib/razorpay";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";
import { OrderItem } from "@/types/orders";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireSeeker } from "@/lib/api/auth";

type InvoiceLineItem = {
  itemType: string;
  quantity: number;
  unitPrice: number;
  photoUrl?: string;
};

function toObjectId(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

function appErrorResponse(error: AppError) {
  return NextResponse.json(
    {
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
    { status: error.statusCode },
  );
}

// POST: Create Razorpay Order for Invoice Amount
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "bookings:invoice-payment:init",
      max: 8,
      windowMs: 60 * 1000,
    });

    const session = await requireSeeker();
    if (!session?.user?.id || session.user.role !== Role.SEEKER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const booking_id = toObjectId(id);
    if (!booking_id) {
      return NextResponse.json({ message: "Invalid booking id" }, { status: 400 });
    }

    const booking = await getBookingById(booking_id);
    if (!booking) {
      return NextResponse.json({ message: "Booking not found" }, { status: 404 });
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

    const { db } = await getDb();
    const existingOrder = await db.collection("orders").findOne({ booking_id });
    if (existingOrder) {
      return NextResponse.json(
        {
          message: "Order already exists for this booking",
          orderId: existingOrder._id,
        },
        { status: 409 }
      );
    }

    // Calculate delivery charge from provider settings.
    const provider = await db
      .collection("providers")
      .findOne({ _id: new ObjectId(booking.provider_id.toString()) });

    let delivery_charge = 0;
    if (booking.seeker_coordinates && provider?.coordinates) {
      const { calculateDistance } = await import("@/lib/distance");
      const dist = calculateDistance(
        booking.seeker_coordinates,
        provider.coordinates
      );
      const freeRadius = provider.free_radius_km || 5;
      const perKmRate = provider.per_km_rate || 10;
      const extra = Math.max(0, dist - freeRadius);
      delivery_charge = Math.round(extra * perKmRate);
    }

    const itemsTotal = booking.invoice.items.reduce(
      (sum: number, item: InvoiceLineItem) => sum + item.quantity * item.unitPrice,
      0
    );
    const totalAmount = itemsTotal + delivery_charge;
    const amountInPaise = Math.round(totalAmount * 100);

    if (amountInPaise <= 0) {
      return NextResponse.json(
        { message: "Invalid invoice amount" },
        { status: 400 }
      );
    }

    const razorpayOrder = await createRazorpayOrder(amountInPaise, id);
    await db.collection("bookings").updateOne(
      { _id: booking_id },
      {
        $set: {
          razorpay_order_id: razorpayOrder.id,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return appErrorResponse(error);
    }

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
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "bookings:invoice-payment:verify",
      max: 10,
      windowMs: 60 * 1000,
    });

    const session = await requireSeeker();
    if (!session?.user?.id || session.user.role !== Role.SEEKER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const booking_id = toObjectId(id);
    if (!booking_id) {
      return NextResponse.json({ message: "Invalid booking id" }, { status: 400 });
    }

    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { message: "Missing payment fields" },
        { status: 400 }
      );
    }

    const { db } = await getDb();
    const booking = await getBookingById(booking_id);
    if (!booking) {
      return NextResponse.json({ message: "Booking not found" }, { status: 404 });
    }

    if (booking.seeker_id.toString() !== session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    // Idempotency: if booking already converted, return existing order.
    const bookingOrderId = (booking as { order_id?: ObjectId }).order_id;
    if (bookingOrderId) {
      return NextResponse.json({ success: true, orderId: bookingOrderId });
    }

    if (booking.status !== "invoice_created" || !booking.invoice) {
      return NextResponse.json(
        { message: "Booking is not in invoice payment state" },
        { status: 400 }
      );
    }

    if (!booking.razorpay_order_id || booking.razorpay_order_id !== razorpay_order_id) {
      return NextResponse.json({ message: "Razorpay order mismatch" }, { status: 400 });
    }

    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return NextResponse.json({ message: "Invalid signature" }, { status: 400 });
    }

    const existingOrder = await db.collection("orders").findOne({ booking_id });
    if (existingOrder) {
      if (existingOrder.razorpay_payment_id === razorpay_payment_id) {
        return NextResponse.json({ success: true, orderId: existingOrder._id });
      }
      return NextResponse.json(
        { message: "Order already exists for this booking" },
        { status: 409 }
      );
    }

    const booking_coords = booking.seeker_coordinates;
    const provider = await db
      .collection("providers")
      .findOne({ _id: new ObjectId(booking.provider_id.toString()) });

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
      (item: InvoiceLineItem) => ({
        name: item.itemType,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_total: item.quantity * item.unitPrice,
      })
    );

    const total_price =
      processedItems.reduce((acc, item) => acc + item.line_total, 0) +
      delivery_charge;
    const platform_commission = total_price * 0.05;
    const provider_payout_amount = total_price - platform_commission;

    const now = new Date();
    const orderData = {
      booking_id,
      seeker_id: new ObjectId(booking.seeker_id.toString()),
      provider_id: new ObjectId(booking.provider_id.toString()),
      items: processedItems,
      total_price,
      delivery_distance_km,
      delivery_charge,
      deadline: booking.deadline ? new Date(booking.deadline) : undefined,
      payment_status: "paid",
      payment_made_at: now,
      process_status: "invoiced",
      platform_commission,
      provider_payout_amount,
      razorpay_order_id,
      razorpay_payment_id,
      payout_status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    const res = await db.collection("orders").insertOne(orderData);
    await db.collection("bookings").updateOne(
      { _id: booking_id, status: "invoice_created" },
      {
        $set: {
          status: "completed",
          order_id: res.insertedId,
          updatedAt: now,
        },
      }
    );

    return NextResponse.json({ success: true, orderId: res.insertedId });
  } catch (error) {
    if (error instanceof AppError) {
      return appErrorResponse(error);
    }

    logger.error("BOOKINGS", "Payment verification error", error, {
      bookingId: id,
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
