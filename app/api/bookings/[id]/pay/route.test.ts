import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST, PUT } from "./route";
import { ObjectId } from "mongodb";

// Mocks
const mockGetBookingById = vi.fn();
const mockGetDb = vi.fn();
const mockCreateRazorpayOrder = vi.fn();
const mockVerifyRazorpaySignature = vi.fn();
const mockRequireSeeker = vi.fn();
const mockRequireSameOrigin = vi.fn();
const mockEnforceRateLimit = vi.fn();
const mockUpdateOne = vi.fn();
const mockFindOne = vi.fn();

vi.mock("@/lib/db/index", () => ({
  getBookingById: (id: unknown) => mockGetBookingById(id),
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: () => mockGetDb(),
}));

vi.mock("@/lib/razorpay", () => ({
  createRazorpayOrder: (amount: unknown, receipt: unknown) =>
    mockCreateRazorpayOrder(amount, receipt),
  verifyRazorpaySignature: (
    orderId: unknown,
    paymentId: unknown,
    sig: unknown,
  ) => mockVerifyRazorpaySignature(orderId, paymentId, sig),
}));

vi.mock("@/lib/api/auth", () => ({
  requireSeeker: () => mockRequireSeeker(),
}));

vi.mock("@/lib/api/security", () => ({
  requireSameOrigin: (req: unknown) => mockRequireSameOrigin(req),
  enforceRateLimit: (req: unknown, opts: unknown) =>
    mockEnforceRateLimit(req, opts),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("/api/bookings/[id]/pay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    mockGetDb.mockResolvedValue({
      db: {
        collection: () => ({
          updateOne: mockUpdateOne,
          findOne: mockFindOne,
        }),
      },
    });
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue(undefined);
  });

  describe("POST (Create Order)", () => {
    it("should create a razorpay order successfully", async () => {
      const bookingId = new ObjectId();
      const seekerId = new ObjectId();

      const req = new Request("http://localhost");
      const params = Promise.resolve({ id: bookingId.toString() });

      mockRequireSeeker.mockResolvedValue({
        user: { id: seekerId.toString() },
      });
      mockGetBookingById.mockResolvedValue({
        _id: bookingId,
        seeker_id: seekerId, // Match seeker
        status: "requested",
        bookingFee: 50,
        bookingFeeStatus: "pending",
      });
      mockCreateRazorpayOrder.mockResolvedValue({
        id: "rp_order_1",
        amount: 5000,
        currency: "INR",
      });

      const res = await POST(req, { params });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.ok).toBe(true); // Legacy compatibility
      expect(json.data.id).toBe("rp_order_1");

      // Match the $set object loosely since it contains a dynamic Date
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: bookingId },
        {
          $set: expect.objectContaining({
            razorpay_order_id: "rp_order_1",
          }),
        },
      );
    });

    it("should return 400 for invalid booking fee", async () => {
      const bookingId = new ObjectId();
      const seekerId = new ObjectId();
      const params = Promise.resolve({ id: bookingId.toString() });
      const req = new Request("http://localhost");

      mockRequireSeeker.mockResolvedValue({
        user: { id: seekerId.toString() },
      });
      mockGetBookingById.mockResolvedValue({
        _id: bookingId,
        seeker_id: seekerId,
        status: "requested",
        bookingFee: 0, // Invalid
      });

      const res = await POST(req, { params });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      // Check standard top-level message
      expect(json.message).toBe("Invalid booking fee amount");
      // Check nested error object message
      expect(json.error.message).toBe("Invalid booking fee amount");
    });
  });

  describe("PUT (Verify Payment)", () => {
    it("should verify payment successfully", async () => {
      const bookingId = new ObjectId();
      const seekerId = new ObjectId();
      const req = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({
          razorpay_payment_id: "pay_1",
          razorpay_order_id: "order_1",
          razorpay_signature: "sig_1",
        }),
      });
      const params = Promise.resolve({ id: bookingId.toString() });

      mockRequireSeeker.mockResolvedValue({
        user: { id: seekerId.toString() },
      });
      mockVerifyRazorpaySignature.mockReturnValue(true);
      mockFindOne.mockResolvedValue({
        _id: bookingId,
        seeker_id: seekerId,
        status: "requested",
        razorpay_order_id: "order_1",
        bookingFeeStatus: "pending",
      });
      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      const res = await PUT(req, { params });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.message).toBe("Payment successful");
    });

    it("should return idempotency response if already paid", async () => {
      const bookingId = new ObjectId();
      const seekerId = new ObjectId();
      const req = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({
          razorpay_payment_id: "pay_1", // Same ID
          razorpay_order_id: "order_1",
          razorpay_signature: "sig_1",
        }),
      });
      const params = Promise.resolve({ id: bookingId.toString() });

      mockRequireSeeker.mockResolvedValue({
        user: { id: seekerId.toString() },
      });
      mockVerifyRazorpaySignature.mockReturnValue(true);
      mockFindOne.mockResolvedValue({
        _id: bookingId,
        seeker_id: seekerId,
        status: "requested",
        razorpay_order_id: "order_1",
        bookingFeeStatus: "paid", // Already paid
        razorpay_payment_id: "pay_1", // Matching ID
      });

      const res = await PUT(req, { params });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.idempotent).toBe(true);
    });
  });
});
