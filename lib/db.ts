import { Complaint } from "@/types/complaints";
import { Order, OrderItem } from "@/types/orders";
import { Booking } from "@/types/bookings";
import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { Role } from "@/types/enums";
import bcrypt from "bcrypt";
import {
  auditBookingStateChange,
  auditEscrowStateChange,
} from "./audit";

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
  coordinates?: { lat: number; lng: number };
  outstanding_fees?: number;
  blocked_until?: Date;
};

export type Provider = BaseUser & {
  services?: string[];
  pricing?: number;
  location?: string;
  coordinates?: { lat: number; lng: number };
  documents?: string[];
  radius_km?: number;
  per_km_rate?: number;
  covers_beyond_radius?: boolean;
  businessName?: string;
  bio?: string;
  description?: string;
  pricingRates?: Record<string, number>;
  free_radius_km?: number;
  capacity?: number; // Max concurrent bookings
  bankDetails?: {
    accountNumber: string;
    ifsc: string;
    accountHolderName: string;
    upiId?: string;
  };
  razorpay_fund_account_id?: string;
  razorpay_contact_id?: string;
  profilePicture?: string;
  bannerImage?: string;
  rating?: number;
  reviewCount?: number;
};

export type Admin = BaseUser;

export type UserWithRole = (Seeker | Provider | Admin) & {
  role: Role;
};

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find user by email across all collections (seekers → providers → admins)
 * Returns user with their role
 */
export async function getUserByEmail(
  email?: string | null,
): Promise<UserWithRole | null> {
  if (!email) return null;
  const { db } = await getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const caseInsensitiveQuery = {
    $regex: `^${escapeRegex(normalizedEmail)}$`,
    $options: "i",
  };

  // Check seekers collection first
  const seeker =
    (await db.collection<Seeker>("seekers").findOne({ email: normalizedEmail })) ||
    (await db.collection<Seeker>("seekers").findOne({
      email: caseInsensitiveQuery,
    }));
  if (seeker) {
    return { ...seeker, role: Role.SEEKER };
  }

  // Check providers collection
  const provider = await db
    .collection<Provider>("providers")
    .findOne({ email: normalizedEmail }) ||
    (await db.collection<Provider>("providers").findOne({
      email: caseInsensitiveQuery,
    }));
  if (provider) {
    return { ...provider, role: Role.PROVIDER };
  }

  // Check admins collection
  const admin =
    (await db.collection<Admin>("admins").findOne({ email: normalizedEmail })) ||
    (await db.collection<Admin>("admins").findOne({
      email: caseInsensitiveQuery,
    }));
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
  address?: {
    line1: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    landmark?: string;
  } | null;
  coordinates?: { lat: number; lng: number };
}) {
  const { db } = await getDb();
  const now = new Date();
  const passwordHash = data.password
    ? await bcrypt.hash(data.password, 10)
    : null;

  const seeker: Seeker = {
    email: data.email.trim().toLowerCase(),
    name: data.name ?? null,
    phone: data.phone ?? null,
    passwordHash,
    // Signup routes require OTP verification before user creation.
    emailVerified: true,
    phoneVerified: true,
    address: data.address ?? null,
    coordinates: data.coordinates,
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
  businessName?: string;
  bio?: string;
  description?: string;
  pricingRates?: Record<string, number>;
  radius_km?: number;
  free_radius_km?: number;
  per_km_rate?: number;
  capacity?: number;
  bankDetails: {
    accountHolderName: string;
    accountNumber: string;
    ifsc: string;
    upiId?: string;
  };
  profilePicture?: string;
  bannerImage?: string;
  coordinates?: { lat: number; lng: number };
}) {
  const { db } = await getDb();
  const now = new Date();
  const passwordHash = data.password
    ? await bcrypt.hash(data.password, 10)
    : null;

  const provider: Provider = {
    email: data.email.trim().toLowerCase(),
    name: data.name ?? null,
    phone: data.phone ?? null,
    passwordHash,
    // Signup routes require OTP verification before user creation.
    emailVerified: true,
    phoneVerified: true,
    services: data.services ?? [],
    pricing: data.pricing,
    location: data.location,
    businessName: data.businessName,
    bio: data.bio,
    description: data.description,
    pricingRates: data.pricingRates,
    radius_km: data.radius_km ?? 10,
    free_radius_km: data.free_radius_km ?? 5,
    per_km_rate: data.per_km_rate ?? 0,
    documents: [],
    createdAt: now,
    capacity: data.capacity ?? 100, // Default to 100 concurrent bookings if not provided
    bankDetails: data.bankDetails,
    profilePicture: data.profilePicture,
    bannerImage: data.bannerImage,
    coordinates: data.coordinates,
  };

  const res = await db.collection<Provider>("providers").insertOne(provider);
  return { ...provider, _id: res.insertedId };
}

