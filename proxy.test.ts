import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

// Mock next-auth/jwt
vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
}));

import { getToken } from "next-auth/jwt";

describe("Middleware Security Hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const createRequest = (path: string, ip: string = "127.0.0.1") => {
    const req = new NextRequest(new URL(`http://localhost:3000${path}`));
    // Mock IP via headers
    req.headers.set("x-forwarded-for", ip);
    return req;
  };

  describe("Admin IP Whitelisting", () => {
    const mockGetToken = vi.mocked(getToken);

    it("allows admin access when no allowlist is allowed (default safe but warns)", async () => {
      // Setup: Admin user
      mockGetToken.mockResolvedValue({ role: "admin" } as any);

      // Setup: No allowlist set
      // delete process.env.ADMIN_ALLOWLIST_IPS; // Use stubEnv instead
      // Note: stubEnv sets it, to remove it we can set to undefined or empty string if code handles it.
      // But vi.stubEnv doesn't support 'delete'.
      // However, unstubAllEnvs resets to original.
      // If we want to simulate it missing, we need to ensure it's not in original env or overwrite it.
      // Since it's optional in schema, undefined works.
      vi.stubEnv("ADMIN_ALLOWLIST_IPS", ""); // Effectively empty/missing

      const req = createRequest("/admin");
      const res = await proxy(req);

      // Should bypass IP check and proceed to role check (which passes)
      expect(res.status).not.toBe(307); // Not redirecting to unauthorized
      expect(res.status).toBe(200); // next() returns 200 equivalent in tests usually
    });

    it("blocks admin access from non-whitelisted IP", async () => {
      // Setup: Admin user
      mockGetToken.mockResolvedValue({ role: "admin" } as any);

      // Setup: Strict allowlist
      vi.stubEnv("ADMIN_ALLOWLIST_IPS", "10.0.0.1, 10.0.0.2");

      // Request from unknown IP
      const req = createRequest("/admin", "192.168.1.1");
      const res = await proxy(req);

      // Should redirect to unauthorized
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/unauthorized");
    });

    it("allows admin access from whitelisted IP", async () => {
      // Setup: Admin user
      mockGetToken.mockResolvedValue({ role: "admin" } as any);

      // Setup: Strict allowlist
      vi.stubEnv("ADMIN_ALLOWLIST_IPS", "10.0.0.1, 192.168.1.1");

      // Request from allowed IP
      const req = createRequest("/admin", "192.168.1.1");
      const res = await proxy(req);

      // Should pass
      expect(res.status).toBe(200);
    });

    it("allows localhost in development even if not explicitly in allowlist (dev convenience)", async () => {
      // Setup: Admin user
      mockGetToken.mockResolvedValue({ role: "admin" } as any);
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ADMIN_ALLOWLIST_IPS", "10.0.0.5");

      // Request from localhost
      const req = createRequest("/admin", "127.0.0.1");
      const res = await proxy(req);

      // Should pass in dev
      expect(res.status).toBe(200);
    });

    it("allows execution continues to other checks if IP passes", async () => {
      // Setup: Admin user
      mockGetToken.mockResolvedValue({ role: "admin" } as any);
      vi.stubEnv("ADMIN_ALLOWLIST_IPS", "127.0.0.1");

      const req = createRequest("/admin", "127.0.0.1");
      const res = await proxy(req);

      expect(res.status).toBe(200);
    });
  });
});
