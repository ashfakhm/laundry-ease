import { test, expect, type Browser, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";
import {
  getSmokeDbConfig,
  seedSettlementJourneyData,
  smokeUsers,
  type SettlementSeedResult,
} from "./support/smoke-seed";
import { loginViaCredentials } from "./support/auth";

async function runAsRole(
  browser: Browser,
  email: string,
  password: string,
  callback: (page: Page) => Promise<void>,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await loginViaCredentials(page, email, password);
    await callback(page);
  } finally {
    await context.close();
  }
}

async function confirmAdminResolution(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Confirm Action" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yes, proceed" }).click();

  const redirectedToList = await page
    .waitForURL("**/admin/complaints", { timeout: 15_000 })
    .then(() => true)
    .catch(() => false);

  if (!redirectedToList) {
    await expect(
      page.getByRole("heading", { name: "Settlement Summary" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();
    await page.waitForURL("**/admin/complaints");
  }
}

function isCloseTo(actual: unknown, expected: number): boolean {
  return Math.abs(Number(actual) - expected) <= 0.01;
}

function formatInr(amount: number): string {
  return `INR ${amount.toFixed(2)}`;
}

type AdminSettlementAction = "split_equal" | "seeker_full" | "reject";

type SettlementExpectation = {
  complaintStatus: "resolved" | "rejected";
  complaintOutcome: "refund_partial" | "refund_full" | "release_payout";
  orderPaymentStatus: "released" | "refunded";
  seekerRefundAmount: number;
  providerPayoutAmount: number;
  expectPayoutId: boolean;
  expectRefundId: boolean;
};

async function finalizeComplaintAsAdmin(
  browser: Browser,
  seed: SettlementSeedResult,
  action: AdminSettlementAction,
) {
  await runAsRole(
    browser,
    smokeUsers.admin.email,
    smokeUsers.admin.password,
    async (page) => {
      await page.waitForURL("**/admin");
      await page.goto(`/admin/complaints/${seed.complaintId.toString()}`);
      await expect(page.getByText(seed.complaintTitle)).toBeVisible();

      const acceptButton = page.getByRole("button", {
        name: "Accept Complaint",
      });
      if (await acceptButton.isVisible()) {
        await acceptButton.click();
      }

      if (action === "reject") {
        await expect(
          page.getByRole("button", { name: "Reject Complaint" }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Reject Complaint" }).click();
        await confirmAdminResolution(page);
      } else {
        await expect(
          page.getByRole("button", { name: "Apply Settlement" }),
        ).toBeVisible();

        if (action === "split_equal") {
          await page.getByRole("button", { name: "50 / 50" }).click();
          await expect(
            page
              .locator("p", { hasText: "Seeker Refund" })
              .locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]")
              .getByText(formatInr(seed.expectedHalfSettlement), {
                exact: true,
              }),
          ).toBeVisible();
        } else {
          await page.getByRole("button", { name: "Seeker Full" }).click();
          await expect(
            page
              .locator("p", { hasText: "Seeker Refund" })
              .locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]")
              .getByText(formatInr(seed.expectedDistributableAmount), {
                exact: true,
              }),
          ).toBeVisible();
          await expect(
            page
              .locator("p", { hasText: "Provider Payout" })
              .locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]")
              .getByText(formatInr(0), { exact: true }),
          ).toBeVisible();
        }

        await page.getByRole("button", { name: "Apply Settlement" }).click();
        await confirmAdminResolution(page);
      }

      await expect(
        page.getByRole("heading", { name: "Complaints Management" }),
      ).toBeVisible();
    },
  );
}

async function assertSettlementOutcome(
  seed: SettlementSeedResult,
  expected: SettlementExpectation,
) {
  const { mongoUri, dbName } = getSmokeDbConfig();
  const client = new MongoClient(mongoUri);
  await client.connect();
  try {
    const db = client.db(dbName);

    await expect
      .poll(async () => {
        const complaint = await db
          .collection("complaints")
          .findOne({ _id: seed.complaintId });
        return complaint?.status || null;
      })
      .toBe(expected.complaintStatus);

    await expect
      .poll(async () => {
        const order = await db.collection("orders").findOne({ _id: seed.orderId });
        return order?.payment_status || null;
      })
      .toBe(expected.orderPaymentStatus);

    const complaint = await db
      .collection("complaints")
      .findOne({ _id: seed.complaintId });
    const order = await db.collection("orders").findOne({ _id: seed.orderId });

    expect(complaint).toBeTruthy();
    expect(order).toBeTruthy();

    expect(complaint?.status).toBe(expected.complaintStatus);
    expect(complaint?.resolution_outcome).toBe(expected.complaintOutcome);
    expect(complaint?.provider_access_granted).toBe(false);

    expect(
      isCloseTo(
        complaint?.resolution_breakdown?.seeker_refund_amount,
        expected.seekerRefundAmount,
      ),
    ).toBe(true);
    expect(
      isCloseTo(
        complaint?.resolution_breakdown?.provider_payout_amount,
        expected.providerPayoutAmount,
      ),
    ).toBe(true);
    expect(
      isCloseTo(
        complaint?.resolution_breakdown?.platform_commission,
        seed.expectedPlatformCommission,
      ),
    ).toBe(true);

    expect(order?.payment_status).toBe(expected.orderPaymentStatus);
    expect(
      isCloseTo(order?.provider_payout_amount, expected.providerPayoutAmount),
    ).toBe(true);
    expect(
      isCloseTo(order?.platform_commission, seed.expectedPlatformCommission),
    ).toBe(true);

    if (expected.seekerRefundAmount > 0) {
      expect(isCloseTo(order?.refund_amount, expected.seekerRefundAmount)).toBe(
        true,
      );
    } else {
      expect((order?.refund_amount as number | undefined) ?? 0).toBe(0);
    }

    if (expected.expectPayoutId) {
      expect(String(order?.payout_id || "")).toContain("pout_e2e");
    }
    if (expected.expectRefundId) {
      expect(String(order?.razorpay_refund_id || "")).toContain("rfnd_e2e");
    }
  } finally {
    await client.close();
  }
}

async function assertParticipantAccessRevoked(
  browser: Browser,
  complaintId: string,
) {
  await runAsRole(
    browser,
    smokeUsers.seeker.email,
    smokeUsers.seeker.password,
    async (page) => {
      await page.waitForURL("**/seeker");
      await page.goto(`/seeker/disputes/${complaintId}`);
      await expect(page.getByText("Access Denied")).toBeVisible();
    },
  );

  await runAsRole(
    browser,
    smokeUsers.provider.email,
    smokeUsers.provider.password,
    async (page) => {
      await page.waitForURL("**/provider");
      await page.goto(`/provider/disputes/${complaintId}`);
      await expect(page.getByText("Access Denied")).toBeVisible();
    },
  );
}

test.describe("settlement chain journey", () => {
  test("admin can settle complaint with 50/50 split and lock participant access", async ({
    browser,
  }) => {
    const seed = await seedSettlementJourneyData({
      complaintTitle: "Settlement Chain E2E - Split Outcome",
    });

    await finalizeComplaintAsAdmin(browser, seed, "split_equal");
    await assertSettlementOutcome(seed, {
      complaintStatus: "resolved",
      complaintOutcome: "refund_partial",
      orderPaymentStatus: "released",
      seekerRefundAmount: seed.expectedHalfSettlement,
      providerPayoutAmount: seed.expectedHalfSettlement,
      expectPayoutId: true,
      expectRefundId: true,
    });
    await assertParticipantAccessRevoked(browser, seed.complaintId.toString());
  });

  test("admin can reject complaint and release provider-favor payout", async ({
    browser,
  }) => {
    const seed = await seedSettlementJourneyData({
      complaintTitle: "Settlement Chain E2E - Reject Outcome",
    });

    await finalizeComplaintAsAdmin(browser, seed, "reject");
    await assertSettlementOutcome(seed, {
      complaintStatus: "rejected",
      complaintOutcome: "release_payout",
      orderPaymentStatus: "released",
      seekerRefundAmount: 0,
      providerPayoutAmount: seed.expectedDistributableAmount,
      expectPayoutId: true,
      expectRefundId: false,
    });
    await assertParticipantAccessRevoked(browser, seed.complaintId.toString());
  });

  test("admin can resolve complaint in full seeker favor", async ({ browser }) => {
    const seed = await seedSettlementJourneyData({
      complaintTitle: "Settlement Chain E2E - Seeker Full Outcome",
    });

    await finalizeComplaintAsAdmin(browser, seed, "seeker_full");
    await assertSettlementOutcome(seed, {
      complaintStatus: "resolved",
      complaintOutcome: "refund_full",
      orderPaymentStatus: "refunded",
      seekerRefundAmount: seed.expectedDistributableAmount,
      providerPayoutAmount: 0,
      expectPayoutId: false,
      expectRefundId: true,
    });
    await assertParticipantAccessRevoked(browser, seed.complaintId.toString());
  });
});
