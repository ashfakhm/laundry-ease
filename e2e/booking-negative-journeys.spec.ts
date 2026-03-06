import { test, expect, type Browser, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import {
  getSmokeDbConfig,
  smokeUsers,
  seedSmokeData,
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

async function confirmBookingCancellation(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Cancel Booking" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Yes, Cancel/i }).click();
}

test.describe("booking negative journeys", () => {
  let seed: Awaited<ReturnType<typeof seedSmokeData>>;

  test.beforeAll(async () => {
    seed = await seedSmokeData({ namespace: "negative-journeys" });
  });

  test("provider can reject a pending booking", async ({ browser }) => {
    const { mongoUri, dbName } = getSmokeDbConfig();
    const client = new MongoClient(mongoUri);
    const bookingId = new ObjectId();
    const idFragment = bookingId.toString().slice(-6).toUpperCase();

    await client.connect();
    try {
      await client
        .db(dbName)
        .collection("bookings")
        .insertOne({
          _id: bookingId,
          seeker_id: seed.seekerId,
          provider_id: seed.providerId,
          status: "requested",
          bookingFee: 149,
          bookingFeeStatus: "paid",
          razorpay_payment_id: `pay_e2e_reject_${bookingId.toString()}`,
          razorpay_order_id: `order_e2e_reject_${bookingId.toString()}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
    } finally {
      await client.close();
    }

    // Provider logs in and rejects the booking via manage-booking list page
    await runAsRole(
      browser,
      smokeUsers.provider.email,
      smokeUsers.provider.password,
      async (page) => {
        await page.waitForURL("**/provider");

        await page.goto("/provider/manage-booking");
        await expect(
          page.getByRole("heading", { name: "Manage Bookings" }),
        ).toBeVisible();

        // Find the booking card by its ID fragment
        const card = page.locator("article").filter({
          hasText: `#${idFragment}`,
        });
        await expect(card).toBeVisible({ timeout: 10000 });

        // Click the Decline button
        const declineBtn = card.getByRole("button", { name: /^Decline$/ });
        await expect(declineBtn).toBeVisible();

        page.once("dialog", (dialog) => dialog.accept());
        await declineBtn.click();

        // Rejected bookings leave the pending filter immediately.
        await expect(card).toHaveCount(0, { timeout: 10000 });
      },
    );

    // Verify DB state
    await client.connect();
    try {
      const booking = await client
        .db(dbName)
        .collection("bookings")
        .findOne({ _id: bookingId });
      expect(booking?.status).toBe("rejected");
    } finally {
      await client.close();
    }
  });

  test("seeker can cancel an accepted booking before slot time", async ({
    browser,
  }) => {
    const { mongoUri, dbName } = getSmokeDbConfig();
    const client = new MongoClient(mongoUri);
    const bookingId = new ObjectId();
    const idFragment = bookingId.toString().slice(-6).toUpperCase();

    // Future slot (not same-day to ensure refundable state)
    const futureSlot = new Date();
    futureSlot.setDate(futureSlot.getDate() + 3);

    await client.connect();
    try {
      await client
        .db(dbName)
        .collection("bookings")
        .insertOne({
          _id: bookingId,
          seeker_id: seed.seekerId,
          provider_id: seed.providerId,
          status: "accepted",
          bookingFee: 149,
          bookingFeeStatus: "paid",
          razorpay_payment_id: `pay_e2e_cancel_${bookingId.toString()}`,
          razorpay_order_id: `order_e2e_cancel_${bookingId.toString()}`,
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

    // Seeker logs in and cancels via bookings list page
    await runAsRole(
      browser,
      smokeUsers.seeker.email,
      smokeUsers.seeker.password,
      async (page) => {
        await page.waitForURL("**/seeker");

        await page.goto("/seeker/bookings");
        await expect(
          page.getByRole("heading", { name: "My Bookings" }),
        ).toBeVisible();

        // Click "Accepted" tab to find the booking
        const acceptedTab = page.getByRole("button", { name: /Accepted/i });
        await acceptedTab.click();

        // Find booking card by ID fragment
        const card = page.locator("article, [class*='card']").filter({
          hasText: `#${idFragment}`,
        });
        await expect(card.first()).toBeVisible({ timeout: 10000 });

        // Click cancel
        const cancelBtn = card
          .first()
          .getByRole("button", { name: /Cancel Request/i });
        await expect(cancelBtn).toBeVisible();

        await cancelBtn.click();
        await confirmBookingCancellation(page);

        // Verify status changed to cancelled
        await expect(
          page.getByText(/Cancelled/i).first(),
        ).toBeVisible({ timeout: 10000 });
      },
    );

    // Verify DB state
    await client.connect();
    try {
      const booking = await client
        .db(dbName)
        .collection("bookings")
        .findOne({ _id: bookingId });
      expect(booking?.status).toBe("cancelled");
    } finally {
      await client.close();
    }
  });
});
