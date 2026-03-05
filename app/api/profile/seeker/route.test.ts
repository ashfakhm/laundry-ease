import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "./route";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";

const { mockRequireSeeker, mockGetDb, mockEnqueueEmailOutboxJob } = vi.hoisted(
  () => ({
    mockRequireSeeker: vi.fn(),
    mockGetDb: vi.fn(),
    mockEnqueueEmailOutboxJob: vi.fn(),
  }),
);

vi.mock("@/lib/api/auth", () => ({
  requireSeeker: mockRequireSeeker,
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/email-outbox", () => ({
  enqueueEmailOutboxJob: mockEnqueueEmailOutboxJob,
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
    warn: vi.fn(),
  },
}));

const SEEKER_ID = "507f1f77bcf86cd799439011";

function makeRequest(method: "GET" | "PUT", body?: unknown) {
  return new Request("https://laundryease.test/api/profile/seeker", {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeDbMock() {
  const findOne = vi.fn();
  const updateOne = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "seekers") {
        return {
          findOne,
          updateOne,
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return {
    db,
    findOne,
    updateOne,
  };
}

describe("seeker profile route", () => {
  beforeEach(() => {
    mockRequireSeeker.mockResolvedValue({
      user: { id: SEEKER_ID, role: Role.SEEKER, email: "seeker@test.com" },
    });
    mockGetDb.mockReset();
    vi.clearAllMocks();
    mockEnqueueEmailOutboxJob.mockResolvedValue({
      id: "mock-job-id",
      queuedAt: new Date().toISOString(),
    });
  });

  describe("GET", () => {
    it("returns seeker profile successfully", async () => {
      const dbMock = makeDbMock();
      const seekerProfile = {
        _id: new ObjectId(SEEKER_ID),
        name: "John Doe",
        email: "john@example.com",
      };
      dbMock.findOne.mockResolvedValue(seekerProfile);
      mockGetDb.mockResolvedValue({ db: dbMock.db });

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.name).toBe("John Doe");
      expect(dbMock.findOne).toHaveBeenCalledWith(
        { _id: new ObjectId(SEEKER_ID) },
        { projection: { passwordHash: 0 } },
      );
    });

    it("returns 404 when seeker not found", async () => {
      const dbMock = makeDbMock();
      dbMock.findOne.mockResolvedValue(null);
      mockGetDb.mockResolvedValue({ db: dbMock.db });

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.message).toBe("Seeker not found");
    });
  });

  describe("PUT", () => {
    it("updates non-sensitive fields successfully", async () => {
      const dbMock = makeDbMock();
      dbMock.updateOne.mockResolvedValue({ matchedCount: 1 });
      mockGetDb.mockResolvedValue({ db: dbMock.db });

      const res = await PUT(
        makeRequest("PUT", {
          name: "New Name",
          phone: "+1234567890",
        }),
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.message).toBe("Profile updated successfully");
      expect(dbMock.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        {
          $set: expect.objectContaining({
            name: "New Name",
            phone: "+1234567890",
            updatedAt: expect.any(Date),
          }),
        },
      );
    });

    it("returns 400 for invalid data", async () => {
      const res = await PUT(
        makeRequest("PUT", {
          phone: "invalid_phone",
        }),
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.message).toBe("Invalid data");
      expect(json.error.details.phone).toBeDefined();
    });

    it("requires current password to set new password", async () => {
      // Validation passes (newPassword is valid format), so it hits DB to check logic
      // We need to mock DB here
      const dbMock = makeDbMock();
      mockGetDb.mockResolvedValue({ db: dbMock.db });

      const res = await PUT(
        makeRequest("PUT", {
          newPassword: "NewStrongPassword1!",
        }),
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.message).toBe(
        "Current password is required to set a new password",
      );
    });

    it("changes password successfully and sets passwordChangedAt", async () => {
      const bcrypt = await import("bcrypt");
      vi.mocked(bcrypt.default.compare).mockResolvedValue(true as never);
      vi.mocked(bcrypt.default.hash).mockResolvedValue(
        "new_hashed_password" as never,
      );

      const dbMock = makeDbMock();
      dbMock.findOne.mockResolvedValue({
        _id: new ObjectId(SEEKER_ID),
        passwordHash: "old_hashed_password",
      });
      dbMock.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
      mockGetDb.mockResolvedValue({ db: dbMock.db });

      const res = await PUT(
        makeRequest("PUT", {
          currentPassword: "OldPassword1!",
          newPassword: "NewPassword1!",
        }),
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.message).toBe("Profile updated successfully");

      // passwordChangedAt and updatedAt must be set in the $set payload
      expect(dbMock.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        {
          $set: expect.objectContaining({
            passwordHash: "new_hashed_password",
            passwordChangedAt: expect.any(Date),
            updatedAt: expect.any(Date),
          }),
        },
      );

      // password-changed confirmation email must be enqueued
      expect(mockEnqueueEmailOutboxJob).toHaveBeenCalledWith({
        kind: "password_changed",
        payload: {
          to: "seeker@test.com",
          changedAt: expect.any(String),
        },
      });
    });

    it("verifies weak password", async () => {
      const res = await PUT(
        makeRequest("PUT", {
          currentPassword: "oldPassword",
          newPassword: "weak",
        }),
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.message).toBe("Invalid data");
      // Check details for specific error
      const details = json.error.details;
      expect(JSON.stringify(details)).toContain(">=8 characters");
    });
  });
});