// Booking type is imported from @/types/bookings

export type Review = {
  _id?: ObjectId;
  order_id: ObjectId;
  seeker_id: ObjectId;
  provider_id: ObjectId;
  rating: number; // 1-5
  comment?: string;
  createdAt: Date;
};

/**
 * Create a booking with atomic capacity check using MongoDB transaction.
 * Prevents race conditions where multiple bookings could exceed provider capacity.
 *
 * @throws Error if provider capacity is exceeded
 */
export async function createBooking(data: {
  seeker_id: ObjectId;
  provider_id: ObjectId;
  deadline?: Date;
  bookingFee: number;
  seeker_coordinates?: { lat: number; lng: number };
  capacity: number; // Provider's max capacity - must be passed in
}) {
  const { db, client } = await getDb();
  const session = client.startSession();

  try {
    let insertedBooking: Booking | undefined;

    await session.withTransaction(async () => {
      const now = new Date();

      // Atomic capacity check within transaction
      const activeBookings = await db.collection("bookings").countDocuments(
        {
          provider_id: data.provider_id,
          status: {
            $in: ["requested", "accepted", "pickup_proposed", "confirmed"],
          },
        },
        { session },
      );

      const activeOrders = await db.collection("orders").countDocuments(
        {
          provider_id: data.provider_id,
          process_status: {
            $in: [
              "invoiced",
              "processing",
              "washing",
              "ironing",
              "ready",
              "out_for_delivery",
            ],
          },
        },
        { session },
      );

      const totalActive = activeBookings + activeOrders;
      if (totalActive >= data.capacity) {
        throw new Error(
          `CAPACITY_EXCEEDED:Provider is currently at full capacity (${totalActive}/${data.capacity}). Please try again later or choose another provider.`,
        );
      }

      // Insert booking within same transaction
      const booking: Omit<Booking, "_id"> = {
        seeker_id: data.seeker_id,
        provider_id: data.provider_id,
        status: "requested",
        bookingFee: data.bookingFee,
        bookingFeeStatus: "pending",
        deadline: data.deadline,
        seeker_coordinates: data.seeker_coordinates,
        createdAt: now,
      };

      const res = await db
        .collection<Omit<Booking, "_id">>("bookings")
        .insertOne(booking, { session });

      insertedBooking = { ...booking, _id: res.insertedId };
    });

    if (!insertedBooking) {
      throw new Error("Failed to create booking");
    }

    // Audit log - booking created (fire-and-forget, non-blocking)
    auditBookingStateChange({
      booking_id: insertedBooking._id as ObjectId,
      previous_state: null,
      next_state: "requested",
      action: "booking_created",
      actor_type: "seeker",
      actor_id: data.seeker_id,
      metadata: {
        provider_id: data.provider_id.toString(),
        booking_fee: data.bookingFee,
      },
    });

    return insertedBooking;
  } finally {
    await session.endSession();
  }
}

/**
 * Get a booking by its ID
 */
export async function getBookingById(
  booking_id: ObjectId,
): Promise<Booking | null> {
  const { db } = await getDb();
  const booking = await db
    .collection<Booking>("bookings")
    .findOne({ _id: booking_id });
  return booking;
}

/**
 * Update a booking's status
 */
export async function updateBookingStatus(
  booking_id: ObjectId,
  status: "accepted" | "rejected",
) {
  const { db } = await getDb();
  const res = await db
    .collection<Booking>("bookings")
    .updateOne({ _id: booking_id }, { $set: { status } });
  return res.modifiedCount > 0;
}
/**
 * Accept a booking with atomic capacity check using MongoDB transaction.
 * Prevents race conditions where multiple accepts could exceed provider capacity.
 *
 * @returns The updated booking if successful, null if booking not found or not in 'requested' status
 * @throws Error if provider capacity is exceeded
 */
