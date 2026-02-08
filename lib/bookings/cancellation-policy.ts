import type { Booking } from "@/types/bookings";

export type CancellationActor = "seeker" | "provider";
export type BookingFeeStatus = Booking["bookingFeeStatus"];

export type CancellationRefundAction = "none" | "refund" | "forfeit";

export type CancellationPolicyInput = {
  actor: CancellationActor;
  bookingFeeStatus: BookingFeeStatus;
  pickupSlotTime: Date | null;
  now: Date;
};

export type CancellationPolicyDecision = {
  allowed: boolean;
  message?: string;
  refundAction: CancellationRefundAction;
  seekerSameDayCancellation: boolean;
};

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function evaluateCancellationPolicy(
  input: CancellationPolicyInput,
): CancellationPolicyDecision {
  const { actor, bookingFeeStatus, pickupSlotTime, now } = input;

  if (actor === "seeker" && pickupSlotTime && now >= pickupSlotTime) {
    return {
      allowed: false,
      message: "Seeker can cancel only before the booked slot time.",
      refundAction: "none",
      seekerSameDayCancellation: false,
    };
  }

  if (bookingFeeStatus === "applied") {
    return {
      allowed: false,
      message:
        "Booking fee has already been released to provider and cannot be auto-refunded on cancellation.",
      refundAction: "none",
      seekerSameDayCancellation: false,
    };
  }

  const seekerSameDayCancellation =
    actor === "seeker" &&
    pickupSlotTime !== null &&
    isSameCalendarDay(now, pickupSlotTime);

  let refundAction: CancellationRefundAction = "none";

  if (bookingFeeStatus === "paid") {
    if (actor === "provider" || !seekerSameDayCancellation) {
      refundAction = "refund";
    } else {
      refundAction = "forfeit";
    }
  }

  return {
    allowed: true,
    refundAction,
    seekerSameDayCancellation,
  };
}
