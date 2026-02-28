import { PLATFORM_COMMISSION_RATE } from "@/lib/constants";
import Decimal from "decimal.js";

type PayoutAmountInput = {
  total_price?: number | null;
  provider_payout_amount?: number | null;
  platform_commission?: number | null;
};

export type PayoutAmountBreakdown = {
  providerPayoutAmountPaise: number;
  platformCommissionPaise: number;
};

function toDecimal(value: unknown): Decimal | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return new Decimal(num);
}

/**
 * Ensures a decimal is not negative and is a mathematically precise integer for paise.
 */
function normalizeToPaiseInteger(dec: Decimal): number {
  return Decimal.max(0, dec).times(100).toDecimalPlaces(0).toNumber();
}

/**
 * Derives payout split with a deterministic fallback:
 * 1) respect stored provider payout when present
 * 2) otherwise respect stored platform commission when present
 * 3) otherwise fallback to default platform commission (e.g. 5%)
 */
export function derivePayoutAmounts(
  order: PayoutAmountInput,
): PayoutAmountBreakdown {
  const total = toDecimal(order.total_price) ?? new Decimal(0);
  const normalizedTotal = Decimal.max(0, total);

  const storedPayout = toDecimal(order.provider_payout_amount);
  const storedCommission = toDecimal(order.platform_commission);

  if (storedPayout !== null) {
    const normalizedPayout = Decimal.max(0, storedPayout);
    const derivedCommission = Decimal.max(
      0,
      normalizedTotal.minus(normalizedPayout),
    );

    return {
      providerPayoutAmountPaise: normalizeToPaiseInteger(normalizedPayout),
      platformCommissionPaise:
        storedCommission !== null
          ? normalizeToPaiseInteger(storedCommission)
          : normalizeToPaiseInteger(derivedCommission),
    };
  }

  if (storedCommission !== null) {
    const normalizedCommission = Decimal.max(0, storedCommission);
    return {
      providerPayoutAmountPaise: normalizeToPaiseInteger(
        normalizedTotal.minus(normalizedCommission),
      ),
      platformCommissionPaise: normalizeToPaiseInteger(normalizedCommission),
    };
  }

  const defaultCommissionRate = new Decimal(PLATFORM_COMMISSION_RATE);
  const defaultCommission = Decimal.max(
    0,
    normalizedTotal.times(defaultCommissionRate),
  );

  return {
    providerPayoutAmountPaise: normalizeToPaiseInteger(
      normalizedTotal.minus(defaultCommission),
    ),
    platformCommissionPaise: normalizeToPaiseInteger(defaultCommission),
  };
}
