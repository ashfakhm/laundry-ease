import { describe, expect, it, vi } from "vitest";

const { mockPOST, mockPUT } = vi.hoisted(() => ({
  mockPOST: vi.fn().mockResolvedValue(new Response("ok-post")),
  mockPUT: vi.fn().mockResolvedValue(new Response("ok-put")),
}));

vi.mock("../payment/route", () => ({
  POST: mockPOST,
  PUT: mockPUT,
}));

import { POST, PUT } from "./route";

describe("/api/orders/[id]/pay (legacy alias)", () => {
  it("POST delegates to payment POST", async () => {
    const req = new Request("https://laundryease.test/api/orders/123/pay", {
      method: "POST",
    });
    const ctx = { params: Promise.resolve({ id: "123" }) };
    const res = await POST(req, ctx);
    expect(mockPOST).toHaveBeenCalledWith(req, ctx);
    expect(await res.text()).toBe("ok-post");
  });

  it("PUT delegates to payment PUT", async () => {
    const req = new Request("https://laundryease.test/api/orders/123/pay", {
      method: "PUT",
    });
    const ctx = { params: Promise.resolve({ id: "123" }) };
    const res = await PUT(req, ctx);
    expect(mockPUT).toHaveBeenCalledWith(req, ctx);
    expect(await res.text()).toBe("ok-put");
  });
});
