"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import {
  createRazorpayContact,
  createRazorpayFundAccount,
} from "@/lib/razorpay";
import { Role } from "@/types/enums";
import { logger } from "@/lib/logger";

export type ActionResponse = {
  success: boolean;
  message?: string;
  error?: string;
};

/**
 * Updates the status of a booking (accept/reject).
 * handles complex logic for 'accept' including Razorpay checks and capacity.
 */
export async function updateBookingStatus(
  bookingId: string,
  action: "accept" | "reject",
): Promise<ActionResponse> {
  try {
    const session = await getServerSession(authOptions);
    // basic auth check
    if (!session?.user?.email) {
      return { success: false, error: "Unauthorized" };
    }

    // role check (optional but good practice if session has role)
    if (session.user.role && session.user.role !== Role.PROVIDER) {
      return { success: false, error: "Unauthorized: Providers only" };
    }

    const { db } = await getDb();

    // Get provider by email
    const provider = await db
      .collection("providers")
      .findOne({ email: session.user.email });
    if (!provider) {
      return { success: false, error: "Provider not found" };
    }

    // Validate Booking ID
    let queryId;
    try {
      queryId = new ObjectId(bookingId);
    } catch {
      queryId = bookingId;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bookingQuery: any = { _id: queryId };

    const booking = await db.collection("bookings").findOne(bookingQuery);
    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    // Verify provider ownership
    if (booking.provider_id.toString() !== provider._id.toString()) {
      return {
        success: false,
        error: "Unauthorized: Booking does not belong to you",
      };
    }

    // Status transition check
    if (booking.status !== "requested") {
      return { success: false, error: "Booking has already been acted upon" };
    }

    // Ensure booking fee is paid before any action
    if (booking.bookingFeeStatus !== "paid") {
      return {
        success: false,
        error: "Booking fee must be paid before provider can accept",
      };
    }

    // --- ACCEPT LOGIC ---
    if (action === "accept") {
      // 1. Capacity Check
      const activeBookingsCount = await db
        .collection("bookings")
        .countDocuments({
          provider_id: provider._id,
          status: { $in: ["accepted", "pickup_proposed", "confirmed"] },
        });
      const maxCapacity = provider.capacity ?? 100;
      if (activeBookingsCount >= maxCapacity) {
        return {
          success: false,
          error: `You are at your maximum capacity of ${maxCapacity} active bookings.`,
        };
      }

      // 2. Razorpay / Payment Details Check
      if (!provider.razorpay_fund_account_id) {
        // Attempt to sync on-the-fly if details exist locally
        const { accountHolderName, accountNumber, ifsc } =
          provider.bankDetails || {};

        if (accountHolderName && accountNumber && ifsc) {
          try {
            // Create Contact
            const contact = await createRazorpayContact({
              name: provider.name || provider.businessName || "Provider",
              email: provider.email,
              contact: provider.phone || "",
              type: "vendor",
              reference_id: provider._id.toString(),
            });

            // Create Fund Account
            const fundAccount = await createRazorpayFundAccount({
              contact_id: contact.id,
              account_type: "bank_account",
              bank_account: {
                name: accountHolderName,
                account_number: accountNumber.toString(),
                ifsc: ifsc,
              },
            });

            // Update Provider
            await db.collection("providers").updateOne(
              { _id: provider._id },
              {
                $set: {
                  razorpay_contact_id: contact.id,
                  razorpay_fund_account_id: fundAccount.id,
                },
              },
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (err: any) {
            logger.error("BOOKING_ACTIONS", "Auto-sync Razorpay failed", err, {
              bookingId,
            });
            return {
              success: false,
              error: `Payment Setup Failed: ${
                err.message || "Invalid details"
              }`,
            };
          }
        } else {
          return {
            success: false,
            error:
              "You must complete your Payment/Bank Details in Profile before accepting bookings.",
          };
        }
      }

      // 3. Commission Calculation
      const bookingFee = booking.bookingFee || 0;
      const platform_commission = bookingFee * 0.05; // 5%
      const provider_payout_amount = bookingFee - platform_commission; // 95%

      await db.collection("bookings").updateOne(bookingQuery, {
        $set: {
          status: "accepted",
          platform_commission,
          provider_payout_amount,
          payout_status: "pending",
          updatedAt: new Date(),
        },
      });

      revalidatePath("/provider/Manage-booking");
      return { success: true, message: "Booking accepted" };
    }

    // --- REJECT LOGIC ---
    if (action === "reject") {
      await db.collection("bookings").updateOne(bookingQuery, {
        $set: {
          status: "rejected",
          updatedAt: new Date(),
        },
      });

      revalidatePath("/provider/Manage-booking");
      return { success: true, message: "Booking rejected" };
    }

    return { success: false, error: "Invalid action" };
  } catch (error) {
    logger.error("BOOKING_ACTIONS", "Error updating booking status", error, {
      bookingId,
    });
    return { success: false, error: "Internal server error" };
  }
}

/**
 * Proposes a pickup slot for a booking.
 */
export async function proposePickupSlot(
  bookingId: string,
  dateTime: string,
): Promise<ActionResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: "Unauthorized" };
    }

    if (!dateTime) {
      return { success: false, error: "Date and time required" };
    }

    const { db } = await getDb();

    let queryId;
    try {
      queryId = new ObjectId(bookingId);
    } catch {
      queryId = bookingId;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bookingQuery: any = { _id: queryId };

    const booking = await db.collection("bookings").findOne(bookingQuery);
    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    const provider = await db
      .collection("providers")
      .findOne({ email: session.user.email });
    if (
      !provider ||
      booking.provider_id.toString() !== provider._id.toString()
    ) {
      return { success: false, error: "Unauthorized" };
    }

    if (
      booking.status !== "accepted" &&
      booking.status !== "reschedule_requested"
    ) {
      return {
        success: false,
        error: "Slot can only be proposed for accepted bookings or reschedules",
      };
    }

    const now = new Date();
    const slotTime = new Date(dateTime);
    const minTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    if (slotTime < minTime) {
      return {
        success: false,
        error: "Pickup must be at least 2 hours from now",
      };
    }

    const deadline = booking.deadline ? new Date(booking.deadline) : null;
    if (deadline && slotTime > deadline) {
      return {
        success: false,
        error: "Pickup cannot be after seeker's deadline",
      };
    }

    await db.collection("bookings").updateOne(bookingQuery, {
      $set: {
        status: "pickup_proposed",
        pickupSlot: {
          proposedBy: "provider",
          dateTime: slotTime,
          confirmedAt: undefined,
        },
        updatedAt: new Date(),
      },
    });

    revalidatePath("/provider/Manage-booking");
    return { success: true, message: "Pickup slot proposed" };
  } catch (error) {
    logger.error("BOOKING_ACTIONS", "Error proposing pickup slot", error, {
      bookingId,
    });
    return { success: false, error: "Failed to propose pickup slot" };
  }
}

