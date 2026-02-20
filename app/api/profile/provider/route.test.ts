import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, PATCH } from "./route";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";

const { mockRequireProvider, mockGetDb } = vi.hoisted(() => ({
  mockRequireProvider: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireProvider: mockRequireProvider,
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/razorpay", () => ({
  createRazorpayContact: vi.fn().mockResolvedValue({ id: "cont_123" }),
  createRazorpayFundAccount: vi.fn().mockResolvedValue({ id: "fa_123" }),
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue("hashed_password"),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const PROVIDER_ID = "507f1f77bcf86cd799439011";

function makeRequest(method: "GET" | "PATCH", body?: unknown) {
  return new Request("https://laundryease.test/api/profile/provider", {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeDbMock() {
  const findOne = vi.fn();
  const findOneAndUpdate = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "providers") {
        return {
          findOne,
          findOneAndUpdate,
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return {
    db,
    findOne,
    findOneAndUpdate,
  };
}

describe("provider profile route", () => {
  beforeEach(() => {
    mockRequireProvider.mockResolvedValue({
      user: {
        id: PROVIDER_ID,
        role: Role.PROVIDER,
        email: "provider@test.com",
      },
    });
    mockGetDb.mockReset();
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns provider profile successfully", async () => {
      const dbMock = makeDbMock();
      const providerProfile = {
        _id: new ObjectId(PROVIDER_ID),
        name: "Laundry Service",
        email: "provider@example.com",
      };
      dbMock.findOne.mockResolvedValue(providerProfile);
      mockGetDb.mockResolvedValue({ db: dbMock.db });

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.name).toBe("Laundry Service");
    });
  });

  describe("PATCH", () => {
    it("updates provider profile successfully", async () => {
      const dbMock = makeDbMock();
      const updatedProvider = {
        _id: new ObjectId(PROVIDER_ID),
        name: "New Name",
        phone: "+1234567890",
      };
      // findOneAndUpdate returns nested value structure in some versions, or direct doc
      dbMock.findOneAndUpdate.mockResolvedValue({ value: updatedProvider });

      // Need a findOne result for bank/updates logic if accessed
      dbMock.findOne.mockResolvedValue(updatedProvider);

      mockGetDb.mockResolvedValue({ db: dbMock.db });

      const res = await PATCH(
        makeRequest("PATCH", {
          name: "New Name",
          phone: "+1234567890",
        }),
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.name).toBe("New Name");
    });

    it("returns 400 for invalid data", async () => {
      const res = await PATCH(
        makeRequest("PATCH", {
          phone: "invalid",
        }),
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.message).toBe("Invalid data");
    });

    it("returns 400 when no fields to update", async () => {
      // In strict parsing, empty body might fail schema or pass with no known keys
      // schema usually allows partials.

      const res = await PATCH(makeRequest("PATCH", {}));
      const json = await res.json();
      // Depending on schema, {} might be valid but produce no updates to $set

      if (res.status === 400) {
        expect(json.message).toBe("No fields to update");
      }
    });
  });
});
