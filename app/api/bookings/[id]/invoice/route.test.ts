import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";
import { AppError, ErrorCode } from "@/lib/api/errors";

const {
  mockRequireProvider,
  mockGetDb,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
} = vi.hoisted(() => ({
  mockRequireProvider: vi.fn(),
  mockGetDb: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireProvider: mockRequireProvider,
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/api/security", () => ({
  requireSameOrigin: mockRequireSameOrigin,
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { POST } from "./route";

const BOOKING_ID = "507f1f77bcf86cd799439011";
const PROVIDER_ID = "507f1f77bcf86cd799439012";

function makeDbMock() {
  const bookingFindOne = vi.fn();
  const bookingUpdateOne = vi.fn();
  const providerFindOne = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "bookings") {
        return {
          findOne: bookingFindOne,
          updateOne: bookingUpdateOne,
        };
      }
      if (name === "providers") {
        return {
          findOne: providerFindOne,
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return {
    db,
    bookingFindOne,
    bookingUpdateOne,
    providerFindOne,
  };
}

function makeRequest(body: unknown) {
  return new Request("https://laundryease.test/api/bookings/id/invoice", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

const validInvoicePayload = {
  items: [
    {
      itemType: "Shirt",
      quantity: 5,
      unitPrice: 50,
    },
  ],
  notes: "Test invoice",
  discount: 0,
};

describe("POST /api/bookings/[id]/invoice", () => {
  let dbMock: ReturnType<typeof makeDbMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 20,
      remaining: 19,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication and authorization", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockRequireProvider.mockRejectedValue(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );

      const res = await POST(makeRequest(validInvoicePayload), {
        params: Promise.resolve({ id: BOOKING_ID }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 401 when user ID is invalid", async () => {
      mockRequireProvider.mockResolvedValue({
        user: {
          id: "invalid-id",
          role: Role.PROVIDER,
        },
      });

      const res = await POST(makeRequest(validInvoicePayload), {
        params: Promise.resolve({ id: BOOKING_ID }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.message).toBe("Unauthorized");
    });

    it("returns 403 when provider is not assigned to booking", async () => {
      const providerId = new ObjectId(PROVIDER_ID);
      const bookingId = new ObjectId(BOOKING_ID);
      const differentProviderId = new ObjectId();

      mockRequireProvider.mockResolvedValue({
        user: {
          id: providerId.toString(),
          role: Role.PROVIDER,
        },
      });

      dbMock.bookingFindOne.mockResolvedValue({
        _id: bookingId,
        provider_id: differentProviderId,
        status: "confirmed",
      });

      dbMock.providerFindOne.mockResolvedValue({
        _id: providerId,
      });

      const res = await POST(makeRequest(validInvoicePayload), {
        params: Promise.resolve({ id: BOOKING_ID }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.message).toBe("Unauthorized");
    });
  });

  describe("validation", () => {
    it("returns 400 for invalid booking ID", async () => {
      mockRequireProvider.mockResolvedValue({
        user: {
          id: PROVIDER_ID,
          role: Role.PROVIDER,
        },
      });

      const res = await POST(makeRequest(validInvoicePayload), {
        params: Promise.resolve({ id: "invalid-id" }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toBe("Invalid booking id");
    });

    it("returns 400 for invalid invoice data", async () => {
      mockRequireProvider.mockResolvedValue({
        user: {
          id: PROVIDER_ID,
          role: Role.PROVIDER,
        },
      });

      const res = await POST(
        makeRequest({
          items: [], // Empty items array should fail
        }),
        {
          params: Promise.resolve({ id: BOOKING_ID }),
        },
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toBe("Invalid invoice data");
    });

    it("returns 400 when booking status is not confirmed", async () => {
      const providerId = new ObjectId(PROVIDER_ID);
      const bookingId = new ObjectId(BOOKING_ID);

      mockRequireProvider.mockResolvedValue({
        user: {
          id: providerId.toString(),
          role: Role.PROVIDER,
        },
      });

      dbMock.bookingFindOne.mockResolvedValue({
        _id: bookingId,
        provider_id: providerId,
        status: "requested", // Not confirmed
      });

      dbMock.providerFindOne.mockResolvedValue({
        _id: providerId,
      });

      const res = await POST(makeRequest(validInvoicePayload), {
        params: Promise.resolve({ id: BOOKING_ID }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toBe("Invoice can only be created for confirmed bookings");
    });
  });

  describe("booking lookup", () => {
    it("returns 404 when booking not found", async () => {
      const providerId = new ObjectId(PROVIDER_ID);

      mockRequireProvider.mockResolvedValue({
        user: {
          id: providerId.toString(),
          role: Role.PROVIDER,
        },
      });

      dbMock.bookingFindOne.mockResolvedValue(null);
      dbMock.providerFindOne.mockResolvedValue({
        _id: providerId,
      });

      const res = await POST(makeRequest(validInvoicePayload), {
        params: Promise.resolve({ id: BOOKING_ID }),
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.message).toBe("Booking not found");
    });
  });

  describe("successful invoice creation", () => {
    it("creates invoice with calculated totals", async () => {
      const providerId = new ObjectId(PROVIDER_ID);
      const bookingId = new ObjectId(BOOKING_ID);

      mockRequireProvider.mockResolvedValue({
        user: {
          id: providerId.toString(),
          role: Role.PROVIDER,
        },
      });

      dbMock.bookingFindOne.mockResolvedValue({
        _id: bookingId,
        provider_id: providerId,
        status: "confirmed",
      });

      dbMock.providerFindOne.mockResolvedValue({
        _id: providerId,
      });

      dbMock.bookingUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      const invoicePayload = {
        items: [
          { itemType: "Shirt", quantity: 5, unitPrice: 50 },
          { itemType: "Pants", quantity: 3, unitPrice: 75 },
        ],
        notes: "Test invoice",
        photos: ["https://example.com/photo1.jpg"],
        discount: 25,
      };

      const res = await POST(makeRequest(invoicePayload), {
        params: Promise.resolve({ id: BOOKING_ID }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify the update was called with correct invoice data
      expect(dbMock.bookingUpdateOne).toHaveBeenCalledWith(
        { _id: bookingId },
        {
          $set: {
            status: "invoice_created",
            invoice: expect.objectContaining({
              items: expect.arrayContaining([
                expect.objectContaining({ itemType: "Shirt", quantity: 5, unitPrice: 50 }),
                expect.objectContaining({ itemType: "Pants", quantity: 3, unitPrice: 75 }),
              ]),
              notes: "Test invoice",
              photos: ["https://example.com/photo1.jpg"],
              discount: 25,
              subtotal: 475, // (5*50) + (3*75) = 250 + 225 = 475
              total: 450, // 475 - 25 discount
              createdAt: expect.any(Date),
            }),
            updatedAt: expect.any(Date),
          },
        },
      );
    });

    it("creates invoice with provided total and subtotal", async () => {
      const providerId = new ObjectId(PROVIDER_ID);
      const bookingId = new ObjectId(BOOKING_ID);

      mockRequireProvider.mockResolvedValue({
        user: {
          id: providerId.toString(),
          role: Role.PROVIDER,
        },
      });

      dbMock.bookingFindOne.mockResolvedValue({
        _id: bookingId,
        provider_id: providerId,
        status: "confirmed",
      });

      dbMock.providerFindOne.mockResolvedValue({
        _id: providerId,
      });

      dbMock.bookingUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      const invoicePayload = {
        items: [{ itemType: "Shirt", quantity: 5, unitPrice: 50 }],
        subtotal: 300, // Custom subtotal
        total: 280, // Custom total
      };

      const res = await POST(makeRequest(invoicePayload), {
        params: Promise.resolve({ id: BOOKING_ID }),
      });

      expect(res.status).toBe(200);

      // Verify the update was called with provided totals
      expect(dbMock.bookingUpdateOne).toHaveBeenCalledWith(
        { _id: bookingId },
        {
          $set: {
            status: "invoice_created",
            invoice: expect.objectContaining({
              subtotal: 300,
              total: 280,
            }),
            updatedAt: expect.any(Date),
          },
        },
      );
    });

    it("handles missing optional fields with defaults", async () => {
      const providerId = new ObjectId(PROVIDER_ID);
      const bookingId = new ObjectId(BOOKING_ID);

      mockRequireProvider.mockResolvedValue({
        user: {
          id: providerId.toString(),
          role: Role.PROVIDER,
        },
      });

      dbMock.bookingFindOne.mockResolvedValue({
        _id: bookingId,
        provider_id: providerId,
        status: "confirmed",
      });

      dbMock.providerFindOne.mockResolvedValue({
        _id: providerId,
      });

      dbMock.bookingUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      const minimalPayload = {
        items: [{ itemType: "Shirt", quantity: 2, unitPrice: 100 }],
      };

      const res = await POST(makeRequest(minimalPayload), {
        params: Promise.resolve({ id: BOOKING_ID }),
      });

      expect(res.status).toBe(200);

      expect(dbMock.bookingUpdateOne).toHaveBeenCalledWith(
        { _id: bookingId },
        {
          $set: {
            status: "invoice_created",
            invoice: expect.objectContaining({
              notes: "",
              photos: [],
              discount: 0,
              subtotal: 200,
              total: 200,
            }),
            updatedAt: expect.any(Date),
          },
        },
      );
    });
  });

  describe("error handling", () => {
    it("returns 500 on unexpected error", async () => {
      mockRequireProvider.mockRejectedValue(new Error("Unexpected error"));

      const res = await POST(makeRequest(validInvoicePayload), {
        params: Promise.resolve({ id: BOOKING_ID }),
      });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.message).toBe("Internal server error");
    });
  });
});
