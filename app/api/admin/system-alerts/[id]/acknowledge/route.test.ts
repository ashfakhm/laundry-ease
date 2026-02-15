import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";

const {
  mockGetServerSession,
  mockGetDb,
  mockGetUserByEmail,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockGetDb: vi.fn(),
  mockGetUserByEmail: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({
  authOptions: {},
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/db/index", () => ({
  getUserByEmail: mockGetUserByEmail,
}));

vi.mock("@/lib/api/security", () => ({
  requireSameOrigin: mockRequireSameOrigin,
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mockLoggerError,
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { PATCH } from "./route";

function makeDbMock() {
  const systemAlertsFindOne = vi.fn();
  const systemAlertsUpdateOne = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "system_alerts") {
        return {
          findOne: systemAlertsFindOne,
          updateOne: systemAlertsUpdateOne,
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return {
    db,
    systemAlertsFindOne,
    systemAlertsUpdateOne,
  };
}

function makeRequest(body?: unknown) {
  return new Request(
    "https://laundryease.test/api/admin/system-alerts/123/acknowledge",
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        origin: "https://laundryease.test",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    },
  );
}

describe("PATCH /api/admin/system-alerts/[id]/acknowledge", () => {
  beforeEach(() => {
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 60,
      remaining: 59,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockGetServerSession.mockResolvedValue({
      user: {
        id: "admin_1",
        email: "admin@laundryease.test",
        role: Role.ADMIN,
      },
    });
    mockGetUserByEmail.mockResolvedValue({
      _id: new ObjectId(),
      email: "admin@laundryease.test",
      role: Role.ADMIN,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await PATCH(makeRequest({}), {
      params: Promise.resolve({ id: new ObjectId().toString() }),
    });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: "Unauthorized" });
  });

  it("returns 403 when user is not admin", async () => {
    mockGetUserByEmail.mockResolvedValue({
      _id: new ObjectId(),
      role: Role.SEEKER,
    });

    const res = await PATCH(makeRequest({}), {
      params: Promise.resolve({ id: new ObjectId().toString() }),
    });

    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid alert id", async () => {
    const res = await PATCH(makeRequest({}), {
      params: Promise.resolve({ id: "bad-id" }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 404 when alert does not exist", async () => {
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    dbMock.systemAlertsFindOne.mockResolvedValue(null);

    const res = await PATCH(makeRequest({}), {
      params: Promise.resolve({ id: new ObjectId().toString() }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 409 when alert is not open", async () => {
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    dbMock.systemAlertsFindOne.mockResolvedValue({
      _id: new ObjectId(),
      status: "resolved",
    });

    const res = await PATCH(makeRequest({}), {
      params: Promise.resolve({ id: new ObjectId().toString() }),
    });

    expect(res.status).toBe(409);
  });

  it("acknowledges open alert and stores ownership metadata", async () => {
    const alertId = new ObjectId();
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    dbMock.systemAlertsFindOne.mockResolvedValue({
      _id: alertId,
      status: "open",
      severity: "critical",
      ownership: {},
    });
    dbMock.systemAlertsUpdateOne.mockResolvedValue({ modifiedCount: 1 });

    const res = await PATCH(
      makeRequest({
        owner: "tech_lead",
        note: "On-call has taken ownership",
      }),
      {
        params: Promise.resolve({ id: alertId.toString() }),
      },
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(
      expect.objectContaining({
        success: true,
        alertId: alertId.toString(),
        owner: "tech_lead",
        note: "On-call has taken ownership",
      }),
    );

    expect(dbMock.systemAlertsUpdateOne).toHaveBeenCalledWith(
      { _id: alertId },
      expect.objectContaining({
        $set: expect.objectContaining({
          "ownership.acknowledgedByEmail": "admin@laundryease.test",
          "ownership.owner": "tech_lead",
          "ownership.note": "On-call has taken ownership",
        }),
      }),
    );
  });
});
