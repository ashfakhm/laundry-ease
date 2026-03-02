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

  describe("subtotal-aware commission (pre-discount)", () => {
    it("computes default commission from subtotal when subtotal is provided", () => {
      // subtotal=1000, discount=200, delivery=50 → total_price=850
      // commission = 1000 * 0.05 = 50 (on pre-discount subtotal)
      // provider payout = 850 - 50 = 800
      expect(
        derivePayoutAmounts({
          total_price: 850,
          subtotal: 1000,
        }),
      ).toEqual({
        providerPayoutAmountPaise: 80000,
        platformCommissionPaise: 5000,
      });
    });

    it("uses total_price for commission when subtotal is not provided (backward compat)", () => {
      // No subtotal → falls back to total_price * 5%
      expect(
        derivePayoutAmounts({
          total_price: 850,
        }),
      ).toEqual({
        providerPayoutAmountPaise: 80750,
        platformCommissionPaise: 4250,
      });
    });

    it("uses total_price for commission when subtotal is null", () => {
      expect(
        derivePayoutAmounts({
          total_price: 1000,
          subtotal: null,
        }),
      ).toEqual({
        providerPayoutAmountPaise: 95000,
        platformCommissionPaise: 5000,
      });
    });

    it("still prefers stored provider_payout_amount over subtotal-based default", () => {
      expect(
        derivePayoutAmounts({
          total_price: 850,
          subtotal: 1000,
          provider_payout_amount: 800,
          platform_commission: 50,
        }),
      ).toEqual({
        providerPayoutAmountPaise: 80000,
        platformCommissionPaise: 5000,
      });
    });

    it("still prefers stored platform_commission over subtotal-based default", () => {
      expect(
        derivePayoutAmounts({
          total_price: 850,
          subtotal: 1000,
          platform_commission: 50,
        }),
      ).toEqual({
        providerPayoutAmountPaise: 80000,
        platformCommissionPaise: 5000,
      });
    });

    it("handles zero subtotal gracefully", () => {
      expect(
        derivePayoutAmounts({
          total_price: 50,
          subtotal: 0,
        }),
      ).toEqual({
        providerPayoutAmountPaise: 5000,
        platformCommissionPaise: 0,
      });
    });

    it("handles subtotal equal to total_price (no discount, no delivery)", () => {
      expect(
        derivePayoutAmounts({
          total_price: 500,
          subtotal: 500,
        }),
      ).toEqual({
        providerPayoutAmountPaise: 47500,
        platformCommissionPaise: 2500,
      });
    });
  });
});
