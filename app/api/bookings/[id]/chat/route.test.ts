import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const {
  mockGetDb,
  mockRequireAuth,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
  mockEmitBookingMessageCreated,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockRequireAuth: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
  mockEmitBookingMessageCreated: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/api/auth", () => ({
  requireAuth: mockRequireAuth,
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
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/realtime/emitter", () => ({
  emitBookingMessageCreated: mockEmitBookingMessageCreated,
}));

import { GET, POST } from "./route";

describe("booking chat route contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue(undefined);
  });

  it("GET returns compatibility invalid-id payload", async () => {
    const req = new Request("https://laundryease.test/api/bookings/bad/chat");
    const res = await GET(req, { params: Promise.resolve({ id: "bad-id" }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toBe("Invalid booking id");
    expect(body.error.message).toBe("Invalid booking id");
  });

  it("POST returns compatibility success payload for a valid participant", async () => {
    const bookingId = new ObjectId();
    const seekerId = new ObjectId();
    const insertedId = new ObjectId();
    const insertOne = vi.fn().mockResolvedValue({ insertedId });
    const findOne = vi.fn().mockResolvedValue({
      _id: bookingId,
      seeker_id: seekerId,
      provider_id: new ObjectId(),
    });
    const db = {
      collection: vi.fn((name: string) => {
        if (name === "bookings") return { findOne };
        if (name === "chats") return { insertOne };
        throw new Error(`Unexpected collection: ${name}`);
      }),
    };
    mockGetDb.mockResolvedValue({ db });
    mockRequireAuth.mockResolvedValue({
      user: { id: seekerId.toString(), role: "seeker" },
    });

    const req = new Request(
      `https://laundryease.test/api/bookings/${bookingId.toString()}/chat`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://laundryease.test",
        },
        body: JSON.stringify({ message: "I am here" }),
      },
    );

    const res = await POST(req, {
      params: Promise.resolve({ id: bookingId.toString() }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.ok).toBe(true);
    expect(body.data).toMatchObject({
      _id: insertedId.toString(),
      booking_id: bookingId.toString(),
      sender_id: seekerId.toString(),
      sender_role: "seeker",
      message: "I am here",
    });
    expect(insertOne).toHaveBeenCalledOnce();
    expect(mockEmitBookingMessageCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: insertedId,
        booking_id: bookingId,
      }),
    );
  });
});
