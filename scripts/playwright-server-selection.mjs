import http from "node:http";
import https from "node:https";

/**
 * @typedef {{
 *   safeForSmokeReuse: boolean;
 *   e2eFakePayments: boolean;
 *   razorpayxConfigured: boolean;
 *   nodeEnv: string;
 * }} RuntimeProbe
 */

/**
 * @typedef {{
 *   lockExists: boolean;
 *   explicitBaseUrl?: string;
 *   defaultBaseUrl?: string;
 *   e2ePort?: string;
 *   pingServerFn?: typeof pingServer;
 *   fetchRuntimeProbeFn?: typeof fetchRuntimeProbe;
 * }} ServerStrategyInput
 */

function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, "");
}

function buildProbeUrl(baseUrl) {
  return `${normalizeBaseUrl(baseUrl)}/api/e2e/runtime`;
}

function describeProbe(probe) {
  return `nodeEnv=${probe.nodeEnv}, e2eFakePayments=${probe.e2eFakePayments}, razorpayxConfigured=${probe.razorpayxConfigured}, safeForSmokeReuse=${probe.safeForSmokeReuse}`;
}

function parseRuntimeProbe(payload) {
  const candidate =
    payload && typeof payload === "object" && payload.data
      ? payload.data
      : payload;

  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const {
    safeForSmokeReuse,
    e2eFakePayments,
    razorpayxConfigured,
    nodeEnv,
  } = candidate;

  if (
    typeof safeForSmokeReuse !== "boolean" ||
    typeof e2eFakePayments !== "boolean" ||
    typeof razorpayxConfigured !== "boolean" ||
    typeof nodeEnv !== "string"
  ) {
    return null;
  }

  return {
    safeForSmokeReuse,
    e2eFakePayments,
    razorpayxConfigured,
    nodeEnv,
  };
}

function requestUrl(
  url,
  {
    method = "GET",
    timeoutMs = 1000,
    headers = {},
  } = {},
) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === "https:" ? https : http;
      const chunks = [];

      const req = lib.request(
        {
          method,
          host: parsed.hostname,
          port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
          path: `${parsed.pathname}${parsed.search}`,
          timeout: timeoutMs,
          headers,
        },
        (res) => {
          res.on("data", (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          res.on("end", () => {
            resolve({
              ok: true,
              status: res.statusCode || 0,
              body: Buffer.concat(chunks).toString("utf8"),
            });
          });
        },
      );

      req.on("timeout", () => {
        req.destroy();
        resolve({ ok: false, status: 0, body: "", error: "timeout" });
      });
      req.on("error", (error) => {
        resolve({
          ok: false,
          status: 0,
          body: "",
          error: error instanceof Error ? error.message : String(error),
        });
      });
      req.end();
    } catch (error) {
      resolve({
        ok: false,
        status: 0,
        body: "",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

export async function pingServer(url, timeoutMs = 1000, requestFn = requestUrl) {
  const response = await requestFn(url, { method: "GET", timeoutMs });
  return response.ok;
}

export async function fetchRuntimeProbe(
  baseUrl,
  timeoutMs = 1500,
  requestFn = requestUrl,
) {
  const response = await requestFn(buildProbeUrl(baseUrl), {
    method: "GET",
    timeoutMs,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok || response.status !== 200) {
    return null;
  }

  try {
    return parseRuntimeProbe(JSON.parse(response.body));
  } catch {
    return null;
  }
}

/**
 * @param {ServerStrategyInput} input
 */
export async function selectPlaywrightServerStrategy({
  lockExists,
  explicitBaseUrl = undefined,
  defaultBaseUrl = "http://127.0.0.1:3000",
  e2ePort = "3405",
  pingServerFn = pingServer,
  fetchRuntimeProbeFn = fetchRuntimeProbe,
}) {
  const candidateUrls = explicitBaseUrl
    ? [normalizeBaseUrl(explicitBaseUrl)]
    : lockExists
      ? [defaultBaseUrl, `http://127.0.0.1:${e2ePort}`]
      : [];

  if (candidateUrls.length === 0) {
    return {
      action: "managed",
      clearLock: false,
      reason: null,
    };
  }

  let reachableUrl = null;
  for (const url of candidateUrls) {
    if (await pingServerFn(url)) {
      reachableUrl = url;
      break;
    }
  }

  if (!reachableUrl) {
    return {
      action: "managed",
      clearLock: lockExists && !explicitBaseUrl,
      reason: explicitBaseUrl
        ? `E2E_BASE_URL ${explicitBaseUrl} was not reachable. Starting a managed Playwright server instead.`
        : "No reusable local server was reachable. Starting a managed Playwright server instead.",
    };
  }

  const probe = await fetchRuntimeProbeFn(reachableUrl);

  if (probe?.safeForSmokeReuse) {
    return {
      action: "reuse",
      clearLock: false,
      reuseUrl: reachableUrl,
      reason: `Reusing smoke-E2E-safe server at ${reachableUrl} (${describeProbe(probe)}).`,
    };
  }

  const probeDetails = probe
    ? describeProbe(probe)
    : "probe unavailable or invalid response";

  if (explicitBaseUrl) {
    return {
      action: "error",
      clearLock: false,
      reason: `Smoke E2E cannot reuse E2E_BASE_URL ${reachableUrl} because /api/e2e/runtime did not confirm fake-payment safety (${probeDetails}). Remove E2E_BASE_URL or enable E2E_FAKE_PAYMENTS=1 on that server.`,
    };
  }

  return {
    action: "managed",
    clearLock: false,
    reason: `Reachable server at ${reachableUrl} did not pass the smoke E2E runtime probe (${probeDetails}). Starting a managed Playwright server instead.`,
  };
}
