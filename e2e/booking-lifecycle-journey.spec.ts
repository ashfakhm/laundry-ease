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

  test("provider accepts booking and arrives via manage-booking page", async ({
    browser,
  }) => {
    const { mongoUri, dbName } = getSmokeDbConfig();
    const client = new MongoClient(mongoUri);

    // Seed a fresh "requested" booking for the lifecycle test
    const bookingId = new ObjectId();
    const idFragment = bookingId.toString().slice(-6).toUpperCase();

    await client.connect();
    const db = client.db(dbName);

    try {
      await db.collection("bookings").insertOne({
        _id: bookingId,
        seeker_id: seed.seekerId,
        provider_id: seed.providerId,
        status: "requested",
        bookingFee: 149,
        bookingFeeStatus: "paid",
        pickupSlot: {
          dateTime: new Date(Date.now() + 2 * 86400000),
          confirmedAt: new Date(),
        },
        deadline: new Date(Date.now() + 3 * 86400000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } finally {
      await client.close();
    }

    // STEP 1: Provider accepts the booking via manage-booking list page
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

        // Accept the booking
        const acceptBtn = card.getByRole("button", { name: /^Accept$/ });
        await expect(acceptBtn).toBeVisible();
        page.once("dialog", (dialog) => dialog.accept());
        await acceptBtn.click();

        // Wait for status to change - the card should update
        await expect(
          card.getByText(/Accepted|Proposed|Confirmed/i).first(),
        ).toBeVisible({ timeout: 10000 });
      },
    );

    // STEP 2: Fast-forward booking to "confirmed" state via DB (bypass schedule negotiation)
    await client.connect();
    try {
      await client
        .db(dbName)
        .collection("bookings")
        .updateOne(
          { _id: bookingId },
          {
            $set: {
              status: "confirmed",
              pickupSlot: {
                dateTime: new Date(Date.now() + 2 * 86400000),
                confirmedAt: new Date(),
              },
              updatedAt: new Date(),
            },
          },
        );
    } finally {
      await client.close();
    }

    // STEP 3: Provider marks arrival
    await runAsRole(
      browser,
      smokeUsers.provider.email,
      smokeUsers.provider.password,
      async (page) => {
        await page.goto("/provider/manage-booking");
        await expect(
          page.getByRole("heading", { name: "Manage Bookings" }),
        ).toBeVisible();

        // Click "Confirmed" tab to find our booking
        const confirmedTab = page.getByRole("button", { name: /Confirmed/i });
        await confirmedTab.click();

        const card = page.locator("article").filter({
          hasText: `#${idFragment}`,
        });
        await expect(card).toBeVisible({ timeout: 10000 });

        // Mark arrived
        const arriveBtn = card.getByRole("button", {
          name: /I Have Arrived/i,
        });
        await expect(arriveBtn).toBeVisible();
        page.once("dialog", (dialog) => dialog.accept());
        await arriveBtn.click();

        // After arrival, "Create Invoice" link should appear
        await expect(
          card.getByRole("link", { name: /Create Invoice/i }),
        ).toBeVisible({ timeout: 10000 });
      },
    );

    // Verify final DB state
    await client.connect();
    try {
      const booking = await client
        .db(dbName)
        .collection("bookings")
        .findOne({ _id: bookingId });
      expect(booking?.arrivedAt).toBeTruthy();
    } finally {
      await client.close();
    }
  });

  test("seeker sees booking in list and can cancel a requested booking", async ({
    browser,
  }) => {
    const { mongoUri, dbName } = getSmokeDbConfig();
    const client = new MongoClient(mongoUri);

    // Seed a "requested" booking
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
          createdAt: new Date(),
          updatedAt: new Date(),
        });
    } finally {
      await client.close();
    }

    // Seeker navigates to bookings list, finds the card, and cancels
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

        // Find booking card by ID fragment
        const card = page.locator("article, [class*='card']").filter({
          hasText: `#${idFragment}`,
        });
        await expect(card.first()).toBeVisible({ timeout: 10000 });

        // Cancel the booking
        const cancelBtn = card.first().getByRole("button", {
          name: /Cancel Request/i,
        });
        await expect(cancelBtn).toBeVisible();
        page.once("dialog", (dialog) => dialog.accept());
        await cancelBtn.click();

        // Verify status changed to cancelled
        await expect(
          page.getByText(/Cancelled/i).first(),
        ).toBeVisible({ timeout: 10000 });
      },
    );
  });
});
