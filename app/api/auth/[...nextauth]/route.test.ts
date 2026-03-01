import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/constants";
import { Role } from "@/types/enums";

const { mockNextAuth, mockGetUserByEmail } = vi.hoisted(() => ({
  mockNextAuth: vi.fn(() => vi.fn()),
  mockGetUserByEmail: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: mockNextAuth,
}));

vi.mock("@/lib/db/index", () => ({
  getUserByEmail: mockGetUserByEmail,
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
  },
  compare: vi.fn(),
}));

import { authOptions } from "./route";

describe("/api/auth/[...nextauth]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses /auth custom pages and expected session max age", () => {
    expect(authOptions.pages?.signIn).toBe("/auth");
    expect(authOptions.pages?.error).toBe("/auth");
    expect(authOptions.session?.maxAge).toBe(SESSION_MAX_AGE_SECONDS);
    expect(authOptions.session?.strategy).toBe("jwt");
  });

  it("google signIn callback redirects to choose-role when no DB user exists", async () => {
    mockGetUserByEmail.mockResolvedValue(null);

    const signInCallback = authOptions.callbacks?.signIn;
    expect(signInCallback).toBeTypeOf("function");

    const result = await signInCallback?.({
      user: { email: "new@laundryease.test" } as never,
      account: { provider: "google" } as never,
    } as never);

    expect(result).toBe("/choose-role");
  });

  it("google signIn callback canonicalizes user id/role from DB", async () => {
    const providerId = new ObjectId();
    mockGetUserByEmail.mockResolvedValue({
      _id: providerId,
      role: Role.PROVIDER,
    });

    const user = { email: "provider@laundryease.test" } as {
      email?: string | null;
      id?: string;
      role?: Role;
    };

    const result = await authOptions.callbacks?.signIn?.({
      user: user as never,
      account: { provider: "google" } as never,
    } as never);

    expect(result).toBe(true);
    expect(user.id).toBe(providerId.toString());
    expect(user.role).toBe(Role.PROVIDER);
  });
});
