import { expect, type Page } from "@playwright/test";
import { smokeUsers } from "./smoke-seed";

function getExpectedRole(email: string): "seeker" | "provider" | "admin" {
  if (email === smokeUsers.provider.email) return "provider";
  if (email === smokeUsers.admin.email) return "admin";
  return "seeker";
}

export async function loginViaCredentials(
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

  const expectedRole = getExpectedRole(email);
  await expect
    .poll(
      async () => {
        const res = await page.request.get("/api/auth/session");
        const session = await res.json().catch(() => null);
        return session?.user?.role ?? null;
      },
      { timeout: 30_000 },
    )
    .toBe(expectedRole);

  const expectedPath = `/${expectedRole}`;
  if (!page.url().includes(expectedPath)) {
    await page.goto(expectedPath);
  }
}
