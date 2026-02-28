"use server";

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import {
  createRazorpayContact,
  createRazorpayFundAccount,
  createRazorpayPayout,
  refundRazorpayPayment,
} from "@/lib/razorpay";
import { getProviderById, updateProviderRazorpayIds } from "@/lib/db/users";
import {
  acceptBookingWithCapacityCheck,
  getBookingById,
  lockBookingForRefund,
  unlockBookingRefund,
  markBookingAsRejectedAndRefunded,
  updateBookingToRefundedOnly,
  updateBookingPickupSlot,
  markBookingProviderArrived,
} from "@/lib/db/bookings";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import {
  PLATFORM_COMMISSION_RATE,
  MAX_ARRIVAL_DISTANCE_METERS,
} from "@/lib/constants";
import { calculateDistance } from "@/lib/distance";
import { requireProvider } from "@/lib/api/auth";
import { AppError } from "@/lib/api/errors";
import { telemetry } from "@/lib/telemetry";

export type ActionResponse = {
  success: boolean;
  message?: string;
  error?: string;
};

const REFUND_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

function actionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AppError) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return "Unauthorized";
    }
    return error.message;
  }
  return fallback;
}

/**
 * Updates the status of a booking (accept/reject).
 * handles complex logic for 'accept' including Razorpay checks and capacity.
 */
