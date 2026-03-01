import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { AppError, ErrorCode } from "@/lib/api/errors";

const { mockRequireAdminWithDbCheck, mockGetDb } = vi.hoisted(() => ({
  mockRequireAdminWithDbCheck: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireAdminWithDbCheck: mockRequireAdminWithDbCheck,
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/api/security", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/security")>();
  return {
    ...actual,
    enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  };
});

import { GET } from "./route";

function makeDbMock() {
  const toArray = vi.fn();
  const aggregate = vi.fn(() => ({ toArray }));
  const db = {
    collection: vi.fn((name: string) => {
      if (name === "complaints") {
        return { aggregate };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return { db, aggregate, toArray };
}

describe("GET /api/admin/complaints", () => {
  beforeEach(() => {
    mockRequireAdminWithDbCheck.mockResolvedValue({
      user: {
        id: new ObjectId().toString(),
        email: "admin@laundryease.test",
        role: "admin",
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns normalized complaint ids in response", async () => {
    const complaintId = new ObjectId();
    const seekerId = new ObjectId();
    const providerId = new ObjectId();
    const orderId = new ObjectId();
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    dbMock.toArray.mockResolvedValue([
      {
        _id: complaintId,
        seeker_id: seekerId,
        provider_id: providerId,
        order_id: orderId,
        status: "open",
      },
    ]);

    const res = await GET(new Request("http://localhost"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([
      {
        _id: complaintId.toString(),
        seeker_id: seekerId.toString(),
        provider_id: providerId.toString(),
        order_id: orderId.toString(),
        status: "open",
      },
    ]);
    expect(dbMock.aggregate).toHaveBeenCalledOnce();
  });

  it("maps AppError to expected status and payload", async () => {
    mockRequireAdminWithDbCheck.mockRejectedValue(
      new AppError(ErrorCode.FORBIDDEN, 403, "Admin access required"),
    );

    const res = await GET(new Request("http://localhost"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.message).toBe("Admin access required");
  });
});
