import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";

const {
  mockRequireAuth,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
  mockGetDb,
  mockCanAccessComplaintConversation,
  mockEmitComplaintMessageCreated,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
  mockGetDb: vi.fn(),
  mockCanAccessComplaintConversation: vi.fn(),
  mockEmitComplaintMessageCreated: vi.fn(),
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

vi.mock("@/lib/complaints/access", () => ({
  canAccessComplaintConversation: mockCanAccessComplaintConversation,
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
  emitComplaintMessageCreated: mockEmitComplaintMessageCreated,
}));

import { POST } from "./route";

function makeDbMock() {
  const complaintsFindOne = vi.fn();
  const complaintMessagesInsertOne = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "complaints") {
        return {
          findOne: complaintsFindOne,
        };
      }
      if (name === "complaint_messages") {
        return {
          insertOne: complaintMessagesInsertOne,
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return {
    db,
    complaintsFindOne,
    complaintMessagesInsertOne,
  };
}

function makeRequest(body: unknown) {
  return new Request("https://laundryease.test/api/complaints/id/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/complaints/[id]/messages", () => {
  const complaintId = new ObjectId();
  const seekerId = new ObjectId();
  const providerId = new ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 25,
      remaining: 24,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockRequireAuth.mockResolvedValue({
      user: {
        id: seekerId.toString(),
        role: Role.SEEKER,
        email: "seeker@laundryease.test",
      },
    });
    mockCanAccessComplaintConversation.mockReturnValue({
      allowed: true,
      role: "seeker",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("accepts attachment-only message and stores IMAGE type", async () => {
    const dbMock = makeDbMock();
    dbMock.complaintsFindOne.mockResolvedValue({
      _id: complaintId,
      seeker_id: seekerId,
      provider_id: providerId,
      provider_access_granted: true,
      status: "in_review",
    });
    const insertedId = new ObjectId();
    dbMock.complaintMessagesInsertOne.mockResolvedValue({
      insertedId,
    });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(
      makeRequest({
        content: "",
        attachments: ["https://example.com/evidence-1.jpg"],
      }),
      { params: Promise.resolve({ id: complaintId.toString() }) },
    );

    expect(res.status).toBe(201);
    expect(dbMock.complaintMessagesInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "",
        message_type: "IMAGE",
        attachments: ["https://example.com/evidence-1.jpg"],
      }),
    );
    const body = await res.json();
    expect(body.data).toMatchObject({
      _id: insertedId.toString(),
      complaint_id: complaintId.toString(),
      sender_id: seekerId.toString(),
      message_type: "IMAGE",
    });
    expect(mockEmitComplaintMessageCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: insertedId,
        complaint_id: complaintId,
      }),
    );
  });

  it("accepts voice-only data URL message and stores VOICE type", async () => {
    const dbMock = makeDbMock();
    dbMock.complaintsFindOne.mockResolvedValue({
      _id: complaintId,
      seeker_id: seekerId,
      provider_id: providerId,
      provider_access_granted: true,
      status: "in_review",
    });
    const insertedId = new ObjectId();
    const voiceMessage = "data:audio/webm;codecs=opus;base64,AAAA";
    const voiceDurationMs = 12_000;
    dbMock.complaintMessagesInsertOne.mockResolvedValue({
      insertedId,
    });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(
      makeRequest({
        voiceMessage,
        voiceDurationMs,
      }),
      { params: Promise.resolve({ id: complaintId.toString() }) },
    );

    expect(res.status).toBe(201);
    expect(dbMock.complaintMessagesInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "",
        attachments: [],
        voiceMessage,
        voiceDurationMs,
        message_type: "VOICE",
      }),
    );
  });

  it("rejects message with no content and no attachments", async () => {
    const res = await POST(
      makeRequest({ content: "   ", attachments: [] }),
      { params: Promise.resolve({ id: complaintId.toString() }) },
    );

    expect(res.status).toBe(400);
  });
});
