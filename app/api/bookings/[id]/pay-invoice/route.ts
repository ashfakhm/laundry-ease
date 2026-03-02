import { successResponse, errorResponse } from "@/lib/api/response";
import { getBookingById } from "@/lib/db/index";
import { getDb } from "@/lib/mongodb";
import { createRazorpayOrder, verifyRazorpaySignature } from "@/lib/razorpay";
import { ObjectId } from "mongodb";
import { OrderItem } from "@/types/orders";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireSeeker } from "@/lib/api/auth";
import { paymentVerifySchema } from "@/lib/api/schemas";
import {
  PLATFORM_COMMISSION_RATE,
  RATE_LIMIT_DEFAULT_WINDOW_MS,
} from "@/lib/constants";
import { finalizeInvoiceOrder } from "@/lib/services/invoice-finalization";
import { computeDeliveryCharge } from "@/lib/utils/delivery-charge";
import { round2 } from "@/lib/utils/monetary";

type InvoiceLineItem = {
  itemType: string;
  quantity: number;
  unitPrice: number;
  photoUrl?: string;
};

function toObjectId(id: string): ObjectId | null {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

function fail(message: string, status: number) {
  const codeMap: Record<number, ErrorCode> = {
    400: ErrorCode.VALIDATION_ERROR,
    403: ErrorCode.FORBIDDEN,
    404: ErrorCode.NOT_FOUND,
    409: ErrorCode.CONFLICT,
    500: ErrorCode.INTERNAL_ERROR,
  };
  return errorResponse(
    new AppError(codeMap[status] || ErrorCode.INTERNAL_ERROR, status, message),
  );
}

// POST: Create Razorpay Order for Invoice Amount
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "bookings:invoice-payment:init",
      max: 8,
      windowMs: RATE_LIMIT_DEFAULT_WINDOW_MS,
    });

    const { user } = await requireSeeker();

    const booking_id = toObjectId(id);
    if (!booking_id) {
      return fail("Invalid booking id", 400);
    }

    const booking = await getBookingById(booking_id);
    if (!booking) {
      return fail("Booking not found", 404);
    }

    if (booking.seeker_id.toString() !== user.id) {
      return fail("Unauthorized", 403);
    }

    if (booking.status !== "invoice_created" || !booking.invoice) {
      return fail("Invoice not ready for payment", 400);
    }

    const { db } = await getDb();
    const existingOrder = await db.collection("orders").findOne({ booking_id });
    if (existingOrder) {
      return errorResponse(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          "Order already exists for this booking",
        ),
      );
    }

    const provider = await db
      .collection("providers")
      .findOne({ _id: new ObjectId(booking.provider_id.toString()) });

    const { charge: delivery_charge } = computeDeliveryCharge(
      booking.seeker_coordinates,
      provider?.coordinates,
      provider?.free_radius_km,
      provider?.per_km_rate,
    );

    const itemsTotal = booking.invoice.items.reduce(
      (sum: number, item: InvoiceLineItem) =>
        sum + item.quantity * item.unitPrice,
      0,
    );
    const invoiceSubtotal: number = booking.invoice.subtotal ?? itemsTotal;
    const invoiceDiscount: number = booking.invoice.discount ?? 0;
    const totalAmount =
      Math.max(0, invoiceSubtotal - invoiceDiscount) + delivery_charge;
    const amountInPaise = Math.round(totalAmount * 100);

    if (amountInPaise <= 0) {
      return fail("Invalid invoice amount", 400);
    }

    const razorpayOrder = await createRazorpayOrder(amountInPaise, id);
    await db.collection("bookings").updateOne(
      { _id: booking_id },
      {
        $set: {
          razorpay_order_id: razorpayOrder.id,
          updatedAt: new Date(),
        },
      },
    );

    return successResponse({
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("BOOKINGS", "Payment init error", error, { bookingId: id });
    return fail("Internal server error", 500);
  }
}

// PUT: Verify Payment and Create Order
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "bookings:invoice-payment:verify",
      max: 10,
      windowMs: RATE_LIMIT_DEFAULT_WINDOW_MS,
    });

    const { user } = await requireSeeker();

    const booking_id = toObjectId(id);
    if (!booking_id) {
      return fail("Invalid booking id", 400);
    }

    const body = await req.json().catch(() => null);
    const parsed = paymentVerifySchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid payment fields", 400);
    }
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      parsed.data;

    const { db, client } = await getDb();
    const booking = await getBookingById(booking_id);
    if (!booking) {
      return fail("Booking not found", 404);
    }

    if (booking.seeker_id.toString() !== user.id) {
      return fail("Unauthorized", 403);
    }

    // Idempotency: if booking already converted, return existing order.
    const bookingOrderId = (booking as { order_id?: ObjectId }).order_id;
    if (bookingOrderId) {
      return successResponse({ orderId: bookingOrderId });
    }

    if (booking.status !== "invoice_created" || !booking.invoice) {
      return fail("Booking is not in invoice payment state", 400);
    }

    if (
      !booking.razorpay_order_id ||
      booking.razorpay_order_id !== razorpay_order_id
    ) {
      return fail("Razorpay order mismatch", 400);
    }

    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!isValid) {
      return fail("Invalid signature", 400);
    }

    const existingOrder = await db.collection("orders").findOne({ booking_id });
    if (existingOrder) {
      if (existingOrder.razorpay_payment_id === razorpay_payment_id) {
        return successResponse({ orderId: existingOrder._id });
      }
      return errorResponse(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          "Order already exists for this booking",
        ),
      );
    }

    const provider = await db
      .collection("providers")
      .findOne({ _id: new ObjectId(booking.provider_id.toString()) });

    const { distanceKm: delivery_distance_km, charge: delivery_charge } =
      computeDeliveryCharge(
        booking.seeker_coordinates,
        provider?.coordinates,
        provider?.free_radius_km,
        provider?.per_km_rate,
      );

    const processedItems: OrderItem[] = booking.invoice.items.map(
      (item: InvoiceLineItem) => ({
        name: item.itemType,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_total: item.quantity * item.unitPrice,
      }),
    );

    const subtotal: number =
      booking.invoice.subtotal ??
      processedItems.reduce((acc, item) => acc + item.line_total, 0);
    const discount: number = booking.invoice.discount ?? 0;
    const total_price = Math.max(0, subtotal - discount) + delivery_charge;
    // Platform commission is always 5% of the pre-discount subtotal
    const platform_commission = round2(subtotal * PLATFORM_COMMISSION_RATE);
    const provider_payout_amount = round2(total_price - platform_commission);

    const now = new Date();
    const orderData = {
      booking_id,
      seeker_id: new ObjectId(booking.seeker_id.toString()),
      provider_id: new ObjectId(booking.provider_id.toString()),
      items: processedItems,
      subtotal,
      discount,
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

    const finalized = await finalizeInvoiceOrder({
      db,
      client,
      bookingId: booking_id,
      orderData,
      now,
      domain: "BOOKINGS",
      duplicateCheck: {
        field: "razorpay_payment_id",
        value: razorpay_payment_id,
      },
    });

    return successResponse({
      orderId: finalized.orderId,
      ...(finalized.idempotent ? { idempotent: true } : {}),
    });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("BOOKINGS", "Payment verification error", error, {
      bookingId: id,
    });
    return fail("Internal server error", 500);
  }
}
