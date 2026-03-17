import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { NextRequest } from "next/server";
import { Role } from "@/types/enums";

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
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { PATCH } from "./route";

function makeDbMock() {
  const updateOne = vi.fn();
  const db = {
    collection: vi.fn(() => ({
      updateOne,
    })),
  };
  return { db, updateOne };
}

function makeRequest(body: unknown) {
  return new NextRequest("https://laundryease.test/api/admin/users/123/unban", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/users/[id]/unban", () => {
  beforeEach(() => {
    mockRequireAdminWithDbCheck.mockResolvedValue({
      user: {
        id: new ObjectId().toString(),
        role: Role.ADMIN,
        email: "admin@laundryease.test",
      },
    });
    mockGetDb.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid id", async () => {
    const res = await PATCH(
      makeRequest({
        role: Role.SEEKER,
      }),
      {
        params: Promise.resolve({ id: "bad-id" }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid role", async () => {
    const res = await PATCH(
      makeRequest({
        role: "admin",
      }),
      {
        params: Promise.resolve({ id: new ObjectId().toString() }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 and unsets blocked fields", async () => {
    const userId = new ObjectId().toString();

    const dbMock = makeDbMock();
    dbMock.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await PATCH(
      makeRequest({
        role: Role.PROVIDER,
      }),
      {
        params: Promise.resolve({ id: userId }),
      },
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(dbMock.db.collection).toHaveBeenCalledWith("providers");
    expect(dbMock.updateOne).toHaveBeenCalledWith(
      { _id: expect.any(ObjectId) },
      {
        $unset: {
          blocked_until: "",
          blocked_reason: "",
        },
      },
    );
  });
});
