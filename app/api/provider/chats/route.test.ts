import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const { mockGetDb, mockRequireProvider } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockRequireProvider: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/api/auth", () => ({
  requireProvider: mockRequireProvider,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GET } from "./route";

describe("GET /api/provider/chats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns compatibility unauthorized payload for invalid provider id", async () => {
    mockRequireProvider.mockResolvedValue({ user: { id: "invalid-id" } });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.message).toBe("Unauthorized");
    expect(body.error.message).toBe("Unauthorized");
  });

  it("returns mapped chat summaries for provider", async () => {
    const providerId = new ObjectId();
    const senderId = new ObjectId();
    const bookingId = new ObjectId();
    const createdAt = new Date("2026-02-19T12:00:00.000Z");

    mockRequireProvider.mockResolvedValue({ user: { id: providerId.toString() } });

    const chatsToArray = vi.fn().mockResolvedValue([
      {
        _id: bookingId,
        booking_status: "confirmed",
        createdAt,
        seeker: { name: "Naseeb", email: "naseeb@example.com" },
        order: { process_status: "washing" },
        lastMessage: {
          message: "On the way",
          sender_id: senderId,
          createdAt,
        },
        messageCount: 2,
      },
    ]);
    const aggregate = vi.fn().mockReturnValue({ toArray: chatsToArray });
    const db = {
      collection: vi.fn(() => ({
        aggregate,
      })),
    };
    mockGetDb.mockResolvedValue({ db });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0]).toMatchObject({
      status: "washing",
      messageCount: 2,
    });
    expect(body.data[0].lastMessage.sender).toBe(senderId.toString());
    expect(aggregate).toHaveBeenCalledOnce();
  });
});
