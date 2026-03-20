import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { selectPlaywrightServerStrategy } from "./playwright-server-selection.mjs";

const lockPath = path.join(process.cwd(), ".next", "dev", "lock");
const defaultBaseUrl = "http://127.0.0.1:3000";

const env = { ...process.env };
delete env.NO_COLOR;

const lockExists = fs.existsSync(lockPath);
const explicitBaseUrl = env.E2E_BASE_URL;

if (lockExists || explicitBaseUrl) {
  const decision = await selectPlaywrightServerStrategy({
    lockExists,
    explicitBaseUrl,
    defaultBaseUrl,
    e2ePort: env.E2E_PORT || "3405",
  });

  if (decision.reason) {
    console.warn(`[Playwright] ${decision.reason}`);
  }

  if (decision.action === "error") {
    process.exit(1);
  }

  if (decision.action === "reuse" && decision.reuseUrl) {
    env.E2E_BASE_URL = decision.reuseUrl;
    env.E2E_REUSE_SERVER = env.E2E_REUSE_SERVER || "1";
  } else if (decision.action === "managed") {
    delete env.E2E_BASE_URL;
    env.E2E_FORCE_WEB_SERVER = "1";

    if (decision.clearLock) {
      try {
        fs.rmSync(lockPath, { force: true });
      } catch {
        // ignore; Playwright config will warn if lock still exists
      }
    }
  }
}

const args = ["playwright", "test", ...process.argv.slice(2)];
const command = process.platform === "win32" ? "npx.cmd" : "npx";

const child = spawn(command, args, {
  stdio: "inherit",
  env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
