import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn((handler: unknown) => handler),
}));

type MockAuthSession = {
  user?: {
    role?: "seeker" | "provider" | "admin" | null;
  };
} | null;

function makeRequest(
  pathname: string,
  auth: MockAuthSession,
  headersInit?: HeadersInit,
) {
  return {
    auth,
    headers: new Headers(headersInit),
    nextUrl: {
      pathname,
    },
    url: `https://laundryease.test${pathname}`,
  };
}

async function loadProxyModule() {
  vi.resetModules();
  return import("./proxy");
}

describe("proxy", () => {
  beforeEach(() => {
    delete process.env.ADMIN_ALLOWLIST_IPS;
    delete process.env.TRUST_PROXY;
  });

  afterEach(() => {
    delete process.env.ADMIN_ALLOWLIST_IPS;
    delete process.env.TRUST_PROXY;
  });

  it("redirects unauthenticated dashboard requests to /auth with callbackUrl", async () => {
    const { proxy } = await loadProxyModule();

    const response = (await proxy(
      makeRequest("/provider/messages", null) as never,
      {} as never,
    )) as Response;

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://laundryease.test/auth?callbackUrl=%2Fprovider%2Fmessages",
    );
  });

  it("redirects authenticated users away from auth pages to their dashboard", async () => {
    const { proxy } = await loadProxyModule();

    const response = (await proxy(
      makeRequest("/auth", {
        user: { role: "provider" },
      }) as never,
      {} as never,
    )) as Response;

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://laundryease.test/provider",
    );
  });

  it("redirects users hitting the wrong dashboard to their own dashboard", async () => {
    const { proxy } = await loadProxyModule();

    const response = (await proxy(
      makeRequest("/admin", {
        user: { role: "seeker" },
      }) as never,
      {} as never,
    )) as Response;

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://laundryease.test/seeker",
    );
  });

  it("returns 403 for admin API requests outside the allowlist", async () => {
    process.env.ADMIN_ALLOWLIST_IPS = "203.0.113.10";
    process.env.TRUST_PROXY = "true";

    const { proxy } = await loadProxyModule();

    const response = (await proxy(
      makeRequest("/api/admin/users", {
        user: { role: "admin" },
      }, {
        "x-forwarded-for": "198.51.100.12",
      }) as never,
      {} as never,
    )) as Response;

    expect(response.status).toBe(403);
  });
});
