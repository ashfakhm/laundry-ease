import { describe, expect, it } from "vitest";
import { derivePayoutAmounts } from "./amounts";

describe("derivePayoutAmounts", () => {
  it("prefers stored provider payout and keeps explicit commission when provided", () => {
    expect(
      derivePayoutAmounts({
        total_price: 1200,
        provider_payout_amount: 1110,
        platform_commission: 90,
      }),
    ).toEqual({
      providerPayoutAmountPaise: 111000,
      platformCommissionPaise: 9000,
    });
  });

  it("derives commission from total when provider payout exists but commission is missing", () => {
    expect(
      derivePayoutAmounts({
        total_price: 1000,
        provider_payout_amount: 940,
      }),
    ).toEqual({
      providerPayoutAmountPaise: 94000,
      platformCommissionPaise: 6000,
    });
  });

  it("derives provider payout from stored commission when payout amount is missing", () => {
    expect(
      derivePayoutAmounts({
        total_price: 1000,
        platform_commission: 50,
      }),
    ).toEqual({
      providerPayoutAmountPaise: 95000,
      platformCommissionPaise: 5000,
    });
  });

  it("falls back to a 5% platform commission when neither value exists", () => {
    expect(
      derivePayoutAmounts({
        total_price: 1000,
      }),
    ).toEqual({
      providerPayoutAmountPaise: 95000,
      platformCommissionPaise: 5000,
    });
  });

  it("clamps negatives and rounds to 2 decimals mathematically converted to paise", () => {
    expect(
      derivePayoutAmounts({
        total_price: 999.995,
        provider_payout_amount: -15,
      }),
    ).toEqual({
      providerPayoutAmountPaise: 0,
      platformCommissionPaise: 100000,
    });
  });
});
