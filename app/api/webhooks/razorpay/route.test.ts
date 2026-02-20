import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import crypto from "crypto";

const { mockGetDb, mockEnv } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockEnv: {
    RAZORPAY_KEY_SECRET: "test_secret_key_12345",
  },
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/env", () => ({
  env: mockEnv,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { POST, GET } from "./route";

const WEBHOOK_SECRET = "test_secret_key_12345";

function createValidSignature(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function makeDbMock() {
  const webhookEventsFindOne = vi.fn();
  const webhookEventsFindOneAndUpdate = vi.fn();
  const webhookEventsInsertOne = vi.fn();
  const webhookEventsUpdateOne = vi.fn();
  const paymentsUpdateOne = vi.fn();
  const ordersFindOne = vi.fn();
  const ordersUpdateOne = vi.fn();
  const bookingsUpdateOne = vi.fn();
  const refundsUpdateOne = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "webhook_events") {
        return {
          findOne: webhookEventsFindOne,
          findOneAndUpdate: webhookEventsFindOneAndUpdate,
          insertOne: webhookEventsInsertOne,
          updateOne: webhookEventsUpdateOne,
        };
      }
      if (name === "payments") {
        return {
          updateOne: paymentsUpdateOne,
        };
      }
      if (name === "orders") {
        return {
          findOne: ordersFindOne,
          updateOne: ordersUpdateOne,
        };
      }
      if (name === "bookings") {
        return {
          updateOne: bookingsUpdateOne,
        };
      }
      if (name === "refunds") {
        return {
          updateOne: refundsUpdateOne,
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return {
    db,
    webhookEventsFindOne,
    webhookEventsFindOneAndUpdate,
    webhookEventsInsertOne,
    webhookEventsUpdateOne,
    paymentsUpdateOne,
    ordersFindOne,
    ordersUpdateOne,
    bookingsUpdateOne,
    refundsUpdateOne,
  };
}

function makeWebhookRequest(body: string, signature?: string): NextRequest {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  if (signature) {
    headers.set("x-razorpay-signature", signature);
  }

  return new NextRequest("https://laundryease.test/api/webhooks/razorpay", {
    method: "POST",
    headers,
    body,
  });
}

const mockClient = {
  startSession: vi.fn(() => ({
    withTransaction: vi.fn(async (callback) => await callback({})),
    endSession: vi.fn(),
  })),
};

describe("POST /api/webhooks/razorpay", () => {
  let dbMock: ReturnType<typeof makeDbMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db, client: mockClient });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("signature validation", () => {
    it("returns 400 when signature header is missing", async () => {
      const res = await POST(makeWebhookRequest('{"event":"test"}'));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toBe("Missing signature");
    });

    it("returns 401 when signature format is invalid", async () => {
      const res = await POST(
        makeWebhookRequest('{"event":"test"}', "invalid-signature"),
      );

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.message).toBe("Invalid signature");
    });

    it("returns 401 when signature does not match", async () => {
      const body = '{"event":"test"}';
      const wrongSignature = "a".repeat(64); // Valid format but wrong signature

      const res = await POST(makeWebhookRequest(body, wrongSignature));

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.message).toBe("Invalid signature");
    });
  });

  describe("payload validation", () => {
    it("returns 400 when event id is missing", async () => {
      const body = '{"event":"payment.captured","payload":{}}';
      const signature = createValidSignature(body, WEBHOOK_SECRET);

      const res = await POST(makeWebhookRequest(body, signature));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toBe("Invalid payload");
    });

    it("returns 400 when event type is missing", async () => {
      const body = '{"id":"evt_123","payload":{}}';
      const signature = createValidSignature(body, WEBHOOK_SECRET);

      const res = await POST(makeWebhookRequest(body, signature));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toBe("Invalid payload");
    });
  });

  describe("idempotency", () => {
    it("returns success for duplicate processed event", async () => {
      const body = JSON.stringify({
        id: "evt_duplicate",
        event: "payment.captured",
        entity: "event",
        payload: {
          payment: {
            entity: {
              id: "pay_123",
              order_id: "order_123",
              status: "captured",
              amount: 10000,
              currency: "INR",
              method: "upi",
              captured_at: Math.floor(Date.now() / 1000),
            },
          },
        },
      });
      const signature = createValidSignature(body, WEBHOOK_SECRET);

      dbMock.webhookEventsFindOneAndUpdate.mockResolvedValue({
        event_id: "evt_duplicate",
        processed: true,
      });

      const res = await POST(makeWebhookRequest(body, signature));

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.duplicate).toBe(true);
      // Should not process the event again
      expect(dbMock.paymentsUpdateOne).not.toHaveBeenCalled();
    });

    it("retries processing for unprocessed event", async () => {
      const body = JSON.stringify({
        id: "evt_retry",
        event: "payment.captured",
        entity: "event",
        payload: {
          payment: {
            entity: {
              id: "pay_123",
              order_id: "order_123",
              status: "captured",
              amount: 10000,
              currency: "INR",
              method: "upi",
              captured_at: Math.floor(Date.now() / 1000),
            },
          },
        },
      });
      const signature = createValidSignature(body, WEBHOOK_SECRET);

      // Event exists but not processed
      dbMock.webhookEventsFindOneAndUpdate.mockResolvedValue({
        event_id: "evt_retry",
        processed: false,
      });
      dbMock.webhookEventsUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      dbMock.paymentsUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      dbMock.ordersUpdateOne.mockResolvedValue({ modifiedCount: 0 });
      dbMock.bookingsUpdateOne.mockResolvedValue({ modifiedCount: 0 });

      const res = await POST(makeWebhookRequest(body, signature));

      expect(res.status).toBe(200);
      // Should update the retry_started_at
      expect(dbMock.webhookEventsUpdateOne).toHaveBeenCalledWith(
        { event_id: "evt_retry" },
        expect.objectContaining({
          $set: expect.objectContaining({
            processing_error: null,
          }),
        }),
      );
    });
  });

  describe("payment.captured event", () => {
    it("updates payment and order status", async () => {
      const body = JSON.stringify({
        id: "evt_capture_1",
        event: "payment.captured",
        entity: "event",
        payload: {
          payment: {
            entity: {
              id: "pay_capture_1",
              order_id: "order_capture_1",
              status: "captured",
              amount: 50000, // 500 INR in paise
              currency: "INR",
              method: "card",
              captured_at: Math.floor(Date.now() / 1000),
            },
          },
        },
      });
      const signature = createValidSignature(body, WEBHOOK_SECRET);

      dbMock.webhookEventsFindOneAndUpdate.mockResolvedValue(null);
      dbMock.webhookEventsUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      dbMock.paymentsUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      dbMock.ordersUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      dbMock.bookingsUpdateOne.mockResolvedValue({ modifiedCount: 0 });

      const res = await POST(makeWebhookRequest(body, signature));

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.received).toBe(true);

      // Verify payment update
      expect(dbMock.paymentsUpdateOne).toHaveBeenCalledWith(
        { razorpay_payment_id: "pay_capture_1" },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: "captured",
            amount: 500, // Converted from paise
            currency: "INR",
            method: "card",
          }),
        }),
        expect.objectContaining({ upsert: true, session: expect.anything() }),
      );

      // Verify order update
      expect(dbMock.ordersUpdateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          razorpay_order_id: "order_capture_1",
          payment_status: "unpaid",
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            payment_status: "paid",
            razorpay_payment_id: "pay_capture_1",
          }),
        }),
        expect.objectContaining({ session: expect.anything() }),
      );
    });

    it("updates booking fee status for booking-fee flow", async () => {
      const body = JSON.stringify({
        id: "evt_booking_fee",
        event: "payment.captured",
        entity: "event",
        payload: {
          payment: {
            entity: {
              id: "pay_booking_fee",
              order_id: "order_booking_fee",
              status: "captured",
              amount: 9900, // 99 INR in paise
              currency: "INR",
              method: "upi",
              captured_at: Math.floor(Date.now() / 1000),
            },
          },
        },
      });
      const signature = createValidSignature(body, WEBHOOK_SECRET);

      dbMock.webhookEventsFindOneAndUpdate.mockResolvedValue(null);
      dbMock.webhookEventsUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      dbMock.paymentsUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      dbMock.ordersUpdateOne.mockResolvedValue({ modifiedCount: 0 });
      dbMock.bookingsUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      const res = await POST(makeWebhookRequest(body, signature));

      expect(res.status).toBe(200);

      // Verify booking update
      expect(dbMock.bookingsUpdateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          razorpay_order_id: "order_booking_fee",
          status: "requested",
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            bookingFeeStatus: "paid",
            razorpay_payment_id: "pay_booking_fee",
          }),
        }),
        expect.objectContaining({ session: expect.anything() }),
      );
    });
  });

  describe("payment.failed event", () => {
    it("updates payment and order with error details", async () => {
      const body = JSON.stringify({
        id: "evt_failed_1",
        event: "payment.failed",
        entity: "event",
        payload: {
          payment: {
            entity: {
              id: "pay_failed_1",
              order_id: "order_failed_1",
              status: "failed",
              error_code: "BAD_REQUEST_ERROR",
              error_description: "Payment failed due to insufficient funds",
            },
          },
        },
      });
      const signature = createValidSignature(body, WEBHOOK_SECRET);

      dbMock.webhookEventsFindOneAndUpdate.mockResolvedValue(null);
      dbMock.webhookEventsUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      dbMock.paymentsUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      dbMock.ordersUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      const res = await POST(makeWebhookRequest(body, signature));

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify payment update
      expect(dbMock.paymentsUpdateOne).toHaveBeenCalledWith(
        { razorpay_payment_id: "pay_failed_1" },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: "failed",
            error_code: "BAD_REQUEST_ERROR",
            error_description: "Payment failed due to insufficient funds",
          }),
        }),
        expect.objectContaining({ session: expect.anything() }),
      );

      // Verify order update
      expect(dbMock.ordersUpdateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          razorpay_order_id: "order_failed_1",
          payment_status: "unpaid",
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            payment_last_error: "Payment failed due to insufficient funds",
            payment_last_error_code: "BAD_REQUEST_ERROR",
          }),
        }),
        expect.objectContaining({ session: expect.anything() }),
      );
    });
  });

  describe("refund.created event", () => {
    it("updates refund and order status", async () => {
      const body = JSON.stringify({
        id: "evt_refund_1",
        event: "refund.created",
        entity: "event",
        payload: {
          refund: {
            entity: {
              id: "rfnd_1",
              payment_id: "pay_refund_1",
              amount: 50000, // 500 INR in paise
              currency: "INR",
              status: "processed",
              notes: { reason: "Customer request" },
            },
          },
        },
      });
      const signature = createValidSignature(body, WEBHOOK_SECRET);

      dbMock.webhookEventsFindOneAndUpdate.mockResolvedValue(null);
      dbMock.webhookEventsUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      dbMock.refundsUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      dbMock.ordersFindOne.mockResolvedValue({
        _id: "order_1",
        total_price: 500,
        refund_amount: 0,
        razorpay_refund_id: null,
      });
      dbMock.ordersUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      dbMock.bookingsUpdateOne.mockResolvedValue({ modifiedCount: 0 });

      const res = await POST(makeWebhookRequest(body, signature));

      expect(res.status).toBe(200);

      // Verify refund update
      expect(dbMock.refundsUpdateOne).toHaveBeenCalledWith(
        { razorpay_refund_id: "rfnd_1" },
        expect.objectContaining({
          $set: expect.objectContaining({
            payment_id: "pay_refund_1",
            amount: 500, // Converted from paise
            currency: "INR",
            status: "processed",
          }),
        }),
        expect.objectContaining({ upsert: true, session: expect.anything() }),
      );
    });

    it("marks order as fully refunded when total is reached", async () => {
      const body = JSON.stringify({
        id: "evt_full_refund",
        event: "refund.created",
        entity: "event",
        payload: {
          refund: {
            entity: {
              id: "rfnd_full",
              payment_id: "pay_full_refund",
              amount: 50000, // Full amount
              currency: "INR",
              status: "processed",
            },
          },
        },
      });
      const signature = createValidSignature(body, WEBHOOK_SECRET);

      dbMock.webhookEventsFindOneAndUpdate.mockResolvedValue(null);
      dbMock.webhookEventsUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      dbMock.refundsUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      dbMock.ordersFindOne.mockResolvedValue({
        _id: "order_full",
        total_price: 500,
        refund_amount: 0,
        razorpay_refund_id: null,
      });
      dbMock.ordersUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      dbMock.bookingsUpdateOne.mockResolvedValue({ modifiedCount: 0 });

      const res = await POST(makeWebhookRequest(body, signature));

      expect(res.status).toBe(200);

      // Verify order marked as refunded
      expect(dbMock.ordersUpdateOne).toHaveBeenCalledWith(
        { _id: "order_full" },
        expect.objectContaining({
          $set: expect.objectContaining({
            payment_status: "refunded",
            refund_amount: 500,
          }),
        }),
        expect.objectContaining({ session: expect.anything() }),
      );
    });
  });

  describe("payout events", () => {
    it("handles payout.processed event", async () => {
      const body = JSON.stringify({
        id: "evt_payout_1",
        event: "payout.processed",
        entity: "event",
        payload: {
          payout: {
            entity: {
              id: "payout_1",
              status: "processed",
              utr: "UTR123456789",
            },
          },
        },
      });
      const signature = createValidSignature(body, WEBHOOK_SECRET);

      dbMock.webhookEventsFindOneAndUpdate.mockResolvedValue(null);
      dbMock.webhookEventsUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      dbMock.ordersUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      dbMock.bookingsUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      const res = await POST(makeWebhookRequest(body, signature));

      expect(res.status).toBe(200);

      // Verify booking update
      expect(dbMock.bookingsUpdateOne).toHaveBeenCalledWith(
        { payout_id: "payout_1" },
        expect.objectContaining({
          $set: expect.objectContaining({
            payout_status: "paid",
            payout_utr: "UTR123456789",
            bookingFeeStatus: "applied",
          }),
        }),
        expect.objectContaining({ session: expect.anything() }),
      );
    });

    it("handles payout.failed event", async () => {
      const body = JSON.stringify({
        id: "evt_payout_failed",
        event: "payout.failed",
        entity: "event",
        payload: {
          payout: {
            entity: {
              id: "payout_failed_1",
              status: "failed",
              utr: null,
            },
          },
        },
      });
      const signature = createValidSignature(body, WEBHOOK_SECRET);

      dbMock.webhookEventsFindOneAndUpdate.mockResolvedValue(null);
      dbMock.webhookEventsUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      dbMock.ordersUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      dbMock.bookingsUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      const res = await POST(makeWebhookRequest(body, signature));

      expect(res.status).toBe(200);

      // Verify booking update with failed status
      expect(dbMock.bookingsUpdateOne).toHaveBeenCalledWith(
        { payout_id: "payout_failed_1" },
        expect.objectContaining({
          $set: expect.objectContaining({
            payout_status: "failed",
            bookingFeeStatus: "paid",
          }),
        }),
        expect.objectContaining({ session: expect.anything() }),
      );
    });
  });

  describe("unhandled events", () => {
    it("returns success for unhandled event types", async () => {
      const body = JSON.stringify({
        id: "evt_unhandled",
        event: "some.unknown.event",
        entity: "event",
        payload: {},
      });
      const signature = createValidSignature(body, WEBHOOK_SECRET);

      dbMock.webhookEventsFindOneAndUpdate.mockResolvedValue(null);
      dbMock.webhookEventsUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      const res = await POST(makeWebhookRequest(body, signature));

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.received).toBe(true);
    });
  });

  describe("error handling", () => {
    it("returns 500 on unexpected error and logs event failure", async () => {
      const body = JSON.stringify({
        id: "evt_error",
        event: "payment.captured",
        entity: "event",
        payload: {
          payment: {
            entity: {
              id: "pay_error",
              order_id: "order_error",
              status: "captured",
              amount: 10000,
              currency: "INR",
              method: "upi",
            },
          },
        },
      });
      const signature = createValidSignature(body, WEBHOOK_SECRET);

      dbMock.webhookEventsFindOneAndUpdate.mockResolvedValue(null);
      dbMock.paymentsUpdateOne.mockRejectedValue(new Error("Database error"));
      dbMock.webhookEventsUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      const res = await POST(makeWebhookRequest(body, signature));

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.message).toBe("An unexpected error occurred");

      // Verify error was logged
      expect(dbMock.webhookEventsUpdateOne).toHaveBeenCalledWith(
        { event_id: "evt_error" },
        expect.objectContaining({
          $set: expect.objectContaining({
            processed: false,
            processing_error: "Database error",
          }),
        }),
      );
    });
  });
});

describe("GET /api/webhooks/razorpay", () => {
  it("returns 405 method not allowed", async () => {
    const res = await GET();

    expect(res.status).toBe(405);
    const data = await res.json();
    expect(data.message).toBe("Method not allowed");
  });
});
