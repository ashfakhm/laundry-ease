import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const {
  mockRequireAuth,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
  mockGetDb,
  mockEmitOrderMessageCreated,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
  mockGetDb: vi.fn(),
  mockEmitOrderMessageCreated: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/api/security", () => ({
  requireSameOrigin: mockRequireSameOrigin,
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/realtime/emitter", () => ({
  emitOrderMessageCreated: mockEmitOrderMessageCreated,
}));

import { POST } from "./route";

function makeDbMock() {
  const ordersFindOne = vi.fn();
  const orderChatsInsertOne = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "orders") {
        return { findOne: ordersFindOne };
      }
      if (name === "order_chats") {
        return { insertOne: orderChatsInsertOne };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return { db, ordersFindOne, orderChatsInsertOne };
}

function makeRequest(body: unknown) {
  return new Request("https://laundryease.test/api/orders/id/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/orders/[id]/chat", () => {
  const orderId = new ObjectId();
  const seekerId = new ObjectId();
  const providerId = new ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 40,
      remaining: 39,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockRequireAuth.mockResolvedValue({
      user: {
        id: seekerId.toString(),
        role: "seeker",
        email: "seeker@laundryease.test",
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("stores message with attachments", async () => {
    const dbMock = makeDbMock();
    dbMock.ordersFindOne.mockResolvedValue({
      _id: orderId,
      seeker_id: seekerId,
      provider_id: providerId,
    });
    const insertedId = new ObjectId();
    dbMock.orderChatsInsertOne.mockResolvedValue({ insertedId });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(
      makeRequest({
        message: "Here are the photos",
        attachments: ["https://res.cloudinary.com/test/photo1.jpg"],
      }),
      { params: Promise.resolve({ id: orderId.toString() }) },
    );

    expect(res.status).toBe(200);
    expect(dbMock.orderChatsInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Here are the photos",
        attachments: ["https://res.cloudinary.com/test/photo1.jpg"],
        sender_role: "seeker",
      }),
    );
    const body = await res.json();
    expect(body.data).toMatchObject({
      _id: insertedId.toString(),
      order_id: orderId.toString(),
      sender_id: seekerId.toString(),
      attachments: ["https://res.cloudinary.com/test/photo1.jpg"],
      voiceMessage: "",
    });
    expect(mockEmitOrderMessageCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: insertedId,
        order_id: orderId,
      }),
    );
  });

  it("accepts attachment-only message (no text)", async () => {
    const dbMock = makeDbMock();
    dbMock.ordersFindOne.mockResolvedValue({
      _id: orderId,
      seeker_id: seekerId,
      provider_id: providerId,
    });
    const insertedId = new ObjectId();
    dbMock.orderChatsInsertOne.mockResolvedValue({ insertedId });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(
      makeRequest({
        attachments: ["https://res.cloudinary.com/test/photo1.jpg"],
      }),
      { params: Promise.resolve({ id: orderId.toString() }) },
    );

    expect(res.status).toBe(200);
    expect(dbMock.orderChatsInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "",
        attachments: ["https://res.cloudinary.com/test/photo1.jpg"],
      }),
    );
  });

  it("rejects message with no text and no attachments", async () => {
    const res = await POST(
      makeRequest({ message: "   ", attachments: [] }),
      { params: Promise.resolve({ id: orderId.toString() }) },
    );

    expect(res.status).toBe(400);
  });

  it("accepts text-only message with no attachments", async () => {
    const dbMock = makeDbMock();
    dbMock.ordersFindOne.mockResolvedValue({
      _id: orderId,
      seeker_id: seekerId,
      provider_id: providerId,
    });
    const insertedId = new ObjectId();
    dbMock.orderChatsInsertOne.mockResolvedValue({ insertedId });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(
      makeRequest({ message: "Hello provider!" }),
      { params: Promise.resolve({ id: orderId.toString() }) },
    );

    expect(res.status).toBe(200);
    expect(dbMock.orderChatsInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Hello provider!",
        attachments: [],
        voiceMessage: "",
      }),
    );
  });

  it("accepts voice-only message", async () => {
    const dbMock = makeDbMock();
    dbMock.ordersFindOne.mockResolvedValue({
      _id: orderId,
      seeker_id: seekerId,
      provider_id: providerId,
    });
    const insertedId = new ObjectId();
    dbMock.orderChatsInsertOne.mockResolvedValue({ insertedId });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(
      makeRequest({
        voiceMessage: "https://res.cloudinary.com/test/voice.webm",
      }),
      { params: Promise.resolve({ id: orderId.toString() }) },
    );

    expect(res.status).toBe(200);
    expect(dbMock.orderChatsInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "",
        attachments: [],
        voiceMessage: "https://res.cloudinary.com/test/voice.webm",
      }),
    );
  });

  it("accepts voice-only data URL message", async () => {
    const dbMock = makeDbMock();
    dbMock.ordersFindOne.mockResolvedValue({
      _id: orderId,
      seeker_id: seekerId,
      provider_id: providerId,
    });
    const insertedId = new ObjectId();
    const voiceMessage = "data:audio/webm;codecs=opus;base64,AAAA";
    dbMock.orderChatsInsertOne.mockResolvedValue({ insertedId });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(
      makeRequest({
        voiceMessage,
      }),
      { params: Promise.resolve({ id: orderId.toString() }) },
    );

    expect(res.status).toBe(200);
    expect(dbMock.orderChatsInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "",
        attachments: [],
        voiceMessage,
      }),
    );
  });
});
