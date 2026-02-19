import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const {
  mockGetDb,
  mockRequireProvider,
  mockCreateRazorpayContact,
  mockCreateRazorpayFundAccount,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockRequireProvider: vi.fn(),
  mockCreateRazorpayContact: vi.fn(),
  mockCreateRazorpayFundAccount: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/api/auth", () => ({
  requireProvider: mockRequireProvider,
}));

vi.mock("@/lib/razorpay", () => ({
  createRazorpayContact: mockCreateRazorpayContact,
  createRazorpayFundAccount: mockCreateRazorpayFundAccount,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { POST } from "./route";

function buildDbMock(provider: Record<string, unknown> | null) {
  const findOne = vi.fn().mockResolvedValue(provider);
  const updateOne = vi.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

  return {
    db: {
      collection: vi.fn(() => ({
        findOne,
        updateOne,
      })),
    },
    findOne,
    updateOne,
  };
}

describe("POST /api/providers/bank-details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireProvider.mockResolvedValue({
      user: { id: new ObjectId().toString(), role: "provider" },
    });
    mockCreateRazorpayContact.mockResolvedValue({ id: "cont_123" });
    mockCreateRazorpayFundAccount.mockResolvedValue({ id: "fa_123" });
  });

  it("returns 401 when authenticated id is invalid", async () => {
    mockRequireProvider.mockResolvedValue({
      user: { id: "invalid-id", role: "provider" },
    });

    const req = new Request("https://laundryease.test/api/providers/bank-details", {
      method: "POST",
      body: JSON.stringify({
        bankDetails: {
          accountHolderName: "Alex Doe",
          accountNumber: "1234567890",
          ifsc: "HDFC0001234",
        },
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req as never);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid payload", async () => {
    const req = new Request("https://laundryease.test/api/providers/bank-details", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Missing or invalid bank details");
  });

  it("returns 404 when provider record is missing", async () => {
    const dbMock = buildDbMock(null);
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const req = new Request("https://laundryease.test/api/providers/bank-details", {
      method: "POST",
      body: JSON.stringify({
        bankDetails: {
          accountHolderName: "Alex Doe",
          accountNumber: "1234567890",
          ifsc: "HDFC0001234",
        },
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req as never);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Provider not found");
    expect(dbMock.findOne).toHaveBeenCalledOnce();
  });

  it("stores bank details and razorpay links on success", async () => {
    const providerId = new ObjectId();
    mockRequireProvider.mockResolvedValue({
      user: { id: providerId.toString(), role: "provider" },
    });

    const dbMock = buildDbMock({
      _id: providerId,
      name: "Ash",
      businessName: "Ash Laundry Services",
      email: "ash@example.com",
      phone: "9999999999",
    });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const req = new Request("https://laundryease.test/api/providers/bank-details", {
      method: "POST",
      body: JSON.stringify({
        bankDetails: {
          accountHolderName: "Alex Doe",
          accountNumber: "1234567890",
          ifsc: "HDFC0001234",
        },
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockCreateRazorpayContact).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ash@example.com",
      }),
    );
    expect(mockCreateRazorpayFundAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        contact_id: "cont_123",
      }),
    );
    expect(dbMock.updateOne).toHaveBeenCalledWith(
      { _id: providerId },
      expect.objectContaining({
        $set: expect.objectContaining({
          razorpay_contact_id: "cont_123",
          razorpay_fund_account_id: "fa_123",
        }),
      }),
    );
  });
});
