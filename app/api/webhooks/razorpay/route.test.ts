import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";

const { mockGetDb } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/env", () => ({
  env: {
    RAZORPAY_KEY_SECRET: "webhook_test_secret",
  },
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

function makeDbMock() {
  const webhookFindOne = vi.fn();
  const webhookInsertOne = vi.fn();
  const webhookUpdateOne = vi.fn();
  const paymentsUpdateOne = vi.fn();
  const ordersFindOne = vi.fn();
  const ordersUpdateOne = vi.fn();
  const bookingsUpdateOne = vi.fn();
  const refundsUpdateOne = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "webhook_events") {
        return {
          findOne: webhookFindOne,
          insertOne: webhookInsertOne,
          updateOne: webhookUpdateOne,
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
    webhookFindOne,
    webhookInsertOne,
    webhookUpdateOne,
    paymentsUpdateOne,
    ordersFindOne,
    ordersUpdateOne,
    bookingsUpdateOne,
    refundsUpdateOne,
  };
}

function signPayload(body: string) {
  return crypto
    .createHmac("sha256", "webhook_test_secret")
    .update(body)
    .digest("hex");
}

function makePaymentCapturedEvent(id: string) {
  return {
    id,
    event: "payment.captured",
    entity: "event",
    payload: {
      payment: {
        entity: {
          id: "pay_123",
          order_id: "order_123",
          status: "captured",
          amount: 49900,
          currency: "INR",
          method: "card",
          captured_at: 1_707_000_000,
        },
      },
    },
  };
}

function makeRefundCreatedEvent(
  id: string,
  options?: { amountPaise?: number; paymentId?: string; refundId?: string },
) {
  return {
    id,
    event: "refund.created",
    entity: "event",
    payload: {
      refund: {
        entity: {
          id: options?.refundId || "rfnd_123",
          payment_id: options?.paymentId || "pay_123",
          amount: options?.amountPaise ?? 5000,
          currency: "INR",
          status: "processed",
          notes: {
            source: "test",
          },
        },
      },
    },
  };
}

function makeRequest(bodyObject: unknown, options?: { withSignature?: boolean }) {
  const rawBody = JSON.stringify(bodyObject);
  const headers = new Headers({
    "Content-Type": "application/json",
  });

  if (options?.withSignature !== false) {
    headers.set("x-razorpay-signature", signPayload(rawBody));
  }

  return new Request("https://laundryease.test/api/webhooks/razorpay", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

describe("POST /api/webhooks/razorpay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when signature header is missing", async () => {
    const res = await POST(
      makeRequest(makePaymentCapturedEvent("evt_missing_sig"), {
        withSignature: false,
      }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Missing signature");
  });

  it("returns duplicate acknowledgement for already-processed events", async () => {
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    dbMock.webhookFindOne.mockResolvedValue({ processed: true });

    const res = await POST(
      makeRequest(makePaymentCapturedEvent("evt_duplicate")) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.received).toBe(true);
    expect(data.duplicate).toBe(true);
    expect(dbMock.webhookInsertOne).not.toHaveBeenCalled();
    expect(dbMock.paymentsUpdateOne).not.toHaveBeenCalled();
  });

  it("retries processing when an existing event is marked unprocessed", async () => {
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    dbMock.webhookFindOne.mockResolvedValue({ processed: false });
    dbMock.webhookUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.paymentsUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.ordersUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.bookingsUpdateOne.mockResolvedValue({ modifiedCount: 1 });

    const res = await POST(
      makeRequest(makePaymentCapturedEvent("evt_retry")) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.received).toBe(true);
    expect(dbMock.webhookUpdateOne).toHaveBeenCalledWith(
      { event_id: "evt_retry" },
      expect.objectContaining({
        $set: expect.objectContaining({
          processing_error: null,
        }),
      }),
    );
    expect(dbMock.webhookUpdateOne).toHaveBeenCalledWith(
      { event_id: "evt_retry" },
      expect.objectContaining({
        $set: expect.objectContaining({
          processed: true,
          processing_error: null,
        }),
      }),
    );
    expect(dbMock.paymentsUpdateOne).toHaveBeenCalledOnce();
  });

  it("marks event as failed when processing throws", async () => {
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    dbMock.webhookFindOne.mockResolvedValue(null);
    dbMock.webhookInsertOne.mockResolvedValue({ acknowledged: true });
    dbMock.paymentsUpdateOne.mockRejectedValue(new Error("db_write_failed"));

    const res = await POST(
      makeRequest(makePaymentCapturedEvent("evt_fail")) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Webhook processing failed");
    expect(dbMock.webhookUpdateOne).toHaveBeenCalledWith(
      { event_id: "evt_fail" },
      expect.objectContaining({
        $set: expect.objectContaining({
          processed: false,
          processing_error: "db_write_failed",
        }),
      }),
    );
  });

  it("keeps order active on partial refund events", async () => {
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    dbMock.webhookFindOne.mockResolvedValue(null);
    dbMock.webhookInsertOne.mockResolvedValue({ acknowledged: true });
    dbMock.webhookUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.refundsUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.ordersFindOne.mockResolvedValue({
      _id: "order_1",
      total_price: 500,
      refund_amount: 100,
      razorpay_refund_id: "rfnd_old",
    });
    dbMock.ordersUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.bookingsUpdateOne.mockResolvedValue({ modifiedCount: 0 });

    const res = await POST(
      makeRequest(
        makeRefundCreatedEvent("evt_partial_refund", {
          amountPaise: 5000,
          refundId: "rfnd_partial",
        }),
      ) as never,
    );
    expect(res.status).toBe(200);

    const orderUpdatePayload = dbMock.ordersUpdateOne.mock.calls.at(-1)?.[1] as {
      $set: Record<string, unknown>;
    };
    expect(orderUpdatePayload.$set.refund_amount).toBe(150);
    expect(orderUpdatePayload.$set.razorpay_refund_id).toBe("rfnd_partial");
    expect(orderUpdatePayload.$set.payment_status).toBeUndefined();
  });

  it("marks order as refunded when webhook refunds full paid amount", async () => {
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    dbMock.webhookFindOne.mockResolvedValue(null);
    dbMock.webhookInsertOne.mockResolvedValue({ acknowledged: true });
    dbMock.webhookUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.refundsUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.ordersFindOne.mockResolvedValue({
      _id: "order_2",
      total_price: 500,
      refund_amount: 460,
      razorpay_refund_id: "rfnd_old",
    });
    dbMock.ordersUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.bookingsUpdateOne.mockResolvedValue({ modifiedCount: 0 });

    const res = await POST(
      makeRequest(
        makeRefundCreatedEvent("evt_full_refund", {
          amountPaise: 4000,
          refundId: "rfnd_full",
        }),
      ) as never,
    );
    expect(res.status).toBe(200);

    const orderUpdatePayload = dbMock.ordersUpdateOne.mock.calls.at(-1)?.[1] as {
      $set: Record<string, unknown>;
    };
    expect(orderUpdatePayload.$set.refund_amount).toBe(500);
    expect(orderUpdatePayload.$set.payment_status).toBe("refunded");
  });
});
