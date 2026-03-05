import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockEmailExists,
  mockCreateProvider,
  mockIsOtpVerifiedRecently,
  mockGetDb,
  mockCreateRazorpayContact,
  mockCreateRazorpayFundAccount,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
} = vi.hoisted(() => ({
  mockEmailExists: vi.fn(),
  mockCreateProvider: vi.fn(),
  mockIsOtpVerifiedRecently: vi.fn(),
  mockGetDb: vi.fn(),
  mockCreateRazorpayContact: vi.fn(),
  mockCreateRazorpayFundAccount: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/db/index", () => ({
  emailExists: mockEmailExists,
  createProvider: mockCreateProvider,
}));

vi.mock("@/lib/otp", () => ({
  isOtpVerifiedRecently: mockIsOtpVerifiedRecently,
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/razorpay", () => ({
  createRazorpayContact: mockCreateRazorpayContact,
  createRazorpayFundAccount: mockCreateRazorpayFundAccount,
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
  name: "Test Provider",
  email: "Provider@Example.com",
  password: "SecurePass123!",
  phone: "+919876543210",
  businessName: "Clean Laundry",
  bio: "Professional laundry service",
  description: "We clean it right",
  services: ["wash", "iron"],
  location: "Mumbai Central",
  radius_km: 10,
  per_km_rate: 5,
  pricing: 200,
  pricingRates: {},
  bankAccountHolder: "Test Provider",
  bankAccountNumber: "1234567890",
  bankIFSC: "SBIN0001234",
  upiId: "test@upi",
  profilePicture: "",
  bannerImage: "",
  coordinates: { lat: 19.076, lng: 72.877 },
};

function makeReq(body: unknown) {
  return new Request("https://laundryease.test/api/signup/provider", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/signup/provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOtpVerifiedRecently.mockResolvedValue(true);
    mockEmailExists.mockResolvedValue(false);
    mockCreateProvider.mockResolvedValue(undefined);
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 8,
      remaining: 7,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    const mockCollection = {
      findOne: vi.fn().mockResolvedValue({ _id: "provider123" }),
      updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    mockGetDb.mockResolvedValue({ db: { collection: () => mockCollection } });
    mockCreateRazorpayContact.mockResolvedValue({ id: "cont_123" });
    mockCreateRazorpayFundAccount.mockResolvedValue({ id: "fa_123" });
  });

  it("returns 400 for invalid payload", async () => {
    const res = await POST(makeReq({}) as never);
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

  it("creates provider and syncs Razorpay on valid input", async () => {
    const res = await POST(makeReq(validPayload) as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockCreateProvider).toHaveBeenCalled();
    expect(mockCreateRazorpayContact).toHaveBeenCalled();
    expect(mockCreateRazorpayFundAccount).toHaveBeenCalled();
  });

  it("succeeds even if Razorpay sync fails", async () => {
    mockCreateRazorpayContact.mockRejectedValue(new Error("Razorpay down"));
    const res = await POST(makeReq(validPayload) as never);
    expect(res.status).toBe(200);
  });

  it("applies request origin and rate-limit guards", async () => {
    await POST(makeReq(validPayload) as never);
    expect(mockRequireSameOrigin).toHaveBeenCalledTimes(1);
    expect(mockEnforceRateLimit).toHaveBeenCalledTimes(1);
  });
});