/**
 * Marks a provider as arrived for a confirmed booking.
 */
export async function markProviderArrived(
  bookingId: string,
): Promise<ActionResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: "Unauthorized" };
    }

    const { db } = await getDb();

    let queryId;
    try {
      queryId = new ObjectId(bookingId);
    } catch {
      queryId = bookingId;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bookingQuery: any = { _id: queryId };

    const booking = await db.collection("bookings").findOne(bookingQuery);
    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    const provider = await db
      .collection("providers")
      .findOne({ email: session.user.email });
    if (
      !provider ||
      booking.provider_id.toString() !== provider._id.toString()
    ) {
      return { success: false, error: "Unauthorized" };
    }

    if (booking.status !== "confirmed") {
      return {
        success: false,
        error: "Can only mark arrived for confirmed bookings",
      };
    }

    if (booking.arrivedAt) {
      return { success: false, error: "Already marked as arrived" };
    }

    await db.collection("bookings").updateOne(bookingQuery, {
      $set: {
        arrivedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    revalidatePath("/provider/Manage-booking");
    return { success: true, message: "Marked as arrived" };
  } catch (error) {
    logger.error("BOOKING_ACTIONS", "Error marking provider arrival", error, {
      bookingId,
    });
    return { success: false, error: "Failed to mark arrival" };
  }
}
