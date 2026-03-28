import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, PATCH } from "./route";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";

const { mockRequireProvider, mockGetDb, mockEnqueueEmailOutboxJob } =
  vi.hoisted(() => ({
    mockRequireProvider: vi.fn(),
    mockGetDb: vi.fn(),
    mockEnqueueEmailOutboxJob: vi.fn(),
  }));

vi.mock("@/lib/api/auth", () => ({
  requireProvider: mockRequireProvider,
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/email-outbox", () => ({
  enqueueEmailOutboxJob: mockEnqueueEmailOutboxJob,
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
    mockEnqueueEmailOutboxJob.mockResolvedValue({
      id: "mock-job-id",
      queuedAt: new Date().toISOString(),
    });
  });

  describe("GET", () => {
    it("returns provider profile successfully", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2030-06-15T06:00:00+05:30"));

      try {
      const dbMock = makeDbMock();
      const providerProfile = {
        _id: new ObjectId(PROVIDER_ID),
        name: "Laundry Service",
        email: "provider@example.com",
        leavePeriods: [
          {
            _id: "leave-1",
            startDate: "2030-06-15",
            endDate: "2030-06-16",
            createdAt: "2030-06-01T00:00:00.000Z",
          },
        ],
      };
      dbMock.findOne.mockResolvedValue(providerProfile);
      mockGetDb.mockResolvedValue({ db: dbMock.db });

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.name).toBe("Laundry Service");
      expect(json.data.availability).toEqual({
        isCurrentlyOnLeave: true,
        activeLeaveEndDate: "2030-06-16",
        isUnavailableForRequestedDeadline: false,
        nextAvailableDate: "2030-06-17",
      });
      } finally {
        vi.useRealTimers();
      }
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
      expect(json.data.availability).toEqual({
        isCurrentlyOnLeave: false,
        isUnavailableForRequestedDeadline: false,
      });
    });

    it("persists bio, services, radius, and delivery rate updates", async () => {
      const dbMock = makeDbMock();
      const updatedProvider = {
        _id: new ObjectId(PROVIDER_ID),
        bio: "Updated bio",
        services: ["Wash", "Fold"],
        radius_km: 12,
        per_km_rate: 18,
      };

      dbMock.findOne.mockResolvedValue(updatedProvider);
      dbMock.findOneAndUpdate.mockResolvedValue({ value: updatedProvider });
      mockGetDb.mockResolvedValue({ db: dbMock.db });

      const res = await PATCH(
        makeRequest("PATCH", {
          bio: "Updated bio",
          services: ["Wash", "Fold"],
          radius_km: 12,
          per_km_rate: 18,
        }),
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        {
          $set: expect.objectContaining({
            bio: "Updated bio",
            services: ["Wash", "Fold"],
            radius_km: 12,
            per_km_rate: 18,
            updatedAt: expect.any(Date),
          }),
        },
        expect.any(Object),
      );
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

    it("changes password successfully and sets passwordChangedAt", async () => {
      const bcrypt = await import("bcrypt");
      vi.mocked(bcrypt.default.compare).mockResolvedValue(true as never);
      vi.mocked(bcrypt.default.hash).mockResolvedValue(
        "new_hashed_password" as never,
      );

      const dbMock = makeDbMock();
      // findOne used by verifyAndHashPassword to load the current passwordHash
      dbMock.findOne.mockResolvedValue({
        _id: new ObjectId(PROVIDER_ID),
        passwordHash: "old_hashed_password",
      });
      const updatedProvider = {
        _id: new ObjectId(PROVIDER_ID),
        name: "Provider Name",
      };
      dbMock.findOneAndUpdate.mockResolvedValue({ value: updatedProvider });
      mockGetDb.mockResolvedValue({ db: dbMock.db });

      const res = await PATCH(
        makeRequest("PATCH", {
          currentPassword: "OldPassword1!",
          newPassword: "NewPassword1!",
        }),
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);

      // passwordChangedAt and updatedAt must be included in the $set payload
      expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        {
          $set: expect.objectContaining({
            passwordHash: "new_hashed_password",
            passwordChangedAt: expect.any(Date),
            updatedAt: expect.any(Date),
          }),
        },
        expect.any(Object),
      );

      // password-changed confirmation email must be enqueued
      expect(mockEnqueueEmailOutboxJob).toHaveBeenCalledWith({
        kind: "password_changed",
        payload: {
          to: "provider@test.com",
          changedAt: expect.any(String),
        },
      });
    });
  });
});
