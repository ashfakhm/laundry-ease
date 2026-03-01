import { test, expect, type Browser, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import {
  getSmokeDbConfig,
  smokeUsers,
  seedSmokeData,
} from "./support/smoke-seed";

async function loginViaCredentials(
  page: Page,
  email: string,
  password: string,
) {
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

test.describe("booking negative journeys", () => {
  let seed: Awaited<ReturnType<typeof seedSmokeData>>;

  test.beforeAll(async () => {
    // Seed standard smoke users
    seed = await seedSmokeData({ namespace: "negative-journeys" });
  });

  // TODO: These tests navigate to /provider/bookings/{id} and /seeker/bookings/{id}
  // which are not valid pages. Bookings are managed via list pages with card components.
  // Needs rewrite to match actual UI architecture.
  test.skip("provider can reject a pending booking", async ({ browser }) => {
    // 1. Manually create a pending booking in the DB to test the rejection flow
    const { mongoUri, dbName } = getSmokeDbConfig();
    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(dbName);
    const bookingId = new ObjectId();

    try {
      await db.collection("bookings").insertOne({
        _id: bookingId,
        seeker_id: seed.seekerId,
        provider_id: seed.providerId,
        status: "requested",
        bookingFee: 50,
        bookingFeeStatus: "paid",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } finally {
      await client.close();
    }

    // 2. Provider logs in and rejects the booking
    await runAsRole(
      browser,
      smokeUsers.provider.email,
      smokeUsers.provider.password,
      async (page) => {
        await page.waitForURL("**/provider");

        // Navigate to provider bookings
        await page.goto(`/provider/bookings/${bookingId.toString()}`);

        // Find and click the Decline button
        const rejectBtn = page.getByRole("button", { name: /Decline/i });
        await expect(rejectBtn).toBeVisible();

        page.once("dialog", (dialog) => dialog.accept());
        await rejectBtn.click();

        // Verify status changed
        await expect(
          page
            .getByText(/Declined|Rejected|Booking Declined/i, { exact: false })
            .first(),
        ).toBeVisible();
      },
    );
  });

  test.skip("seeker can cancel an accepted booking before slot time", async ({
    browser,
  }) => {
    // 1. Manually create an accepted booking with a future slot in the DB
    const { mongoUri, dbName } = getSmokeDbConfig();
    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(dbName);
    const bookingId = new ObjectId();

    // Future slot (not same-day to ensure refundable state)
    const futureSlot = new Date();
    futureSlot.setDate(futureSlot.getDate() + 3);

    try {
      await db.collection("bookings").insertOne({
        _id: bookingId,
        seeker_id: seed.seekerId,
        provider_id: seed.providerId,
        status: "accepted",
        bookingFee: 50,
        bookingFeeStatus: "paid",
        pickupSlot: {
          dateTime: futureSlot,
          confirmedAt: new Date(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } finally {
      await client.close();
    }

    // 2. Seeker logs in and cancels
    await runAsRole(
      browser,
      smokeUsers.seeker.email,
      smokeUsers.seeker.password,
      async (page) => {
        await page.waitForURL("**/seeker");

        // Navigate to booking details
        await page.goto(`/seeker/bookings/${bookingId.toString()}`);

        // Click cancel
        const cancelBtn = page.getByRole("button", { name: /Cancel Request/i });
        await expect(cancelBtn).toBeVisible();

        page.once("dialog", (dialog) => dialog.accept());
        await cancelBtn.click();

        // Verify status changed to cancelled
        await expect(
          page.getByText(/Cancelled/i, { exact: false }).first(),
        ).toBeVisible();
      },
    );
  });
});
