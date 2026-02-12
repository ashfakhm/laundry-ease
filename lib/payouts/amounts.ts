import { DEFAULT_PLATFORM_COMMISSION_RATE } from "@/lib/constants";

type PayoutAmountInput = {
  total_price?: number | null;
  provider_payout_amount?: number | null;
  platform_commission?: number | null;
};

export type PayoutAmountBreakdown = {
  providerPayoutAmount: number;
  platformCommission: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toFiniteNumber(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

/**
 * Derives payout split with a deterministic fallback:
 * 1) respect stored provider payout when present
 * 2) otherwise respect stored platform commission when present
 * 3) otherwise fallback to 5% platform commission
 */
export function derivePayoutAmounts(
  order: PayoutAmountInput,
): PayoutAmountBreakdown {
  const total = round2(Math.max(0, toFiniteNumber(order.total_price) ?? 0));
  const storedPayout = toFiniteNumber(order.provider_payout_amount);
  const storedCommission = toFiniteNumber(order.platform_commission);

  if (storedPayout !== null) {
    const normalizedPayout = round2(Math.max(0, storedPayout));
    const derivedCommission = round2(Math.max(0, total - normalizedPayout));
    return {
      providerPayoutAmount: normalizedPayout,
      platformCommission:
        storedCommission !== null
          ? round2(Math.max(0, storedCommission))
          : derivedCommission,
    };
  }

  if (storedCommission !== null) {
    const normalizedCommission = round2(Math.max(0, storedCommission));
    return {
      providerPayoutAmount: round2(Math.max(0, total - normalizedCommission)),
      platformCommission: normalizedCommission,
    };
  }

  const defaultCommission = round2(
    Math.max(0, total * DEFAULT_PLATFORM_COMMISSION_RATE),
  );
  return {
    providerPayoutAmount: round2(Math.max(0, total - defaultCommission)),
    platformCommission: defaultCommission,
  };
}
