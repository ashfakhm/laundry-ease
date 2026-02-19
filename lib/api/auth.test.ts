import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@/types/enums";
import { AppError } from "./errors";

const { mockGetServerSession, mockGetUserByEmail } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockGetUserByEmail: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({
  authOptions: {},
}));

vi.mock("@/lib/db/index", () => ({
  getUserByEmail: mockGetUserByEmail,
}));

import { requireAdminWithDbCheck, requireAuth, requireProvider } from "./auth";

describe("lib/api/auth", () => {
  beforeEach(() => {
    mockGetServerSession.mockReset();
    mockGetUserByEmail.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns session identity directly when id and role are valid", async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: "507f1f77bcf86cd799439001",
        email: "provider@laundryease.test",
        name: "Provider",
        role: Role.PROVIDER,
      },
    });

    const result = await requireProvider();

    expect(result.user.id).toBe("507f1f77bcf86cd799439001");
    expect(result.user.role).toBe(Role.PROVIDER);
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
  });

  it("normalizes OAuth-like session ids via DB fallback", async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: "google-oauth-subject-id",
        email: "seeker@laundryease.test",
        name: "Seeker",
        role: Role.SEEKER,
      },
    });
    mockGetUserByEmail.mockResolvedValue({
      _id: { toString: () => "507f1f77bcf86cd799439002" },
      email: "seeker@laundryease.test",
      role: Role.SEEKER,
      name: "Seeker",
    });

    const result = await requireAuth();

    expect(result.user.id).toBe("507f1f77bcf86cd799439002");
    expect(result.user.role).toBe(Role.SEEKER);
    expect(mockGetUserByEmail).toHaveBeenCalledWith("seeker@laundryease.test");
  });

  it("enforces admin DB-check for high-risk routes", async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: "507f1f77bcf86cd799439003",
        email: "admin@laundryease.test",
        name: "Admin",
        role: Role.ADMIN,
      },
    });
    mockGetUserByEmail.mockResolvedValue({
      _id: { toString: () => "507f1f77bcf86cd799439003" },
      email: "admin@laundryease.test",
      role: Role.PROVIDER,
      name: "Wrong Role",
    });

    await expect(requireAdminWithDbCheck()).rejects.toBeInstanceOf(AppError);
  });
});
