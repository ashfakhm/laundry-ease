import { test, expect, type Browser, type Page } from "@playwright/test";
import { seedSmokeData, smokeUsers } from "./support/smoke-seed";
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

test.describe("complaint chat multi-role journey", () => {
  let complaintId = "";

  test.beforeAll(async () => {
    const seed = await seedSmokeData({ namespace: "chat-smoke" });
    complaintId = seed.complaintId.toString();
  });

  test("seeker, provider, and admin can exchange messages in one complaint", async ({
    browser,
  }) => {
    const suffix = Date.now().toString();
    const seekerMsg = `Seeker smoke message ${suffix}`;
    const providerMsg = `Provider smoke message ${suffix}`;
    const adminMsg = `Admin smoke message ${suffix}`;

    await runAsRole(
      browser,
      smokeUsers.seeker.email,
      smokeUsers.seeker.password,
      async (page) => {
        await page.waitForURL("**/seeker");
        await page.goto(`/seeker/disputes/${complaintId}`);
        await expect(
          page.getByRole("heading", {
            name: "Smoke complaint for role navigation",
          }),
        ).toBeVisible();
        await expect(
          page.getByPlaceholder("Type a message..."),
        ).toBeVisible();

        await page.getByPlaceholder("Type a message...").fill(seekerMsg);
        await page.getByPlaceholder("Type a message...").press("Enter");
        await expect(page.getByText(seekerMsg)).toBeVisible();
      },
    );

    await runAsRole(
      browser,
      smokeUsers.provider.email,
      smokeUsers.provider.password,
      async (page) => {
        await page.waitForURL("**/provider");
        await page.goto(`/provider/disputes/${complaintId}`);
        await expect(
          page.getByRole("heading", {
            name: "Smoke complaint for role navigation",
          }),
        ).toBeVisible();
        await expect(page.getByText(seekerMsg)).toBeVisible();
        await expect(
          page.getByText("Smoke Seeker (Seeker)").first(),
        ).toBeVisible();

        await page.getByPlaceholder("Type a message...").fill(providerMsg);
        await page.getByPlaceholder("Type a message...").press("Enter");
        await expect(page.getByText(providerMsg)).toBeVisible();
      },
    );

    await runAsRole(
      browser,
      smokeUsers.admin.email,
      smokeUsers.admin.password,
      async (page) => {
        await page.waitForURL("**/admin");
        await page.goto(`/admin/complaints/${complaintId}`);
        await expect(
          page.getByRole("heading", { name: /Complaint #/i }),
        ).toBeVisible();
        await expect(page.getByText(seekerMsg)).toBeVisible();
        await expect(page.getByText(providerMsg)).toBeVisible();
        await expect(
          page.getByText("Smoke Provider (Provider)").first(),
        ).toBeVisible();

        await page.getByPlaceholder("Type a message...").fill(adminMsg);
        await page.getByPlaceholder("Type a message...").press("Enter");
        await expect(page.getByText(adminMsg)).toBeVisible();
      },
    );

    await runAsRole(
      browser,
      smokeUsers.seeker.email,
      smokeUsers.seeker.password,
      async (page) => {
        await page.waitForURL("**/seeker");
        await page.goto(`/seeker/disputes/${complaintId}`);
        await expect(page.getByText(adminMsg)).toBeVisible();
        await expect(page.locator("p", { hasText: /^Admin$/ }).first()).toBeVisible();
      },
    );
  });
});
