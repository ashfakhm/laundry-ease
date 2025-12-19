import { Complaint } from "@/types/complaints";
import { Order, OrderItem } from "@/types/orders";
import { Booking } from "@/types/bookings";
import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { Role } from "@/types/enums";
import bcrypt from "bcrypt";

export type BaseUser = {
  _id?: ObjectId;
  email: string;
  name?: string | null;
  phone?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  passwordHash?: string | null;
  createdAt: Date;
};

export type Seeker = BaseUser & {
  address?: {
    line1: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    landmark?: string;
  } | null;
  outstanding_fees?: number;
  blocked_until?: Date;
};

export type Provider = BaseUser & {
  services?: string[];
  pricing?: number;
  location?: string;
  documents?: string[];
  radius_km?: number;
  per_km_rate?: number;
  covers_beyond_radius?: boolean;
};

export type Admin = BaseUser;

export type UserWithRole = (Seeker | Provider | Admin) & {
  role: Role;
};

/**
 * Find user by email across all collections (seekers → providers → admins)
 * Returns user with their role
 */
export async function getUserByEmail(
  email?: string | null
): Promise<UserWithRole | null> {
  if (!email) return null;
  const { db } = await getDb();

  // Check seekers collection first
  const seeker = await db.collection<Seeker>("seekers").findOne({ email });
  if (seeker) {
    return { ...seeker, role: Role.SEEKER };
  }

  // Check providers collection
  const provider = await db
    .collection<Provider>("providers")
    .findOne({ email });
  if (provider) {
    return { ...provider, role: Role.PROVIDER };
  }

  // Check admins collection
  const admin = await db.collection<Admin>("admins").findOne({ email });
  if (admin) {
    return { ...admin, role: Role.ADMIN };
  }

  return null;
}

/**
 * Check if email exists in any collection
 */
export async function emailExists(email: string): Promise<boolean> {
  const user = await getUserByEmail(email);
  return user !== null;
}

/**
 * Create a new seeker user
 */
export async function createSeeker(data: {
  email: string;
  name?: string | null;
  password?: string;
  phone?: string | null;
}) {
  const { db } = await getDb();
  const now = new Date();
  const passwordHash = data.password
    ? await bcrypt.hash(data.password, 10)
    : null;

  const seeker: Seeker = {
    email: data.email,
    name: data.name ?? null,
    phone: data.phone ?? null,
    passwordHash,
    emailVerified: false,
    phoneVerified: false,
    address: null,
    createdAt: now,
  };

  const res = await db.collection<Seeker>("seekers").insertOne(seeker);
  return { ...seeker, _id: res.insertedId };
}

/**
 * Create a new provider user
 */
export async function createProvider(data: {
  email: string;
  name?: string | null;
  password?: string;
  phone?: string | null;
  services?: string[];
  pricing?: number;
  location?: string;
}) {
  const { db } = await getDb();
  const now = new Date();
  const passwordHash = data.password
    ? await bcrypt.hash(data.password, 10)
    : null;

  const provider: Provider = {
    email: data.email,
    name: data.name ?? null,
    phone: data.phone ?? null,
    passwordHash,
    emailVerified: false,
    phoneVerified: false,
    services: data.services ?? [],
    pricing: data.pricing,
    location: data.location,
    documents: [],
    createdAt: now,
  };

  const res = await db.collection<Provider>("providers").insertOne(provider);
  return { ...provider, _id: res.insertedId };
}

/**
 * Create a new booking
 */
export async function createBooking(data: {
  seeker_id: ObjectId;
  provider_id: ObjectId;
}) {
  const { db } = await getDb();
  const now = new Date();

  const booking: Omit<Booking, "_id"> = {
    seeker_id: data.seeker_id,
    provider_id: data.provider_id,
    status: "requested",
    createdAt: now,
  };

  const res = await db.collection<Omit<Booking, "_id">>("bookings").insertOne(booking);
  return { ...booking, _id: res.insertedId };
}

/**
 * Get a booking by its ID
 */
export async function getBookingById(booking_id: ObjectId): Promise<Booking | null> {
  const { db } = await getDb();
  const booking = await db.collection<Booking>("bookings").findOne({ _id: booking_id });
  return booking;
}

/**
 * Update a booking's status
 */
export async function updateBookingStatus(
  booking_id: ObjectId,
  status: "accepted" | "rejected"
) {
  const { db } = await getDb();
  const res = await db
    .collection<Booking>("bookings")
    .updateOne({ _id: booking_id }, { $set: { status } });
  return res.modifiedCount > 0;
}

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
        payment_status: "unpaid",
        createdAt: now,
    };

    const res = await db.collection<Omit<Order, "_id">>("orders").insertOne(order);
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
 */
export async function updateOrderPaymentStatus(
    order_id: ObjectId,
    payment_status: "paid" | "held" | "released" | "refunded"
) {
    const { db } = await getDb();
    const res = await db
        .collection<Order>("orders")
        .updateOne({ _id: order_id }, { $set: { payment_status, payment_made_at: new Date() } });
    return res.modifiedCount > 0;
}

/**
 * Confirm delivery and start escrow
 */
export async function confirmDelivery(order_id: ObjectId) {
  const { db } = await getDb();
  const now = new Date();
  const escrow_release_at = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

  const res = await db
    .collection<Order>("orders")
    .updateOne(
      { _id: order_id },
      {
        $set: {
          payment_status: "held",
          otp_confirmed_at: now,
          escrow_started_at: now,
          escrow_release_at,
        },
      }
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
 * Release escrow payment for an order
 */
export async function releaseEscrowPayment(order_id: ObjectId) {
  const { db } = await getDb();
  const res = await db
    .collection<Order>("orders")
    .updateOne({ _id: order_id }, { $set: { payment_status: "released" } });
  return res.modifiedCount > 0;
}

/**
 * Cancel an order before payment
 */
export async function cancelOrder(order_id: ObjectId, seeker_id: ObjectId, cancellation_fee: number) {
    const { db } = await getDb();
    
    const orderCancelRes = await db.collection<Order>("orders").updateOne(
        { _id: order_id, payment_status: "unpaid" },
        { $set: { cancellation_status: "cancelled_by_seeker" } }
    );

    if (orderCancelRes.modifiedCount === 0) {
        return false;
    }

    const seekerUpdateRes = await db.collection<Seeker>("seekers").updateOne(
        { _id: seeker_id },
        { 
            $inc: { outstanding_fees: cancellation_fee },
            $set: { blocked_until: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) } // Block for 30 days or until fee is paid
        }
    );

    return seekerUpdateRes.modifiedCount > 0;
}

/**
 * Create a new complaint
 */
export async function createComplaint(data: {
    order_id: ObjectId;
    seeker_id: ObjectId;
    provider_id: ObjectId;
    complaint_type: string;
    description: string;
    photos?: string[];
}) {
    const { db } = await getDb();
    const now = new Date();

    const complaint: Omit<Complaint, "_id"> = {
        order_id: data.order_id,
        seeker_id: data.seeker_id,
        provider_id: data.provider_id,
        complaint_type: data.complaint_type,
        description: data.description,
        photos: data.photos,
        status: "open",
        createdAt: now,
    };

    const res = await db.collection<Omit<Complaint, "_id">>("complaints").insertOne(complaint);
    return { ...complaint, _id: res.insertedId };
}


// Note: admin creation and profile update helpers used to live here.
// They have been removed for now because they were unused. Reintroduce
// them alongside the first real admin/profile management features.
