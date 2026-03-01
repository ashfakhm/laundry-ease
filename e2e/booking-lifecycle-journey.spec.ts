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

test.describe("booking lifecycle journey", () => {
  let seed: Awaited<ReturnType<typeof seedSmokeData>>;

  test.beforeAll(async () => {
    seed = await seedSmokeData({ namespace: "full-lifecycle" });
  });

  // TODO: This test navigates to /provider/bookings/{id} and /seeker/bookings/{id}
  // which are not valid pages. Booking management uses list pages
  // (/provider/bookings, /seeker/bookings) with card components.
  // The test also used non-canonical states ("pending", "in_progress").
  // Needs full rewrite to match actual UI architecture.
  test.skip("full booking lifecycle (seeker request -> provider accept -> arrive -> invoice -> complete)", async ({
    browser,
  }) => {
    const { mongoUri, dbName } = getSmokeDbConfig();
    const client = new MongoClient(mongoUri);
    let currentBookingId: string | undefined;

    // STEP 1: Seeker requests a booking
    await runAsRole(
      browser,
      smokeUsers.seeker.email,
      smokeUsers.seeker.password,
      async (page) => {
        await page.waitForURL("**/seeker");

        // Find provider and request booking
        await page.goto(`/seeker/providers/${seed.providerId.toString()}`);

        const requestBtn = page.getByRole("button", {
          name: /Request Booking/i,
        });
        await expect(requestBtn).toBeVisible();
        await requestBtn.click();

        // Wait for redirect to checkout or booking page
        await page.waitForURL(/.*\/bookings\/[a-f0-9]+.*/);
        currentBookingId = page.url().split("/").pop();
        expect(currentBookingId).toBeDefined();
      },
    );

    expect(currentBookingId).toBeTruthy();

    // STEP 2: Bypass Razorpay Booking Fee via DB
    await client.connect();
    const db = client.db(dbName);

    await db.collection("bookings").updateOne(
      { _id: new ObjectId(currentBookingId) },
      {
        $set: {
          status: "requested",
          bookingFeeStatus: "paid",
          bookingFee: 50,
          pickupSlot: {
            dateTime: new Date(Date.now() + 86400000), // tomorrow
            confirmedAt: new Date(),
          },
          updatedAt: new Date(),
        },
      },
    );
    await client.close();

    // STEP 3: Provider accepts booking and marks arrival
    await runAsRole(
      browser,
      smokeUsers.provider.email,
      smokeUsers.provider.password,
      async (page) => {
        await page.goto(`/provider/bookings/${currentBookingId}`);

        // Accept
        const acceptBtn = page.getByRole("button", { name: /Accept/i });
        if (await acceptBtn.isVisible()) {
          page.once("dialog", (dialog) => dialog.accept());
          await acceptBtn.click();
        }

        // Fast forward: Bypass schedule negotiation for E2E simplicity (or assume flexible)
        // Mark Arrived
        const arriveBtn = page.getByRole("button", { name: /I Have Arrived/i });
        if (await arriveBtn.isVisible()) {
          page.once("dialog", (dialog) => dialog.accept());
          await arriveBtn.click();
        }

        // Create Invoice
        const generateInvoiceLink = page.getByRole("link", {
          name: /Create Invoice/i,
        });
        if (await generateInvoiceLink.isVisible()) {
          await generateInvoiceLink.click();
          // Fill dummy invoice
          await page.getByPlaceholder(/Amount/i).fill("500");
          await page
            .getByRole("button", { name: /Submit|Create Invoice|Send/i })
            .first()
            .click();
        }
      },
    );

    // STEP 4: Bypass Razorpay Invoice Payment and generate Order via DB
    await client.connect();
    const dbInvoice = client.db(dbName);
    const orderId = new ObjectId();

    // Simulate invoice payment webhooks success
    await dbInvoice
      .collection("bookings")
      .updateOne(
        { _id: new ObjectId(currentBookingId) },
        {
          $set: {
            status: "completed",
            order_id: orderId,
            updatedAt: new Date(),
          },
        },
      );

    await dbInvoice.collection("orders").insertOne({
      _id: orderId,
      booking_id: new ObjectId(currentBookingId),
      seeker_id: seed.seekerId,
      provider_id: seed.providerId,
      process_status: "processing",
      payment_status: "held",
      total_price: 500,
      delivery_charge: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await client.close();

    // STEP 5: Provider marks as delivered
    await runAsRole(
      browser,
      smokeUsers.provider.email,
      smokeUsers.provider.password,
      async (page) => {
        await page.goto(`/provider/orders/${orderId.toString()}`);

        // Mark Delivered
        const deliverBtn = page.getByRole("button", {
          name: /Mark Delivered/i,
        });
        if (await deliverBtn.isVisible()) {
          await deliverBtn.click();
        }
      },
    );
  });
});
