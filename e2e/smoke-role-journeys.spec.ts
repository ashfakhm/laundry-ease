import { test, expect, type Page } from "@playwright/test";
import { seedSmokeData, smokeUsers } from "./support/smoke-seed";

async function loginViaCredentials(page: Page, email: string, password: string) {
  await page.goto("/auth");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page
    .locator('form[aria-label="Sign in form"] input[type="email"]')
    .fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /^Sign in$/ }).click();
}

test.describe("critical role smoke journeys", () => {
  test.beforeAll(async () => {
    await seedSmokeData({ namespace: "role-smoke" });
  });

  test("seeker can sign in and access disputes journey", async ({ page }) => {
    await loginViaCredentials(
      page,
      smokeUsers.seeker.email,
      smokeUsers.seeker.password,
    );

    await page.waitForURL("**/seeker");
    await expect(
      page.getByRole("heading", { name: "Find Laundry Providers" }),
    ).toBeVisible();

    const disputesLink = page.getByRole("link", { name: /Disputes/ });
    await expect(disputesLink).toBeVisible();
    await disputesLink.click();

    await page.waitForURL("**/seeker/disputes");
    await expect(
      page.getByRole("heading", { name: "Active Disputes" }),
    ).toBeVisible();
  });

  test("provider can sign in and open dispute cases", async ({ page }) => {
    await loginViaCredentials(
      page,
      smokeUsers.provider.email,
      smokeUsers.provider.password,
    );

    await page.waitForURL("**/provider");
    await expect(
      page.getByRole("heading", { name: "Provider Dashboard" }),
    ).toBeVisible();

    const disputesLink = page.getByRole("link", { name: /^Disputes/ });
    await expect(disputesLink).toBeVisible();
    await disputesLink.click();

    await page.waitForURL("**/provider/disputes");
    await expect(
      page.getByRole("heading", { name: "Dispute Cases" }),
    ).toBeVisible();
  });

  test("admin can sign in and review complaints queue", async ({ page }) => {
    await loginViaCredentials(
      page,
      smokeUsers.admin.email,
      smokeUsers.admin.password,
    );

    await page.waitForURL("**/admin");
    await expect(
      page.getByRole("heading", { name: "Admin Overview" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Complaints" }).click();
    await page.waitForURL("**/admin/complaints");
    await expect(
      page.getByRole("heading", { name: "Complaints Management" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View Details" }).first(),
    ).toBeVisible();
  });
});
