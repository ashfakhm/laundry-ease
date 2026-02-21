import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const { mockGetDb, mockRequireAuth, mockCanAccess } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockRequireAuth: vi.fn(),
  mockCanAccess: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({ getDb: mockGetDb }));
vi.mock("@/lib/api/auth", () => ({ requireAuth: mockRequireAuth }));
vi.mock("@/lib/complaints/access", () => ({
  canAccessComplaintConversation: mockCanAccess,
}));
vi.mock("@/lib/payouts/amounts", () => ({
  derivePayoutAmounts: vi.fn().mockReturnValue({
    providerPayoutAmountPaise: 80000,
    platformCommissionPaise: 20000,
  }),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from "./route";

const complaintId = new ObjectId();
const seekerId = new ObjectId();
const providerId = new ObjectId();

function makeReq() {
  return new Request(`https://laundryease.test/api/complaints/${complaintId}`);
}

describe("GET /api/complaints/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: { id: seekerId.toString(), role: "seeker" },
    });
    mockCanAccess.mockReturnValue({ allowed: true });
    const mockFindOne = vi
      .fn()
      .mockResolvedValueOnce({
        _id: complaintId,
        seeker_id: seekerId,
        provider_id: providerId,
        status: "open",
      })
      .mockResolvedValueOnce({ name: "Test Seeker" })
      .mockResolvedValueOnce({
        name: "Test Provider",
        businessName: "CleanCo",
      });
    mockGetDb.mockResolvedValue({
      db: { collection: () => ({ findOne: mockFindOne }) },
    });
  });

  it("returns 400 for invalid complaint ID", async () => {
    const req = new Request("https://laundryease.test/api/complaints/bad-id");
    const res = await GET(req, { params: Promise.resolve({ id: "bad-id" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when complaint not found", async () => {
    mockGetDb.mockResolvedValue({
      db: { collection: () => ({ findOne: vi.fn().mockResolvedValue(null) }) },
    });
    const res = await GET(makeReq(), {
      params: Promise.resolve({ id: complaintId.toString() }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when access is denied", async () => {
    mockCanAccess.mockReturnValue({ allowed: false });
    const res = await GET(makeReq(), {
      params: Promise.resolve({ id: complaintId.toString() }),
    });
    expect(res.status).toBe(403);
  });

  it("returns complaint details on success", async () => {
    const res = await GET(makeReq(), {
      params: Promise.resolve({ id: complaintId.toString() }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.seeker.name).toBe("Test Seeker");
    expect(body.provider.name).toBe("Test Provider");
  });
});
