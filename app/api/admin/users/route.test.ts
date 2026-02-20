import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";
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

import { GET } from "./route";

function makeDbMock() {
  const seekersToArray = vi.fn();
  const providersToArray = vi.fn();
  const seekersFind = vi.fn(() => ({ toArray: seekersToArray }));
  const providersFind = vi.fn(() => ({ toArray: providersToArray }));

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "seekers") {
        return { find: seekersFind };
      }
      if (name === "providers") {
        return { find: providersFind };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return {
    db,
    seekersFind,
    providersFind,
    seekersToArray,
    providersToArray,
  };
}

describe("GET /api/admin/users", () => {
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

  it("returns merged and role-tagged users sorted by createdAt desc", async () => {
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    dbMock.seekersToArray.mockResolvedValue([
      {
        _id: new ObjectId(),
        name: "Seeker Old",
        email: "seeker.old@test.com",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        _id: new ObjectId(),
        name: "Seeker New",
        email: "seeker.new@test.com",
        createdAt: "2026-03-01T00:00:00.000Z",
      },
    ]);
    dbMock.providersToArray.mockResolvedValue([
      {
        _id: new ObjectId(),
        name: "Provider Mid",
        email: "provider@test.com",
        businessName: "Provider Mid Laundry",
        createdAt: "2026-02-01T00:00:00.000Z",
      },
    ]);

    const res = await GET(new Request("http://localhost"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(3);
    expect(body[0].name).toBe("Seeker New");
    expect(body[0].role).toBe(Role.SEEKER);
    expect(body[1].name).toBe("Provider Mid");
    expect(body[1].role).toBe(Role.PROVIDER);
    expect(body[2].name).toBe("Seeker Old");
    expect(body[2].role).toBe(Role.SEEKER);
  });

  it("maps AppError to expected status and payload", async () => {
    mockRequireAdminWithDbCheck.mockRejectedValue(
      new AppError(ErrorCode.FORBIDDEN, 403, "Admin access required"),
    );

    const res = await GET(new Request("http://localhost"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Admin access required");
  });
});
