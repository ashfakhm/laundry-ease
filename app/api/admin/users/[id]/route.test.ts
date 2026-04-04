import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { NextRequest } from "next/server";
import { Role } from "@/types/enums";
import { AppError, ErrorCode } from "@/lib/api/errors";

const {
  mockRequireAdminWithDbCheck,
  mockRequireSameOrigin,
  mockSoftDeleteAccount,
} = vi.hoisted(() => ({
  mockRequireAdminWithDbCheck: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockSoftDeleteAccount: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireAdminWithDbCheck: mockRequireAdminWithDbCheck,
}));

vi.mock("@/lib/api/security", () => ({
  requireSameOrigin: mockRequireSameOrigin,
}));

vi.mock("@/lib/services/account-deletion", () => ({
  softDeleteAccount: mockSoftDeleteAccount,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { DELETE } from "./route";

function makeRequest(body: unknown) {
  return new NextRequest("https://laundryease.test/api/admin/users/123", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("DELETE /api/admin/users/[id]", () => {
  beforeEach(() => {
    mockRequireAdminWithDbCheck.mockResolvedValue({
      user: {
        id: new ObjectId().toString(),
        role: Role.ADMIN,
        email: "admin@laundryease.test",
      },
    });
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockSoftDeleteAccount.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid id", async () => {
    const res = await DELETE(makeRequest({ role: Role.SEEKER }), {
      params: Promise.resolve({ id: "bad-id" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid role", async () => {
    const res = await DELETE(makeRequest({ role: "admin" }), {
      params: Promise.resolve({ id: new ObjectId().toString() }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when user does not exist", async () => {
    mockSoftDeleteAccount.mockResolvedValue(false);

    const res = await DELETE(makeRequest({ role: Role.PROVIDER }), {
      params: Promise.resolve({ id: new ObjectId().toString() }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error.message).toBe("User not found or not deleted");
  });

  it("returns 200 when delete succeeds", async () => {
    const userId = new ObjectId().toString();
    mockSoftDeleteAccount.mockResolvedValue(true);

    const res = await DELETE(makeRequest({ role: Role.SEEKER }), {
      params: Promise.resolve({ id: userId }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockSoftDeleteAccount).toHaveBeenCalledWith(
      userId,
      Role.SEEKER,
      "admin",
    );
  });

  it("returns AppError status when auth helper throws", async () => {
    mockRequireAdminWithDbCheck.mockRejectedValueOnce(
      new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
    );

    const res = await DELETE(makeRequest({ role: Role.SEEKER }), {
      params: Promise.resolve({ id: new ObjectId().toString() }),
    });
    expect(res.status).toBe(401);
  });
});
