import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetDb, mockJwtVerify } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockJwtVerify: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("jsonwebtoken", () => ({
  default: { verify: mockJwtVerify },
}));

vi.mock("@/lib/env", () => ({
  env: { NEXTAUTH_SECRET: "test-jwt-secret" },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST } from "./route";

function makeReq(body: unknown) {
  return new Request("https://laundryease.test/api/auth/verify-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/verify-email", () => {
  const mockUpdateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwtVerify.mockReturnValue({
      email: "user@example.com",
      type: "email_verification",
    });
    const mockFindOne = vi
      .fn()
      .mockResolvedValue({ _id: "user1", email: "user@example.com" });
    mockGetDb.mockResolvedValue({
      db: {
        collection: () => ({
          findOne: mockFindOne,
          updateOne: mockUpdateOne,
        }),
      },
    });
  });

  it("returns 400 when token is missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when token is invalid", async () => {
    mockJwtVerify.mockImplementation(() => {
      throw new Error("invalid");
    });
    const res = await POST(makeReq({ token: "bad-token" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when token type is wrong", async () => {
    mockJwtVerify.mockReturnValue({
      email: "user@example.com",
      type: "password_reset",
    });
    const res = await POST(makeReq({ token: "valid-token" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when user not found", async () => {
    mockGetDb.mockResolvedValue({
      db: {
        collection: () => ({
          findOne: vi.fn().mockResolvedValue(null),
          updateOne: mockUpdateOne,
        }),
      },
    });
    const res = await POST(makeReq({ token: "valid-token" }));
    expect(res.status).toBe(404);
  });

  it("verifies email successfully", async () => {
    const res = await POST(makeReq({ token: "valid-token" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
