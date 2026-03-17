import { defineConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

if (process.env.FORCE_COLOR && process.env.NO_COLOR) {
  delete process.env.NO_COLOR;
}

const e2ePort = Number(process.env.E2E_PORT || 3405);
const devLockPath = path.join(process.cwd(), ".next", "dev", "lock");
const hasDevLock = fs.existsSync(devLockPath);
const forceWebServer = process.env.E2E_FORCE_WEB_SERVER === "1";
const baseURLFromEnv =
  process.env.E2E_BASE_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.NEXTAUTH_URL;
const baseURL =
  baseURLFromEnv ||
  (hasDevLock ? "http://127.0.0.1:3000" : `http://127.0.0.1:${e2ePort}`);
const useExternalBaseUrl = Boolean(baseURLFromEnv) || (hasDevLock && !forceWebServer);
// Fresh servers are slower, but reusing an arbitrary local process can point
// Playwright at stale code or env and create false failures.
const reuseExistingServer = process.env.E2E_REUSE_SERVER === "1";

if (hasDevLock && !baseURLFromEnv && !forceWebServer) {
  console.warn(
    "[Playwright] Detected .next/dev/lock. Skipping managed webServer. " +
      "Set E2E_BASE_URL if your dev server is not on http://127.0.0.1:3000.",
  );
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  // The smoke specs share seeded Mongo fixtures and test accounts.
  // Keep them serial to avoid cross-suite data races.
  workers: 1,
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
        command: `npm run start -- --port ${e2ePort}`,
        url: baseURL,
        timeout: 180_000,
        reuseExistingServer,
        env: {
          ...process.env,
          E2E_TEST_RUN: "1",
          HOST: process.env.E2E_HOST || "127.0.0.1",
          WATCHPACK_POLLING: process.env.WATCHPACK_POLLING || "true",
          CHOKIDAR_USEPOLLING: process.env.CHOKIDAR_USEPOLLING || "1",
          CHOKIDAR_INTERVAL: process.env.CHOKIDAR_INTERVAL || "1000",
          E2E_DISABLE_DEV_LOCK: process.env.E2E_DISABLE_DEV_LOCK || "1",
          AUTH_URL: process.env.AUTH_URL || process.env.NEXTAUTH_URL || baseURL,
          NEXTAUTH_URL: process.env.NEXTAUTH_URL || baseURL,
          NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || baseURL,
          NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || baseURL,
          E2E_FAKE_PAYMENTS: process.env.E2E_FAKE_PAYMENTS || "1",
          RAZORPAYX_ACCOUNT_NUMBER:
            process.env.RAZORPAYX_ACCOUNT_NUMBER || "acc_e2e_test",
        },
      },
});
