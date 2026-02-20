import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const { mockGetDb, mockRequireSeeker } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockRequireSeeker: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({ getDb: mockGetDb }));
vi.mock("@/lib/api/auth", () => ({ requireSeeker: mockRequireSeeker }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from "./route";

const seekerId = new ObjectId();

describe("GET /api/bookings/seeker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSeeker.mockResolvedValue({
      user: { id: seekerId.toString(), role: "seeker" },
    });
    const mockToArray = vi.fn().mockResolvedValue([
      {
        _id: new ObjectId(),
        status: "pending",
        provider: { name: "CleanCo" },
      },
    ]);
    const mockSort = vi.fn().mockReturnValue({ toArray: mockToArray });
    const _mockUnwind = vi.fn().mockReturnValue({ sort: mockSort });
    const _mockLookup = vi.fn().mockReturnValue({ unwind: _mockUnwind });
    mockGetDb.mockResolvedValue({
      db: {
        collection: () => ({
          aggregate: vi.fn().mockReturnValue({
            toArray: mockToArray,
          }),
        }),
      },
    });
  });

  it("returns seeker bookings", async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
  });

  it("returns 401-level error for invalid user id", async () => {
    mockRequireSeeker.mockResolvedValue({
      user: { id: "not-valid", role: "seeker" },
    });
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