export async function acceptBookingWithCapacityCheck(data: {
  booking_id: ObjectId | string;
  provider_id: ObjectId;
  maxCapacity: number;
  platform_commission: number;
  provider_payout_amount: number;
}): Promise<Booking | null> {
  const { db, client } = await getDb();
  const session = client.startSession();

  try {
    let updatedBooking: Booking | null = null;

    await session.withTransaction(async () => {
      // Get booking first to verify it exists and is in correct state
      const booking = await db
        .collection<Booking>("bookings")
        .findOne({ _id: data.booking_id }, { session });

      if (!booking) {
        throw new Error("BOOKING_NOT_FOUND:Booking not found");
      }

      if (booking.provider_id.toString() !== data.provider_id.toString()) {
        throw new Error(
          "UNAUTHORIZED:You are not authorized to accept this booking",
        );
      }

      if (booking.status !== "requested") {
        throw new Error(
          "ALREADY_PROCESSED:Booking has already been acted upon",
        );
      }

      if (booking.bookingFeeStatus !== "paid") {
        throw new Error(
          "PAYMENT_NOT_SETTLED:Booking fee must be paid before provider can accept",
        );
      }

      const refundLockRaw = booking.refund_in_progress_at;
      if (refundLockRaw) {
        const refundLockAt = new Date(refundLockRaw);
        const lockIsFresh =
          !Number.isNaN(refundLockAt.getTime()) &&
          Date.now() - refundLockAt.getTime() < 5 * 60 * 1000;

        if (lockIsFresh) {
          throw new Error(
            "REFUND_IN_PROGRESS:Booking refund is in progress; cannot accept now",
          );
        }

        await db.collection<Booking>("bookings").updateOne(
          {
            _id: data.booking_id,
            status: "requested",
            refund_in_progress_at: booking.refund_in_progress_at,
          },
          {
            $unset: { refund_in_progress_at: "" },
            $set: { updatedAt: new Date() },
          },
          { session },
        );
      }

      // Atomic capacity check within transaction
      const activeBookingsCount = await db
        .collection("bookings")
        .countDocuments(
          {
            provider_id: data.provider_id,
            status: { $in: ["accepted", "pickup_proposed", "confirmed"] },
          },
          { session },
        );

      if (activeBookingsCount >= data.maxCapacity) {
        throw new Error(
          `CAPACITY_EXCEEDED:You are at your maximum capacity of ${data.maxCapacity} active bookings.`,
        );
      }

      // Update booking within same transaction
      const updateResult = await db
        .collection<Booking>("bookings")
        .findOneAndUpdate(
          {
            _id: data.booking_id,
            status: "requested",
            bookingFeeStatus: "paid",
            refund_in_progress_at: { $exists: false },
          }, // Double-check status/payment/lock hasn't changed
          {
            $set: {
              status: "accepted",
              platform_commission: data.platform_commission,
              provider_payout_amount: data.provider_payout_amount,
              payout_status: "pending",
              updatedAt: new Date(),
            },
          },
          { returnDocument: "after", session },
        );

      if (!updateResult) {
        throw new Error(
          "ALREADY_PROCESSED:Booking has already been acted upon",
        );
      }

      updatedBooking = updateResult;
    });

    // Audit log - booking accepted (fire-and-forget, non-blocking)
    if (updatedBooking) {
      const bookingIdForAudit =
        data.booking_id instanceof ObjectId
          ? data.booking_id
          : ObjectId.isValid(String(data.booking_id))
            ? new ObjectId(String(data.booking_id))
            : null;

      if (bookingIdForAudit) {
        auditBookingStateChange({
          booking_id: bookingIdForAudit,
          previous_state: "requested",
          next_state: "accepted",
          action: "booking_accepted",
          actor_type: "provider",
          actor_id: data.provider_id,
          metadata: {
            platform_commission: data.platform_commission,
            provider_payout_amount: data.provider_payout_amount,
          },
        });
      }
    }

    return updatedBooking;
  } finally {
    await session.endSession();
  }
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
  const escrow_release_at = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

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
 * Release escrow payment for an order
 * IDEMPOTENT: Safe to call multiple times - will only update if status is "held"
 */
export async function releaseEscrowPayment(order_id: ObjectId) {
  const { db } = await getDb();

  // IDEMPOTENCY CHECK: Verify order is in "held" status before releasing
  const order = await db.collection<Order>("orders").findOne({ _id: order_id });
  if (!order) {
    return false;
  }

  // If already released or not in held status, return false (idempotent)
  if (order.payment_status !== "held") {
    return order.payment_status === "released"; // Return true if already released (idempotent success)
  }

  // VALIDATION: Check for active complaints before releasing
  // FAANG Requirement: Block if ANY complaint is not fully resolved/rejected.
  const openComplaint = await db.collection("complaints").findOne({
    order_id: new ObjectId(order_id),
    status: { $nin: ["resolved", "rejected"] },
  });

  if (openComplaint) {
    // Escrow release blocked due to open complaint - this is expected behavior
    return false;
  }

  // Atomic update: Only update if still in "held" status (prevents race conditions)
  const res = await db.collection<Order>("orders").updateOne(
    { _id: order_id, payment_status: "held" }, // Ensure still "held" before updating
    { $set: { payment_status: "released", escrow_released_at: new Date() } },
  );

  const success = res.modifiedCount > 0;

  // Audit log - escrow released (fire-and-forget, non-blocking)
  if (success) {
    auditEscrowStateChange({
      order_id,
      previous_state: "held",
      next_state: "released",
      action: "escrow_released",
      actor_type: "system",
      razorpay_payment_id: order.razorpay_payment_id || null,
      metadata: {
        provider_payout_amount: order.provider_payout_amount,
        escrow_started_at: order.escrow_started_at,
      },
    });
  }

  return success;
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

/**
 * Create a new complaint
 */
export async function createComplaint(data: {
  order_id: ObjectId;
  booking_id: ObjectId;
  seeker_id: ObjectId;
  provider_id: ObjectId;
  complaint_type: string;
  title: string;
  description: string;
  photos?: string[];
}) {
  const { db } = await getDb();
  const now = new Date();

  const complaint: Omit<Complaint, "_id"> = {
    order_id: data.order_id,
    booking_id: data.booking_id,
    seeker_id: data.seeker_id,
    provider_id: data.provider_id,
    complaint_type: data.complaint_type,
    title: data.title,
    description: data.description,
    photos: data.photos,
    status: "open",
    participants: [data.seeker_id], // Initially just seeker (and implicit admin)
    provider_access_granted: false,
    createdAt: now,
  };

  const res = await db
    .collection<Omit<Complaint, "_id">>("complaints")
    .insertOne(complaint);
  return { ...complaint, _id: res.insertedId };
}

// Note: admin creation and profile update helpers used to live here.
// They have been removed for now because they were unused. Reintroduce
// them alongside the first real admin/profile management features.

/**
 * Force freeze escrow (explicitly mark as disputed if needed)
 * Effectively handled by createComplaint, but this ensures payment status reflects it.
 */
export async function freezeEscrow(order_id: ObjectId) {
  // We don't strictly change status to 'disputed' to avoid breaking enum types in MVP,
  // but we could. For now, we rely on the complaint check in releaseEscrowPayment.

  // Persist an explicit flag to make the freeze auditable and queryable.
  try {
    const { db } = await getDb();
    await db
      .collection<Order>("orders")
      .updateOne(
        { _id: order_id },
        { $set: { escrow_frozen: true, escrow_frozen_at: new Date() } },
      );
  } catch {
    // Error persisting escrow_frozen flag - continue silently as complaint still blocks release
  }
}

/**
 * Get all bookings for a provider (Server Component Helper)
 */
export async function getBookingsForProvider(email: string) {
  const { db } = await getDb();

  const provider = await db
    .collection<Provider>("providers")
    .findOne({ email });
  if (!provider) return [];

  const bookings = await db
    .collection<Booking>("bookings")
    .find({
      provider_id: provider._id,
      bookingFeeStatus: { $in: ["paid", "applied"] },
    })
    .sort({ createdAt: -1 })
    .toArray();

  // Parallel enrichment
  const enrichedBookings = await Promise.all(
    bookings.map(async (booking) => {
      const seeker = await db
        .collection<Seeker>("seekers")
        .findOne(
          { _id: new ObjectId(booking.seeker_id) },
          { projection: { passwordHash: 0 } },
        );

      // Serialize ObjectIds to strings for Client Components
      return {
        ...booking,
        _id: booking._id.toString(),
        seeker_id: booking.seeker_id.toString(),
        provider_id: booking.provider_id.toString(),
        createdAt: new Date(booking.createdAt).toISOString(),
        deadline: booking.deadline
          ? new Date(booking.deadline).toISOString()
          : undefined,
        pickupSlot: booking.pickupSlot
          ? {
              ...booking.pickupSlot,
              dateTime: new Date(booking.pickupSlot.dateTime).toISOString(), // Ensure ISO string
              confirmedAt: booking.pickupSlot.confirmedAt
                ? new Date(booking.pickupSlot.confirmedAt).toISOString()
                : undefined,
            }
          : undefined,
        seeker: seeker
          ? {
              ...seeker,
              _id: seeker._id?.toString() || "",
              createdAt: new Date(seeker.createdAt).toISOString(),
            }
          : undefined,
      };
    }),
  );

  return enrichedBookings;
}