export async function updateBookingStatus(
  bookingId: string,
  action: "accept" | "reject",
): Promise<ActionResponse> {
  try {
    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) {
      return { success: false, error: "Unauthorized" };
    }

    const providerId = new ObjectId(user.id);

    // Get provider by stable identity
    const provider = await getProviderById(providerId);
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
    const booking = await getBookingById(queryId);
    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    // Verify provider ownership
    if (booking.provider_id.toString() !== provider._id?.toString()) {
      return {
        success: false,
        error: "Unauthorized: Booking does not belong to you",
      };
    }

    // Status transition check
    if (booking.status !== "requested") {
      return { success: false, error: "Booking has already been acted upon" };
    }

    // --- ACCEPT LOGIC ---
    if (action === "accept") {
      if (booking.bookingFeeStatus !== "paid") {
        return {
          success: false,
          error: "Booking fee must be paid before provider can accept",
        };
      }

      // Razorpay / Payment Details Check
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
            await updateProviderRazorpayIds(
              provider._id!.toString(),
              contact.id,
              fundAccount.id,
            );
          } catch (e: unknown) {
            const err = e as Error;
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

      // Commission calculation and atomic acceptance
      const bookingFee = booking.bookingFee || 0;
      const platform_commission = bookingFee * PLATFORM_COMMISSION_RATE;
      const provider_payout_amount = bookingFee - platform_commission; // 95%
      const maxCapacity = provider.capacity ?? 100;

      const transactionResult = await acceptBookingWithCapacityCheck({
        booking_id: queryId,
        provider_id: provider._id!,
        maxCapacity,
        platform_commission,
        provider_payout_amount,
      });

      if (transactionResult) {
        telemetry.increment("bookings.created", 1, [
          `fee_status:${booking.bookingFeeStatus}`,
          `capacity_managed:true`,
        ]);
        revalidatePath(`/provider/${providerId.toString()}`);
        revalidatePath("/provider/manage-booking");
        return { success: true, message: "Booking accepted" };
      }
      return { success: false, error: "Failed to accept booking" };
    }

    // --- REJECT LOGIC ---
    if (action === "reject") {
      if (booking.bookingFeeStatus !== "paid") {
        return {
          success: false,
          error: "Booking fee must be paid before provider can reject",
        };
      }

      if (!booking.razorpay_payment_id) {
        return {
          success: false,
          error:
            "Cannot reject booking: payment reference missing for booking-fee refund.",
        };
      }

      const lockResult = await lockBookingForRefund(
        queryId,
        REFUND_LOCK_TIMEOUT_MS,
      );

      if (!lockResult) {
        const latest = await getBookingById(queryId as ObjectId);
        if (latest?.status === "rejected") {
          return { success: true, message: "Booking already rejected" };
        }
        if (latest?.refund_in_progress_at) {
          const lockAt = new Date(latest.refund_in_progress_at);
          const lockIsFresh =
            !Number.isNaN(lockAt.getTime()) &&
            Date.now() - lockAt.getTime() < REFUND_LOCK_TIMEOUT_MS;
          if (lockIsFresh) {
            return {
              success: false,
              error: "Refund is already in progress for this booking.",
            };
          }
        }
        return {
          success: false,
          error: "Booking status changed during rejection. Please refresh.",
        };
      }

      let refundId: string | null = null;
      try {
        const refund = await refundRazorpayPayment(
          booking.razorpay_payment_id,
          undefined,
          {
            reason: "provider_rejected_booking",
            booking_id: booking._id.toString(),
          },
        );
        refundId = refund.id || null;
      } catch (error) {
        await unlockBookingRefund(queryId);

        logger.error(
          "BOOKING_ACTIONS",
          "Failed to refund booking fee during provider rejection",
          error,
          { bookingId },
        );
        return {
          success: false,
          error:
            "Failed to refund booking fee. Booking was not rejected. Please retry.",
        };
      }

      const rejectResult = await markBookingAsRejectedAndRefunded(
        queryId,
        refundId,
      );

      if (!rejectResult) {
        const latest = await getBookingById(queryId as ObjectId);

        if (latest?.bookingFeeStatus === "paid") {
          await updateBookingToRefundedOnly(queryId, refundId);
        } else {
          await unlockBookingRefund(queryId);
        }

        const latestAfter = await getBookingById(queryId as ObjectId);
        if (latestAfter?.status === "rejected") {
          revalidatePath("/provider/manage-booking");
          return { success: true, message: "Booking already rejected" };
        }

        return {
          success: false,
          error:
            "Booking status changed during rejection. Refund has been processed; please refresh.",
        };
      }

      revalidatePath("/provider/manage-booking");
      return { success: true, message: "Booking rejected and fee refunded" };
    }

    return { success: false, error: "Invalid action" };
  } catch (error) {
    logger.error("BOOKING_ACTIONS", "Error updating booking status", error, {
      bookingId,
    });
    return {
      success: false,
      error: actionErrorMessage(error, "Internal server error"),
    };
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
    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) {
      return { success: false, error: "Unauthorized" };
    }

    if (!dateTime) {
      return { success: false, error: "Date and time required" };
    }

    let queryId;
    try {
      queryId = new ObjectId(bookingId);
    } catch {
      queryId = bookingId;
    }
    const booking = await getBookingById(queryId);
    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    const provider = await getProviderById(user.id);
    if (
      !provider ||
      booking.provider_id.toString() !== provider._id?.toString()
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
    const { MIN_PICKUP_ADVANCE_MS } = await import("@/lib/constants");
    const minTime = new Date(now.getTime() + MIN_PICKUP_ADVANCE_MS);

    if (slotTime < minTime) {
      return {
        success: false,
        error: `Pickup must be at least ${MIN_PICKUP_ADVANCE_MS / (60 * 60 * 1000)} hours from now`,
      };
    }

    const deadline = booking.deadline ? new Date(booking.deadline) : null;
    if (deadline && slotTime > deadline) {
      return {
        success: false,
        error: "Pickup cannot be after seeker's deadline",
      };
    }

    await updateBookingPickupSlot(queryId, slotTime);

    revalidatePath("/provider/manage-booking");
    return { success: true, message: "Pickup slot proposed" };
  } catch (error) {
    logger.error("BOOKING_ACTIONS", "Error proposing pickup slot", error, {
      bookingId,
    });
    return {
      success: false,
      error: actionErrorMessage(error, "Failed to propose pickup slot"),
    };
  }
}

