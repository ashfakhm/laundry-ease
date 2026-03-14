import { test, expect } from "@playwright/test";
import { smokeUsers, seedSmokeData } from "./support/smoke-seed";
import { loginViaCredentials } from "./support/auth";
import fs from "node:fs";

// This test assumes a booking with an invoice already exists for the provider
// and that the provider can access the invoice download page.
test.describe("invoice PDF download", () => {
  let seed: Awaited<ReturnType<typeof seedSmokeData>>;
  let orderId: string;

  test.beforeAll(async () => {
    seed = await seedSmokeData({ namespace: "invoice-download" });
    orderId = seed.orderId.toString();
  });

  test("provider can download invoice PDF", async ({ context }) => {
    const page = await context.newPage();
    await loginViaCredentials(
      page,
      smokeUsers.provider.email,
      smokeUsers.provider.password,
    );
    // Go to the invoice generation/download page
    await page.goto("/provider/invoice-generation");

    const orderSuffix = orderId.slice(-8);
    const card = page.locator("div", {
      has: page.getByText(`#${orderSuffix}`, { exact: true }),
    });
    await expect(card.first()).toBeVisible();

    // Wait for the download button within the seeded order card
    const downloadBtn = card
      .first()
      .getByRole("button", { name: /download/i });
    await expect(downloadBtn).toBeVisible();

    // Intercept the download
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      downloadBtn.click(),
    ]);
    // Save the file to a temp location
    const filePath = test.info().outputPath(`invoice-${orderSuffix}.pdf`);
    await download.saveAs(filePath);
    // Optionally, check the file is a PDF and not empty
    const buffer = fs.readFileSync(filePath);
    expect(buffer.length).toBeGreaterThan(1000); // Should be a non-trivial PDF
    expect(buffer.slice(0, 4).toString()).toBe("%PDF");
  });
});
