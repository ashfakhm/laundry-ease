import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";

const lockPath = path.join(process.cwd(), ".next", "dev", "lock");
const defaultBaseUrl = "http://127.0.0.1:3000";

function pingServer(url, timeoutMs = 1000) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === "https:" ? https : http;
      const req = lib.request(
        {
          method: "GET",
          host: parsed.hostname,
          port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
          path: "/",
          timeout: timeoutMs,
        },
        (res) => {
          res.resume();
          resolve(true);
        },
      );
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.on("error", () => resolve(false));
      req.end();
    } catch {
      resolve(false);
    }
  });
}

const env = { ...process.env };
delete env.NO_COLOR;

if (fs.existsSync(lockPath)) {
  const explicitBaseUrl = env.E2E_BASE_URL;
  const e2ePort = env.E2E_PORT || "3405";
  const candidateUrls = explicitBaseUrl
    ? [explicitBaseUrl]
    : [defaultBaseUrl, `http://127.0.0.1:${e2ePort}`];

  let reachableUrl;
  for (const url of candidateUrls) {
    // eslint-disable-next-line no-await-in-loop
    if (await pingServer(url)) {
      reachableUrl = url;
      break;
    }
  }

  if (reachableUrl) {
    env.E2E_BASE_URL = reachableUrl;
    env.E2E_REUSE_SERVER = env.E2E_REUSE_SERVER || "1";
  } else if (!explicitBaseUrl) {
    try {
      fs.rmSync(lockPath, { force: true });
      env.E2E_FORCE_WEB_SERVER = "1";
    } catch {
      // ignore; Playwright config will warn if lock still exists
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
