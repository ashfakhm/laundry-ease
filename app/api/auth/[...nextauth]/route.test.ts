import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/constants";
import { Role } from "@/types/enums";

const {
  mockGetUserByEmail,
  mockNextAuth,
} = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockGetHandler = vi.fn();
  const mockGetUserByEmail = vi.fn();
  const mockPostHandler = vi.fn();
  const mockSignIn = vi.fn();
  const mockSignOut = vi.fn();
  const mockNextAuth = vi.fn(() => ({
    auth: mockAuth,
    handlers: {
      GET: mockGetHandler,
      POST: mockPostHandler,
    },
    signIn: mockSignIn,
    signOut: mockSignOut,
  }));

  return {
    mockGetUserByEmail,
    mockNextAuth,
  };
});

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

import { authOptions, handlers } from "@/auth";
import { GET, POST } from "./route";

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

  it("route re-exports Auth.js handlers from the root auth module", () => {
    expect(GET).toBe(handlers.GET);
    expect(POST).toBe(handlers.POST);
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

  it("jwt callback invalidates the session after a password reset", async () => {
    mockGetUserByEmail.mockResolvedValue({
      _id: new ObjectId(),
      role: Role.SEEKER,
      passwordChangedAt: new Date("2024-01-01T00:05:00.000Z"),
    });

    const result = await authOptions.callbacks?.jwt?.({
      token: {
        email: "seeker@laundryease.test",
        iat: Math.floor(new Date("2024-01-01T00:00:00.000Z").getTime() / 1000),
        _lastDbCheck: 0,
      },
    } as never);

    expect(result).toBeNull();
  });
});
