type PaymentStatus = "unpaid" | "paid" | "held" | "released" | "refunded";

export type DeadlineCompensationInput = {
  now: Date;
  deadline: Date | null;
  paymentStatus: PaymentStatus | string;
  alreadyCompensated: boolean;
  paidAmount: number;
};

export type DeadlineCompensationDecision = {
  deadlineBreached: boolean;
  shouldRefund: boolean;
  blocked: boolean;
  blockedMessage?: string;
};

export function evaluateDeadlineCompensation(
  input: DeadlineCompensationInput,
): DeadlineCompensationDecision {
  const { now, deadline, paymentStatus, alreadyCompensated, paidAmount } = input;

  const deadlineBreached =
    !!deadline &&
    !Number.isNaN(deadline.getTime()) &&
    now.getTime() > deadline.getTime();

  if (!deadlineBreached || alreadyCompensated || paidAmount <= 0) {
    return {
      deadlineBreached,
      shouldRefund: false,
      blocked: false,
    };
  }

  if (paymentStatus === "paid") {
    return {
      deadlineBreached: true,
      shouldRefund: true,
      blocked: false,
    };
  }

  return {
    deadlineBreached: true,
    shouldRefund: false,
    blocked: true,
    blockedMessage:
      "Deadline was missed, but payment state is not refundable automatically. Please contact support.",
  };
}
