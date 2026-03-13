import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockEmailExists,
  mockCreateSeeker,
  mockIsOtpVerifiedRecently,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
} = vi.hoisted(() => ({
  mockEmailExists: vi.fn(),
  mockCreateSeeker: vi.fn(),
  mockIsOtpVerifiedRecently: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/db/index", () => ({
  emailExists: mockEmailExists,
  createSeeker: mockCreateSeeker,
}));

vi.mock("@/lib/otp", () => ({
  isOtpVerifiedRecently: mockIsOtpVerifiedRecently,
}));

vi.mock("@/lib/api/security", () => ({
  requireSameOrigin: mockRequireSameOrigin,
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST } from "./route";

const validPayload = {
  name: "Test Seeker",
  email: "Test@Example.com",
  password: "SecurePass123!",
  phone: "+919876543210",
  acceptTerms: true,
  address: {
    line1: "123 Main St",
    city: "Mumbai",
    state: "MH",
    postalCode: "400001",
    country: "India",
  },
  coordinates: { lat: 19.076, lng: 72.877 },
};

function makeReq(body: unknown) {
  return new Request("https://laundryease.test/api/signup/seeker", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/signup/seeker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOtpVerifiedRecently.mockResolvedValue(true);
    mockEmailExists.mockResolvedValue(false);
    mockCreateSeeker.mockResolvedValue(undefined);
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 10,
      remaining: 9,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
  });

  it("returns 400 for invalid payload", async () => {
    const res = await POST(makeReq({}) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when terms are not accepted", async () => {
    const res = await POST(
      makeReq({ ...validPayload, acceptTerms: false }) as never,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when email OTP is not verified", async () => {
    mockIsOtpVerifiedRecently.mockResolvedValue(false);
    const res = await POST(makeReq(validPayload) as never);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.message).toBe("Email must be verified via OTP");
  });

  it("returns 409 when email already exists", async () => {
    mockEmailExists.mockResolvedValue(true);
    const res = await POST(makeReq(validPayload) as never);
    expect(res.status).toBe(409);
  });

  it("creates seeker on valid input", async () => {
    const res = await POST(makeReq(validPayload) as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockCreateSeeker).toHaveBeenCalledWith(
      expect.objectContaining({ email: "test@example.com" }),
    );
  });

  it("normalizes email to lowercase", async () => {
    await POST(makeReq(validPayload) as never);
    expect(mockEmailExists).toHaveBeenCalledWith("test@example.com");
    expect(mockCreateSeeker).toHaveBeenCalledWith(
      expect.objectContaining({ email: "test@example.com" }),
    );
  });

  it("applies request origin and rate-limit guards", async () => {
    await POST(makeReq(validPayload) as never);
    expect(mockRequireSameOrigin).toHaveBeenCalledTimes(1);
    expect(mockEnforceRateLimit).toHaveBeenCalledTimes(1);
  });
});
