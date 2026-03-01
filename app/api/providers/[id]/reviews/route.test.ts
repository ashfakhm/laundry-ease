import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const { mockGetDb } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GET } from "./route";

function buildDbMock(reviews: Array<Record<string, unknown>>) {
  const toArray = vi.fn().mockResolvedValue(reviews);
  const limit = vi.fn(() => ({ toArray }));
  const sort = vi.fn(() => ({ limit }));
  const find = vi.fn(() => ({ sort }));

  return {
    db: {
      collection: vi.fn(() => ({ find })),
    },
    find,
    sort,
    limit,
    toArray,
  };
}

describe("GET /api/providers/[id]/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid provider id", async () => {
    const res = await GET(new Request("https://laundryease.test"), {
      params: Promise.resolve({ id: "bad-id" }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.message).toBe("Invalid provider ID");
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it("returns provider reviews sorted by latest", async () => {
    const providerId = new ObjectId();
    const dbMock = buildDbMock([
      { _id: new ObjectId(), rating: 5, comment: "Great" },
      { _id: new ObjectId(), rating: 4, comment: "Good" },
    ]);
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await GET(new Request("https://laundryease.test"), {
      params: Promise.resolve({ id: providerId.toString() }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(dbMock.find).toHaveBeenCalledWith({ provider_id: providerId });
    expect(dbMock.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(dbMock.limit).toHaveBeenCalledWith(50);
  });
});
