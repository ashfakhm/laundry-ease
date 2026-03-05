import { SEEKER_FREE_CANCEL_WINDOW_MS } from "@/lib/constants";
import type { Booking } from "@/types/bookings";

export type CancellationActor = "seeker" | "provider";
export type BookingFeeStatus = Booking["bookingFeeStatus"];

export type CancellationRefundAction = "none" | "refund" | "forfeit";

export type CancellationPolicyInput = {
  actor: CancellationActor;
  bookingFeeStatus: BookingFeeStatus;
  bookingCreatedAt: Date;
  pickupSlotTime: Date | null;
  now: Date;
};

export type CancellationPolicyDecision = {
  allowed: boolean;
  message?: string;
  refundAction: CancellationRefundAction;
  /** True when the seeker is still within the free-cancel window (2 h from booking creation). */
  withinFreeCancelWindow: boolean;
};

/**
 * Evaluate the cancellation policy for a booking.
 *
 * Rules:
 *  - Provider cancels at any point before arrival → always refunds seeker's booking fee.
 *  - Seeker cancels within 2 hours of booking creation → full refund.
 *  - Seeker cancels after 2 hours of booking creation → booking fee is forfeited.
 *  - Seeker cannot cancel at or after the scheduled pickup slot time.
 *  - Nobody can cancel when the booking fee has already been applied/released.
 */
export function evaluateCancellationPolicy(
  input: CancellationPolicyInput,
): CancellationPolicyDecision {
  const { actor, bookingFeeStatus, bookingCreatedAt, pickupSlotTime, now } =
    input;

  // Block seeker if the pickup slot has already started / passed.
  if (actor === "seeker" && pickupSlotTime && now >= pickupSlotTime) {
    return {
      allowed: false,
      message: "Seeker can cancel only before the booked slot time.",
      refundAction: "none",
      withinFreeCancelWindow: false,
    };
  }

  // Block everyone if the booking fee has already been released to the provider.
  if (bookingFeeStatus === "applied") {
    return {
      allowed: false,
      message:
        "Booking fee has already been released to provider and cannot be auto-refunded on cancellation.",
      refundAction: "none",
      withinFreeCancelWindow: false,
    };
  }

  // Determine whether the seeker is still within the free-cancel window.
  const elapsedMs = now.getTime() - bookingCreatedAt.getTime();
  const withinFreeCancelWindow =
    actor === "seeker" ? elapsedMs <= SEEKER_FREE_CANCEL_WINDOW_MS : true;

  let refundAction: CancellationRefundAction = "none";

  if (bookingFeeStatus === "paid") {
    if (actor === "provider") {
      // Provider-initiated cancellation always refunds the seeker in full.
      refundAction = "refund";
    } else if (withinFreeCancelWindow) {
      // Seeker cancels within the 2-hour grace window — full refund.
      refundAction = "refund";
    } else {
      // Seeker cancels after the grace window — fee is forfeited.
      refundAction = "forfeit";
    }
  }

  return {
    allowed: true,
    refundAction,
    withinFreeCancelWindow,
  };
}
