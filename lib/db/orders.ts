import { Order, OrderItem } from "@/types/orders";
import { Seeker } from "@/types/users";
import { getDb } from "../mongodb";
import { ObjectId } from "mongodb";
import { ESCROW_RELEASE_WINDOW_MS } from "@/lib/constants";

/**
 * Create a new order
 */
export async function createOrder(data: {
  booking_id: ObjectId;
  seeker_id: ObjectId;
  provider_id: ObjectId;
  items: OrderItem[];
  total_price: number;
  delivery_distance_km?: number;
  delivery_charge: number;
  deadline?: Date;
  platform_commission?: number;
  provider_payout_amount?: number;
}) {
  const { db } = await getDb();
  const now = new Date();

  const order: Omit<Order, "_id"> = {
    booking_id: data.booking_id,
    seeker_id: data.seeker_id,
    provider_id: data.provider_id,
    items: data.items,
    total_price: data.total_price,
    delivery_distance_km: data.delivery_distance_km,
    delivery_charge: data.delivery_charge,
    platform_commission: data.platform_commission,
    provider_payout_amount: data.provider_payout_amount,
    payment_status: "unpaid",
    process_status: "invoiced",
    deadline: data.deadline,
    createdAt: now,
  };

  const res = await db
    .collection<Omit<Order, "_id">>("orders")
    .insertOne(order);
  return { ...order, _id: res.insertedId };
}

/**
 * Get an order by its ID
 */
export async function getOrderById(order_id: ObjectId): Promise<Order | null> {
  const { db } = await getDb();
  const order = await db.collection<Order>("orders").findOne({ _id: order_id });
  return order;
}

/**
 * Update an order's payment status
 * SECURITY: Cannot set status to "released" - must use releaseEscrowPayment() instead
 */
export async function updateOrderPaymentStatus(
  order_id: ObjectId,
  payment_status: "paid" | "held" | "refunded",
) {
  // "released" status is managed exclusively through releaseEscrowPayment() function
  const { db } = await getDb();
  const res = await db
    .collection<Order>("orders")
    .updateOne(
      { _id: order_id },
      { $set: { payment_status, payment_made_at: new Date() } },
    );
  return res.modifiedCount > 0;
}

/**
 * Confirm delivery and start escrow
 */
export async function confirmDelivery(order_id: ObjectId) {
  const { db } = await getDb();
  const now = new Date();
  const escrow_release_at = new Date(now.getTime() + ESCROW_RELEASE_WINDOW_MS);

  const res = await db.collection<Order>("orders").updateOne(
    { _id: order_id },
    {
      $set: {
        process_status: "delivered",
        payment_status: "held",
        otp_confirmed_at: now,
        escrow_started_at: now,
        escrow_release_at,
      },
    },
  );
  return res.modifiedCount > 0;
}

/**
 * Get all orders with status 'held' and escrow_release_at in the past
 */
export async function getHeldOrdersPastEscrowDate(): Promise<Order[]> {
  const { db } = await getDb();
  const now = new Date();
  const orders = await db
    .collection<Order>("orders")
    .find({
      payment_status: "held",
      escrow_release_at: { $lte: now },
    })
    .toArray();
  return orders;
}

/**
 * Cancel an order before payment
 */
export async function cancelOrder(
  order_id: ObjectId,
  seeker_id: ObjectId,
  cancellation_fee: number,
) {
  const { db } = await getDb();

  const orderCancelRes = await db
    .collection<Order>("orders")
    .updateOne(
      { _id: order_id, payment_status: "unpaid" },
      { $set: { cancellation_status: "cancelled_by_seeker" } },
    );

  if (orderCancelRes.modifiedCount === 0) {
    return false;
  }

  const seekerUpdateRes = await db.collection<Seeker>("seekers").updateOne(
    { _id: seeker_id },
    {
      $inc: { outstanding_fees: cancellation_fee },
      $set: { blocked_until: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) }, // Block for 30 days or until fee is paid
    },
  );

  return seekerUpdateRes.modifiedCount > 0;
}
