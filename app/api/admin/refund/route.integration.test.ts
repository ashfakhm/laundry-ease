import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { ObjectId, type Db, type MongoClient } from "mongodb";

const {
  mockRequireAdminWithDbCheck,
  mockRefundRazorpayPayment,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
  mockedEnv,
} = vi.hoisted(() => ({
  mockRequireAdminWithDbCheck: vi.fn(),
  mockRefundRazorpayPayment: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
  mockedEnv: {
    MONGODB_URI: "",
    MONGODB_DB: "laundryease_integration_refund",
  },
}));

vi.mock("@/lib/api/auth", () => ({
  requireAdminWithDbCheck: mockRequireAdminWithDbCheck,
}));

vi.mock("@/lib/razorpay", () => ({
  refundRazorpayPayment: mockRefundRazorpayPayment,
}));

vi.mock("@/lib/api/security", () => ({
  requireSameOrigin: mockRequireSameOrigin,
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/env", () => ({
  env: mockedEnv,
}));

let mongoServer: MongoMemoryServer;
let db: Db;
let mongoClient: MongoClient;
let POST: (typeof import("./route"))["POST"];

function makeRequest(body: unknown) {
  return new Request("https://laundryease.test/api/admin/refund", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/refund (integration)", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    mockedEnv.MONGODB_URI = mongoServer.getUri();

    const mongodbModule = await import("@/lib/mongodb");
    const connected = await mongodbModule.getDb();
    db = connected.db;
    mongoClient = connected.client;

    ({ POST } = await import("./route"));
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    await Promise.all([
      db.collection("orders").deleteMany({}),
      db.collection("bookings").deleteMany({}),
      db.collection("admin_logs").deleteMany({}),
      db.collection("api_rate_limits").deleteMany({}),
    ]);

    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 30,
      remaining: 29,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockRequireAdminWithDbCheck.mockResolvedValue({
      user: {
        id: new ObjectId().toString(),
        role: "admin",
        email: "admin@laundryease.test",
      },
    });
    mockRefundRazorpayPayment.mockResolvedValue({ id: "rfnd_live_1" });
  });

  afterAll(async () => {
    await mongoClient.close();
    await mongoServer.stop();
    global._mongoClientPromise = undefined;
    global._mongoIndexInitPromise = undefined;
  });

  it("refunds an eligible order and persists state transition", async () => {
    const orderId = new ObjectId();
    await db.collection("orders").insertOne({
      _id: orderId,
      payment_status: "paid",
      razorpay_payment_id: "pay_live_order",
      total_price: 450,
      delivery_charge: 20,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await POST(
      makeRequest({
        orderId: orderId.toString(),
        paymentId: "pay_live_order",
        reason: "Manual settlement correction",
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockRefundRazorpayPayment).toHaveBeenCalledWith(
      "pay_live_order",
      45000,
      expect.objectContaining({
        order_id: orderId.toString(),
      }),
    );

    const updatedOrder = await db
      .collection("orders")
      .findOne({ _id: orderId });
    expect(updatedOrder?.payment_status).toBe("refunded");
    expect(updatedOrder?.refund_reason).toBe("Manual settlement correction");
    expect(updatedOrder?.razorpay_refund_id).toBe("rfnd_live_1");

    const logs = await db
      .collection("admin_logs")
      .find({ orderId: orderId.toString() })
      .toArray();
    expect(logs).toHaveLength(1);
  });

  it("returns idempotent success for already-refunded orders", async () => {
    const orderId = new ObjectId();
    await db.collection("orders").insertOne({
      _id: orderId,
      payment_status: "refunded",
      razorpay_payment_id: "pay_live_order_2",
      total_price: 300,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await POST(
      makeRequest({
        orderId: orderId.toString(),
        paymentId: "pay_live_order_2",
        reason: "Duplicate trigger",
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.idempotent).toBe(true);
    expect(mockRefundRazorpayPayment).not.toHaveBeenCalled();
  });

  it("refunds booking fee and records refund metadata", async () => {
    const bookingId = new ObjectId();
    await db.collection("bookings").insertOne({
      _id: bookingId,
      status: "cancelled",
      bookingFeeStatus: "paid",
      bookingFee: 149,
      razorpay_payment_id: "pay_booking_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await POST(
      makeRequest({
        bookingId: bookingId.toString(),
        paymentId: "pay_booking_1",
        reason: "Provider cancellation before service",
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    const updatedBooking = await db
      .collection("bookings")
      .findOne({ _id: bookingId });
    expect(updatedBooking?.bookingFeeStatus).toBe("refunded");
    expect(updatedBooking?.booking_fee_refund_id).toBe("rfnd_live_1");
  });
});
