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
  orders?: Record<string, unknown>[];
  seeker?: Record<string, unknown> | null;
}) {
  const providerFindOne = vi.fn().mockResolvedValue(options.provider);
  // Simulate $lookup: embed seeker data into each order
  const enrichedOrders = (options.orders ?? []).map((order) => ({
    ...order,
    seeker: options.seeker ?? null,
  }));
  const toArray = vi.fn().mockResolvedValue(enrichedOrders);
  const aggregate = vi.fn().mockReturnValue({ toArray });

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "providers") return { findOne: providerFindOne };
      if (name === "orders") return { aggregate };
      throw new Error(`Unexpected collection: ${name}`);
    }),
  };

  return { db, providerFindOne, aggregate };
}

describe("GET /api/orders/provider", () => {
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

  it("returns provider orders with seeker data", async () => {
    const providerId = new ObjectId();
    const seekerId = new ObjectId();
    mockRequireProvider.mockResolvedValue({ user: { id: providerId.toString() } });

    const dbMock = buildDbMock({
      provider: { _id: providerId, name: "Laundry" },
      orders: [{ _id: new ObjectId(), provider_id: providerId, seeker_id: seekerId }],
      seeker: { _id: seekerId, name: "Naseeb" },
    });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].seeker?.name).toBe("Naseeb");
    expect(dbMock.aggregate).toHaveBeenCalled();
  });
});
