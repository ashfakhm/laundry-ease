import { defineConfig } from "@playwright/test";

const e2ePort = Number(process.env.E2E_PORT || 3405);
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${e2ePort}`;
const useExternalBaseUrl = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "output/playwright/report" }],
  ],
  outputDir: "output/playwright/artifacts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    headless: true,
  },
  webServer: useExternalBaseUrl
    ? undefined
    : {
        command: `npm run dev -- --port ${e2ePort}`,
        url: baseURL,
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
        env: {
          ...process.env,
          NEXTAUTH_URL: process.env.NEXTAUTH_URL || baseURL,
          NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || baseURL,
          NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || baseURL,
          E2E_FAKE_PAYMENTS: process.env.E2E_FAKE_PAYMENTS || "1",
          RAZORPAYX_ACCOUNT_NUMBER:
            process.env.RAZORPAYX_ACCOUNT_NUMBER || "acc_e2e_test",
        },
      },
});