/**
 * Marks a provider as arrived for a confirmed booking.
 */
export async function markProviderArrived(
  bookingId: string,
  coordinates?: { lat: number; lng: number },
): Promise<ActionResponse> {
  try {
    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) {
      return { success: false, error: "Unauthorized" };
    }

    let queryId;
    try {
      queryId = new ObjectId(bookingId);
    } catch {
      queryId = bookingId;
    }
    const booking = await getBookingById(queryId);
    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    const provider = await getProviderById(user.id);
    if (
      !provider ||
      booking.provider_id.toString() !== provider._id?.toString()
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

    if (
      booking.bookingFeeStatus !== "paid" &&
      booking.bookingFeeStatus !== "applied"
    ) {
      return {
        success: false,
        error: "Booking fee must be paid before marking arrival",
      };
    }

    if (booking.seeker_coordinates) {
      if (
        !coordinates ||
        !Number.isFinite(coordinates.lat) ||
        !Number.isFinite(coordinates.lng)
      ) {
        return {
          success: false,
          error: "Current location coordinates are required.",
        };
      }

      const distanceKm = calculateDistance(
        { lat: coordinates.lat, lng: coordinates.lng },
        booking.seeker_coordinates,
      );
      const distanceMeters = distanceKm * 1000;
      if (distanceMeters > MAX_ARRIVAL_DISTANCE_METERS) {
        return {
          success: false,
          error: `Too far from location (${Math.round(distanceMeters)}m > ${MAX_ARRIVAL_DISTANCE_METERS}m)`,
        };
      }
    }

    const now = new Date();

    let payoutId: string | null = null;
    if (!booking.payout_id && booking.bookingFeeStatus === "paid") {
      if (!provider.razorpay_fund_account_id) {
        return {
          success: false,
          error:
            "Provider payout account is not configured. Update payment details first.",
        };
      }

      if (!env.RAZORPAYX_ACCOUNT_NUMBER) {
        return {
          success: false,
          error:
            "Platform payout account is not configured. Please contact admin.",
        };
      }

      const bookingFee = Number(booking.bookingFee || 0);
      const providerAmount = Number(
        booking.provider_payout_amount ?? bookingFee * 0.95,
      );
      const payoutAmountPaise = Math.round(providerAmount * 100);

      if (payoutAmountPaise <= 0) {
        return {
          success: false,
          error: "Invalid payout amount for booking fee release",
        };
      }

      try {
        const payout = await createRazorpayPayout({
          account_number: env.RAZORPAYX_ACCOUNT_NUMBER,
          fund_account_id: provider.razorpay_fund_account_id,
          amount: payoutAmountPaise,
          currency: "INR",
          mode: "NEFT",
          purpose: "payout",
          narration: `Booking fee payout ${booking._id.toString().slice(-6)}`,
          reference_id: `booking-fee-${booking._id.toString()}`,
        });
        payoutId = payout.id;
      } catch (error) {
        logger.error(
          "BOOKING_ACTIONS",
          "Failed to initiate booking-fee payout on arrival",
          error,
          { bookingId },
        );
        return {
          success: false,
          error:
            "Failed to release booking fee payout. Arrival was not marked. Please retry.",
        };
      }
    }

    const updateResult = await markBookingProviderArrived(
      queryId,
      now,
      payoutId,
    );

    if (!updateResult) {
      return {
        success: false,
        error: "Booking state changed while marking arrival. Please refresh.",
      };
    }

    revalidatePath("/provider/manage-booking");
    return {
      success: true,
      message: payoutId
        ? "Marked as arrived and booking fee payout initiated"
        : "Marked as arrived",
    };
  } catch (error) {
    logger.error("BOOKING_ACTIONS", "Error marking provider arrival", error, {
      bookingId,
    });
    return {
      success: false,
      error: actionErrorMessage(error, "Failed to mark arrival"),
    };
  }
}
