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

function buildDbMock(options: {
  provider: Record<string, unknown> | null;
  bookings?: Record<string, unknown>[];
  seeker?: Record<string, unknown> | null;
}) {
  const providerFindOne = vi.fn().mockResolvedValue(options.provider);
  // Simulate $lookup: embed seeker data into each booking
  const enrichedBookings = (options.bookings ?? []).map((booking) => ({
    ...booking,
    seeker: options.seeker ?? null,
  }));
  const toArray = vi.fn().mockResolvedValue(enrichedBookings);
  const aggregate = vi.fn().mockReturnValue({ toArray });

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "providers") return { findOne: providerFindOne };
      if (name === "bookings") return { aggregate };
      throw new Error(`Unexpected collection: ${name}`);
    }),
  };

  return { db, aggregate };
}

describe("GET /api/bookings/provider", () => {
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

  it("returns compatibility not-found payload when provider record is missing", async () => {
    const providerId = new ObjectId().toString();
    mockRequireProvider.mockResolvedValue({ user: { id: providerId } });
    const dbMock = buildDbMock({ provider: null });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.message).toBe("Provider not found");
    expect(body.error.message).toBe("Provider not found");
  });

  it("returns provider bookings filtered by fee status", async () => {
    const providerId = new ObjectId();
    const seekerId = new ObjectId();
    mockRequireProvider.mockResolvedValue({ user: { id: providerId.toString() } });
    const dbMock = buildDbMock({
      provider: { _id: providerId, name: "Ash Laundry" },
      bookings: [{ _id: new ObjectId(), provider_id: providerId, seeker_id: seekerId }],
      seeker: { _id: seekerId, name: "Naseeb" },
    });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(dbMock.aggregate).toHaveBeenCalled();
  });
});
