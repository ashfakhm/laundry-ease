import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";
import { BookingStatus, Booking } from "@/types/bookings";
import { Order, OrderProcessStatus, PaymentStatus } from "@/types/orders";
import { Seeker } from "@/types/users";

export interface DeletionBlocker {
  type: string;
  message: string;
}

export async function checkDeletionBlockers(
  userId: string | ObjectId,
  role: Role.SEEKER | Role.PROVIDER,
): Promise<DeletionBlocker[]> {
  const { db } = await getDb();
  const objId = typeof userId === "string" ? new ObjectId(userId) : userId;
  const blockers: DeletionBlocker[] = [];

  // 1. Check Active Bookings
  // Block if booking is in any non-terminal state
  const activeBookingStatuses: BookingStatus[] = [
    "requested",
    "accepted",
    "pickup_proposed",
    "reschedule_requested",
    "confirmed",
    "invoice_created",
  ];
  const bookingFilter =
    role === Role.SEEKER
      ? { seeker_id: objId, status: { $in: activeBookingStatuses } }
      : { provider_id: objId, status: { $in: activeBookingStatuses } };

  const activeBookingsCount = await db
    .collection<Booking>("bookings")
    .countDocuments(bookingFilter);

  if (activeBookingsCount > 0) {
    blockers.push({
      type: "active_bookings",
      message: `You have ${activeBookingsCount} active booking(s). Please complete or cancel them before deleting your account.`,
    });
  }

  // 2. Check Unsettled Orders
  // Seekers: Order must be delivered & payment released or refunded.
  // Providers: Same as seeker + payout_status must be paid or failed.
  const orderFilter =
    role === Role.SEEKER
      ? { seeker_id: objId }
      : { provider_id: objId };

  const unsettledOrdersFilter = {
    ...orderFilter,
    $or: [
      { process_status: { $ne: "delivered" as OrderProcessStatus } },
      { payment_status: { $nin: ["released", "refunded", "failed"] as PaymentStatus[] } },
      ...(role === Role.PROVIDER
        ? [{ payout_status: { $nin: ["paid", "failed"] as ("paid" | "failed")[] } }]
        : []),
    ],
  };

  const unsettledOrdersCount = await db
    .collection<Order>("orders")
    .countDocuments(unsettledOrdersFilter);

  if (unsettledOrdersCount > 0) {
    blockers.push({
      type: "unsettled_orders",
      message: `You have ${unsettledOrdersCount} unsettled order(s). Ensure all orders are delivered and payments/payouts are complete.`,
    });
  }

  // 3. Check Active Complaints
  const activeComplaintStatuses = ["open", "accepted", "in_review"];
  const complaintFilter =
    role === Role.SEEKER
      ? { seekerId: objId, status: { $in: activeComplaintStatuses } }
      : { providerId: objId, status: { $in: activeComplaintStatuses } };

  const activeComplaintsCount = await db
    .collection("complaints")
    .countDocuments(complaintFilter);

  if (activeComplaintsCount > 0) {
    blockers.push({
      type: "active_complaints",
      message: `You have ${activeComplaintsCount} active complaint(s). Please resolve them before deleting your account.`,
    });
  }

  // 4. Seekers Outstanding Fees
  if (role === Role.SEEKER) {
    const seeker = await db.collection<Seeker>("seekers").findOne(
      { _id: objId },
      { projection: { outstanding_fees: 1 } }
    );
    if (seeker?.outstanding_fees && seeker.outstanding_fees > 0) {
      blockers.push({
        type: "outstanding_fees",
        message: `You have outstanding fees of ₹${seeker.outstanding_fees}. Please pay them before deleting your account.`,
      });
    }
  }

  return blockers;
}

export async function softDeleteAccount(
  userId: string | ObjectId,
  role: Role.SEEKER | Role.PROVIDER,
  deletedBy: "self" | "admin" = "self"
): Promise<boolean> {
  const { db } = await getDb();
  const objId = typeof userId === "string" ? new ObjectId(userId) : userId;
  const collectionName = role === Role.SEEKER ? "seekers" : "providers";

  const result = await db.collection(collectionName).updateOne(
    { _id: objId, isDeleted: { $ne: true } },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy,
        updatedAt: new Date(),
      },
      // Remove identifying tokens (like OTP/FCM)
      $unset: {
        fcmTokens: "",
      }
    }
  );

  return result.modifiedCount > 0;
}
