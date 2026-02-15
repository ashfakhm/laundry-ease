import { test, expect, type Browser, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";
import {
  getSmokeDbConfig,
  seedSettlementJourneyData,
  smokeUsers,
  type SettlementSeedResult,
} from "./support/smoke-seed";

async function loginViaCredentials(page: Page, email: string, password: string) {
  await page.goto("/auth");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page
    .locator('form[aria-label="Sign in form"] input[type="email"]')
    .fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /^Sign in$/ }).click();
}

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

function isCloseTo(actual: unknown, expected: number): boolean {
  return Math.abs(Number(actual) - expected) <= 0.01;
}

test.describe("settlement chain journey", () => {
  let seed: SettlementSeedResult;

  test.beforeAll(async () => {
    seed = await seedSettlementJourneyData();
  });

  test("admin can settle complaint with split payout and lock participant access", async ({
    browser,
  }) => {
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

        await expect(
          page.getByRole("button", { name: "Apply Settlement" }),
        ).toBeVisible();
        await page.getByRole("button", { name: "50 / 50" }).click();

        page.once("dialog", (dialog) => dialog.accept());
        await page.getByRole("button", { name: "Apply Settlement" }).click();

        await page.waitForURL("**/admin/complaints");
        await expect(
          page.getByRole("heading", { name: "Complaints Management" }),
        ).toBeVisible();
      },
    );

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
        .toBe("resolved");

      const complaint = await db
        .collection("complaints")
        .findOne({ _id: seed.complaintId });
      const order = await db.collection("orders").findOne({ _id: seed.orderId });

      expect(complaint).toBeTruthy();
      expect(order).toBeTruthy();

      expect(complaint?.status).toBe("resolved");
      expect(complaint?.resolution_outcome).toBe("refund_partial");
      expect(complaint?.provider_access_granted).toBe(false);
      expect(
        isCloseTo(
          complaint?.resolution_breakdown?.seeker_refund_amount,
          seed.expectedHalfSettlement,
        ),
      ).toBe(true);
      expect(
        isCloseTo(
          complaint?.resolution_breakdown?.provider_payout_amount,
          seed.expectedHalfSettlement,
        ),
      ).toBe(true);
      expect(
        isCloseTo(
          complaint?.resolution_breakdown?.platform_commission,
          seed.expectedPlatformCommission,
        ),
      ).toBe(true);

      expect(order?.payment_status).toBe("released");
      expect(isCloseTo(order?.provider_payout_amount, seed.expectedHalfSettlement)).toBe(
        true,
      );
      expect(
        isCloseTo(order?.platform_commission, seed.expectedPlatformCommission),
      ).toBe(true);
      expect(isCloseTo(order?.refund_amount, seed.expectedHalfSettlement)).toBe(
        true,
      );
      expect(String(order?.payout_id || "")).toContain("pout_e2e");
      expect(String(order?.razorpay_refund_id || "")).toContain("rfnd_e2e");
    } finally {
      await client.close();
    }

    await runAsRole(
      browser,
      smokeUsers.seeker.email,
      smokeUsers.seeker.password,
      async (page) => {
        await page.waitForURL("**/seeker");
        await page.goto(`/seeker/disputes/${seed.complaintId.toString()}`);
        await expect(page.getByText("Access Denied")).toBeVisible();
      },
    );

    await runAsRole(
      browser,
      smokeUsers.provider.email,
      smokeUsers.provider.password,
      async (page) => {
        await page.waitForURL("**/provider");
        await page.goto(`/provider/disputes/${seed.complaintId.toString()}`);
        await expect(page.getByText("Access Denied")).toBeVisible();
      },
    );
  });
});
