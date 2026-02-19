import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";
import { AppError, ErrorCode } from "@/lib/api/errors";

const {
  mockRequireSeeker,
  mockRequireAuth,
  mockGetDb,
  mockCreateComplaint,
  mockGetOrderById,
  mockFreezeEscrow,
} = vi.hoisted(() => ({
  mockRequireSeeker: vi.fn(),
  mockRequireAuth: vi.fn(),
  mockGetDb: vi.fn(),
  mockCreateComplaint: vi.fn(),
  mockGetOrderById: vi.fn(),
  mockFreezeEscrow: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireSeeker: mockRequireSeeker,
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/db/index", () => ({
  createComplaint: mockCreateComplaint,
  getOrderById: mockGetOrderById,
  freezeEscrow: mockFreezeEscrow,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { POST, GET } from "./route";

const SEEKER_ID = "507f1f77bcf86cd799439011";
const PROVIDER_ID = "507f1f77bcf86cd799439012";
const ORDER_ID = "507f1f77bcf86cd799439013";
const BOOKING_ID = "507f1f77bcf86cd799439014";
const COMPLAINT_ID = "507f1f77bcf86cd799439015";

function makeDbMock() {
  const orderFindOne = vi.fn();
  const complaintFindOne = vi.fn();
  const complaintInsertOne = vi.fn();
  const complaintMessageInsertOne = vi.fn();
  const complaintFind = vi.fn().mockReturnValue({
    toArray: vi.fn().mockResolvedValue([]),
  });

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "orders") {
        return { findOne: orderFindOne };
      }
      if (name === "complaints") {
        return {
          findOne: complaintFindOne,
          insertOne: complaintInsertOne,
          find: complaintFind,
        };
      }
      if (name === "complaint_messages") {
        return { insertOne: complaintMessageInsertOne };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return {
    db,
    orderFindOne,
    complaintFindOne,
    complaintInsertOne,
    complaintMessageInsertOne,
    complaintFind,
  };
}

function makeRequest(body: unknown) {
  return new Request("https://laundryease.test/api/complaints", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/complaints", () => {
  let dbMock: ReturnType<typeof makeDbMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    mockRequireSeeker.mockResolvedValue({
      user: {
        id: SEEKER_ID,
        role: Role.SEEKER,
      },
    });
    mockCreateComplaint.mockResolvedValue({
      _id: new ObjectId(COMPLAINT_ID),
      order_id: new ObjectId(ORDER_ID),
      seeker_id: new ObjectId(SEEKER_ID),
      provider_id: new ObjectId(PROVIDER_ID),
    });
    mockFreezeEscrow.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockRequireSeeker.mockRejectedValue(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );

      const res = await POST(
        makeRequest({
          order_id: ORDER_ID,
          complaint_type: "late_delivery",
          title: "Late delivery",
          description: "The delivery was very late",
        }),
      );

      expect(res.status).toBe(401);
    });

    it("returns 401 when user ID is invalid", async () => {
      mockRequireSeeker.mockResolvedValue({
        user: {
          id: "invalid-id",
          role: Role.SEEKER,
        },
      });

      const res = await POST(
        makeRequest({
          order_id: ORDER_ID,
          complaint_type: "late_delivery",
          title: "Late delivery",
          description: "The delivery was very late",
        }),
      );

      expect(res.status).toBe(401);
    });
  });

  describe("validation", () => {
    it("returns 400 for invalid payload - missing both order_id and booking_id", async () => {
      const res = await POST(
        makeRequest({
          complaint_type: "late_delivery",
          title: "Late delivery",
          description: "The delivery was very late",
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error.message).toBe("Invalid complaint data");
    });

    it("returns 400 for invalid payload - title too short", async () => {
      const res = await POST(
        makeRequest({
          order_id: ORDER_ID,
          complaint_type: "late_delivery",
          title: "Hi", // Less than 5 characters
          description: "The delivery was very late",
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error.message).toBe("Invalid complaint data");
    });

    it("returns 400 for invalid payload - description too short", async () => {
      const res = await POST(
        makeRequest({
          order_id: ORDER_ID,
          complaint_type: "late_delivery",
          title: "Late delivery",
          description: "Short", // Less than 10 characters
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error.message).toBe("Invalid complaint data");
    });

    it("returns 400 for invalid order_id format", async () => {
      const res = await POST(
        makeRequest({
          order_id: "not-a-valid-id",
          complaint_type: "late_delivery",
          title: "Late delivery",
          description: "The delivery was very late",
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(400);
      // Schema validation catches this first
      expect(data.error.message).toBe("Invalid complaint data");
    });

    it("returns 400 for invalid booking_id format", async () => {
      const res = await POST(
        makeRequest({
          booking_id: "not-a-valid-id",
          complaint_type: "late_delivery",
          title: "Late delivery",
          description: "The delivery was very late",
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(400);
      // Schema validation catches this first
      expect(data.error.message).toBe("Invalid complaint data");
    });

    it("returns 400 for invalid complaint_type", async () => {
      const res = await POST(
        makeRequest({
          order_id: ORDER_ID,
          complaint_type: "invalid_type",
          title: "Late delivery",
          description: "The delivery was very late",
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error.message).toBe("Invalid complaint data");
    });
  });

  describe("order lookup", () => {
    it("returns 404 when order not found", async () => {
      mockGetOrderById.mockResolvedValue(null);

      const res = await POST(
        makeRequest({
          order_id: ORDER_ID,
          complaint_type: "late_delivery",
          title: "Late delivery",
          description: "The delivery was very late",
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(404);
      // The Errors.notFound helper appends "not found" to the resource name
      expect(data.error.message).toBe("Order not found not found");
    });

    it("returns 404 when no order found for booking_id", async () => {
      dbMock.orderFindOne.mockResolvedValue(null);

      const res = await POST(
        makeRequest({
          booking_id: BOOKING_ID,
          complaint_type: "late_delivery",
          title: "Late delivery",
          description: "The delivery was very late",
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error.message).toBe("No active order found for this booking. not found");
    });
  });

  describe("authorization", () => {
    it("returns 403 when user is not the order owner", async () => {
      const differentSeekerId = new ObjectId();
      mockGetOrderById.mockResolvedValue({
        _id: new ObjectId(ORDER_ID),
        booking_id: new ObjectId(BOOKING_ID),
        seeker_id: differentSeekerId,
        provider_id: new ObjectId(PROVIDER_ID),
        process_status: "delivered",
        otp_confirmed_at: new Date(),
      });

      const res = await POST(
        makeRequest({
          order_id: ORDER_ID,
          complaint_type: "late_delivery",
          title: "Late delivery",
          description: "The delivery was very late",
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error.message).toContain("not authorized");
    });
  });

  describe("state validation", () => {
    beforeEach(() => {
      mockGetOrderById.mockResolvedValue({
        _id: new ObjectId(ORDER_ID),
        booking_id: new ObjectId(BOOKING_ID),
        seeker_id: new ObjectId(SEEKER_ID),
        provider_id: new ObjectId(PROVIDER_ID),
        process_status: "delivered",
        otp_confirmed_at: new Date(),
      });
    });

    it("returns 400 when order is not delivered", async () => {
      mockGetOrderById.mockResolvedValue({
        _id: new ObjectId(ORDER_ID),
        booking_id: new ObjectId(BOOKING_ID),
        seeker_id: new ObjectId(SEEKER_ID),
        provider_id: new ObjectId(PROVIDER_ID),
        process_status: "processing", // Not delivered
      });

      const res = await POST(
        makeRequest({
          order_id: ORDER_ID,
          complaint_type: "late_delivery",
          title: "Late delivery",
          description: "The delivery was very late",
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error.message).toContain("only be raised after delivery");
    });

    it("returns 400 when delivery timestamp is missing", async () => {
      mockGetOrderById.mockResolvedValue({
        _id: new ObjectId(ORDER_ID),
        booking_id: new ObjectId(BOOKING_ID),
        seeker_id: new ObjectId(SEEKER_ID),
        provider_id: new ObjectId(PROVIDER_ID),
        process_status: "delivered",
        // No otp_confirmed_at or escrow_started_at
      });

      const res = await POST(
        makeRequest({
          order_id: ORDER_ID,
          complaint_type: "late_delivery",
          title: "Late delivery",
          description: "The delivery was very late",
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error.message).toContain("Delivery timestamp missing");
    });
  });

  describe("duplicate complaint check", () => {
    beforeEach(() => {
      mockGetOrderById.mockResolvedValue({
        _id: new ObjectId(ORDER_ID),
        booking_id: new ObjectId(BOOKING_ID),
        seeker_id: new ObjectId(SEEKER_ID),
        provider_id: new ObjectId(PROVIDER_ID),
        process_status: "delivered",
        otp_confirmed_at: new Date(),
      });
    });

    it("returns 409 when complaint already exists for order", async () => {
      dbMock.complaintFindOne.mockResolvedValue({
        _id: new ObjectId(COMPLAINT_ID),
        order_id: new ObjectId(ORDER_ID),
      });

      const res = await POST(
        makeRequest({
          order_id: ORDER_ID,
          complaint_type: "late_delivery",
          title: "Late delivery",
          description: "The delivery was very late",
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error.message).toContain("already exists");
    });
  });

  describe("complaint window validation", () => {
    it("returns 409 when complaint window expired (24 hours)", async () => {
      // Delivery was 25 hours ago
      const deliveryTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
      mockGetOrderById.mockResolvedValue({
        _id: new ObjectId(ORDER_ID),
        booking_id: new ObjectId(BOOKING_ID),
        seeker_id: new ObjectId(SEEKER_ID),
        provider_id: new ObjectId(PROVIDER_ID),
        process_status: "delivered",
        otp_confirmed_at: deliveryTime,
      });

      const res = await POST(
        makeRequest({
          order_id: ORDER_ID,
          complaint_type: "late_delivery",
          title: "Late delivery",
          description: "The delivery was very late",
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error.message).toContain("Complaint window expired");
    });
  });

  describe("successful complaint creation", () => {
    beforeEach(() => {
      mockGetOrderById.mockResolvedValue({
        _id: new ObjectId(ORDER_ID),
        booking_id: new ObjectId(BOOKING_ID),
        seeker_id: new ObjectId(SEEKER_ID),
        provider_id: new ObjectId(PROVIDER_ID),
        process_status: "delivered",
        otp_confirmed_at: new Date(),
      });
    });

    it("creates complaint with order_id", async () => {
      const res = await POST(
        makeRequest({
          order_id: ORDER_ID,
          complaint_type: "late_delivery",
          title: "Late delivery complaint",
          description: "The delivery was very late and caused issues",
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data._id).toBe(COMPLAINT_ID);
      expect(mockCreateComplaint).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: expect.any(ObjectId),
          complaint_type: "late_delivery",
          title: "Late delivery complaint",
          description: "The delivery was very late and caused issues",
        }),
      );
      expect(mockFreezeEscrow).toHaveBeenCalled();
    });

    it("creates complaint with booking_id (resolves to order)", async () => {
      dbMock.orderFindOne.mockResolvedValue({
        _id: new ObjectId(ORDER_ID),
        booking_id: new ObjectId(BOOKING_ID),
        seeker_id: new ObjectId(SEEKER_ID),
        provider_id: new ObjectId(PROVIDER_ID),
        process_status: "delivered",
        otp_confirmed_at: new Date(),
      });

      const res = await POST(
        makeRequest({
          booking_id: BOOKING_ID,
          complaint_type: "damaged_item",
          title: "Damaged clothes",
          description: "My clothes were damaged during washing",
        }),
      );
      await res.json();

      expect(res.status).toBe(201);
      expect(mockCreateComplaint).toHaveBeenCalled();
    });

    it("creates complaint with photos", async () => {
      const res = await POST(
        makeRequest({
          order_id: ORDER_ID,
          complaint_type: "damaged_item",
          title: "Damaged clothes",
          description: "My clothes were damaged during washing",
          photos: ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"],
        }),
      );
      await res.json();

      expect(res.status).toBe(201);
      expect(mockCreateComplaint).toHaveBeenCalledWith(
        expect.objectContaining({
          photos: ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"],
        }),
      );
    });

    it("creates initial complaint message with title and description", async () => {
      await POST(
        makeRequest({
          order_id: ORDER_ID,
          complaint_type: "quality_issue",
          title: "Poor quality service",
          description: "The service quality was very poor",
        }),
      );

      expect(dbMock.complaintMessageInsertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          sender_id: expect.any(ObjectId),
          sender_role: "seeker",
          message_type: "TEXT",
          content: expect.stringContaining("Poor quality service"),
        }),
      );
    });
  });

  describe("error handling", () => {
    it("returns 500 on unexpected error", async () => {
      mockRequireSeeker.mockRejectedValue(new Error("Unexpected error"));

      const res = await POST(
        makeRequest({
          order_id: ORDER_ID,
          complaint_type: "late_delivery",
          title: "Late delivery",
          description: "The delivery was very late",
        }),
      );

      expect(res.status).toBe(500);
    });
  });
});

describe("GET /api/complaints", () => {
  let dbMock: ReturnType<typeof makeDbMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockRequireAuth.mockRejectedValue(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );

      const res = await GET(new Request("https://laundryease.test/api/complaints"));

      expect(res.status).toBe(401);
    });

    it("returns 401 when user ID is invalid", async () => {
      mockRequireAuth.mockResolvedValue({
        user: {
          id: "invalid-id",
          role: Role.SEEKER,
        },
      });

      const res = await GET(new Request("https://laundryease.test/api/complaints"));

      expect(res.status).toBe(401);
    });
  });

  describe("seeker complaints", () => {
    it("returns complaints for seeker", async () => {
      mockRequireAuth.mockResolvedValue({
        user: {
          id: SEEKER_ID,
          role: Role.SEEKER,
        },
      });

      const complaintId = new ObjectId(COMPLAINT_ID);
      const seekerId = new ObjectId(SEEKER_ID);
      const mockComplaints = [
        {
          _id: complaintId,
          seeker_id: seekerId,
          status: "open",
        },
      ];
      dbMock.complaintFind.mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockComplaints),
      });

      const res = await GET(new Request("https://laundryease.test/api/complaints"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(String(data.data[0]._id)).toBe(COMPLAINT_ID);
    });

    it("returns only active complaints for seeker", async () => {
      mockRequireAuth.mockResolvedValue({
        user: {
          id: SEEKER_ID,
          role: Role.SEEKER,
        },
      });

      await GET(new Request("https://laundryease.test/api/complaints"));

      expect(dbMock.complaintFind).toHaveBeenCalledWith(
        expect.objectContaining({
          seeker_id: expect.any(ObjectId),
          status: { $in: ["open", "accepted", "in_review"] },
        }),
      );
    });
  });

  describe("provider complaints", () => {
    it("returns complaints for provider with access granted", async () => {
      mockRequireAuth.mockResolvedValue({
        user: {
          id: PROVIDER_ID,
          role: Role.PROVIDER,
        },
      });

      const complaintId = new ObjectId(COMPLAINT_ID);
      const providerId = new ObjectId(PROVIDER_ID);
      const mockComplaints = [
        {
          _id: complaintId,
          provider_id: providerId,
          provider_access_granted: true,
          status: "open",
        },
      ];
      dbMock.complaintFind.mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockComplaints),
      });

      const res = await GET(new Request("https://laundryease.test/api/complaints"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(String(data.data[0]._id)).toBe(COMPLAINT_ID);
    });

    it("returns only complaints with provider_access_granted for provider", async () => {
      mockRequireAuth.mockResolvedValue({
        user: {
          id: PROVIDER_ID,
          role: Role.PROVIDER,
        },
      });

      await GET(new Request("https://laundryease.test/api/complaints"));

      expect(dbMock.complaintFind).toHaveBeenCalledWith(
        expect.objectContaining({
          provider_id: expect.any(ObjectId),
          status: { $in: ["open", "accepted", "in_review"] },
          provider_access_granted: true,
        }),
      );
    });
  });

  describe("other roles", () => {
    it("returns empty array for unknown role", async () => {
      mockRequireAuth.mockResolvedValue({
        user: {
          id: SEEKER_ID,
          role: "unknown" as Role,
        },
      });

      const res = await GET(new Request("https://laundryease.test/api/complaints"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("returns 500 on unexpected error", async () => {
      mockRequireAuth.mockRejectedValue(new Error("Unexpected error"));

      const res = await GET(new Request("https://laundryease.test/api/complaints"));

      expect(res.status).toBe(500);
    });
  });
});
