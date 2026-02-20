import { describe, expect, it, vi } from "vitest";

const { mockRequireProvider } = vi.hoisted(() => ({
  mockRequireProvider: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({ requireProvider: mockRequireProvider }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST } from "./route";

describe("POST /api/orders (disabled)", () => {
  it("returns 400 indicating direct order creation is disabled", async () => {
    mockRequireProvider.mockResolvedValue({
      user: { id: "prov1", role: "provider" },
    });
    const req = new Request("https://laundryease.test/api/orders", {
      method: "POST",
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.message).toContain("disabled");
  });
});
