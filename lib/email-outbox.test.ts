import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

type InMemoryEmailJob = {
  _id: ObjectId;
  kind: "delivery_otp" | "password_reset" | "magic_link";
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "sent" | "failed";
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  lockedAt?: Date | null;
  lockedBy?: string | null;
  lastError?: string | null;
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
};

const {
  mockGetDb,
  mockSendDeliveryOtpEmailNow,
  mockSendPasswordResetEmailNow,
  mockSendMagicLinkEmailNow,
  state,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockSendDeliveryOtpEmailNow: vi.fn(),
  mockSendPasswordResetEmailNow: vi.fn(),
  mockSendMagicLinkEmailNow: vi.fn(),
  state: {
    jobs: [] as InMemoryEmailJob[],
  },
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/delivery-otp-email", () => ({
  sendDeliveryOtpEmailNow: mockSendDeliveryOtpEmailNow,
}));

vi.mock("@/lib/password-reset-email", () => ({
  sendPasswordResetEmailNow: mockSendPasswordResetEmailNow,
}));

vi.mock("@/lib/magic-link-email", () => ({
  sendMagicLinkEmailNow: mockSendMagicLinkEmailNow,
}));

import { enqueueEmailOutboxJob, processEmailOutboxBatch } from "@/lib/email-outbox";

function makeDb() {
  return {
    collection(name: string) {
      if (name !== "email_outbox") {
        throw new Error(`Unexpected collection: ${name}`);
      }

      return {
        async insertOne(doc: Omit<InMemoryEmailJob, "_id">) {
          const inserted = { ...doc, _id: new ObjectId() };
          state.jobs.push(inserted);
          return { acknowledged: true, insertedId: inserted._id };
        },
        async findOneAndUpdate(
          filter: {
            status: "pending";
            nextAttemptAt: { $lte: Date };
            $or: Array<
              | { lockedAt: { $exists: false } }
              | { lockedAt: null }
              | { lockedAt: { $lt: Date } }
            >;
          },
          update: { $set: Partial<InMemoryEmailJob> },
        ) {
          const threshold = filter.nextAttemptAt.$lte.getTime();
          const staleLockMs = filter.$or[2] && "lockedAt" in filter.$or[2]
            ? (filter.$or[2].lockedAt as { $lt: Date }).$lt.getTime()
            : Number.MIN_SAFE_INTEGER;

          const candidates = state.jobs
            .filter((job) => {
              const lockTime = job.lockedAt ? job.lockedAt.getTime() : null;
              return (
                job.status === filter.status &&
                job.nextAttemptAt.getTime() <= threshold &&
                (job.lockedAt == null || (lockTime != null && lockTime < staleLockMs))
              );
            })
            .sort((a, b) => {
              const nextDiff =
                a.nextAttemptAt.getTime() - b.nextAttemptAt.getTime();
              if (nextDiff !== 0) return nextDiff;
              return a.createdAt.getTime() - b.createdAt.getTime();
            });

          const job = candidates[0];
          if (!job) return null;

          Object.assign(job, update.$set);
          return { ...job };
        },
        async updateOne(
          filter: Partial<InMemoryEmailJob>,
          update: { $set: Partial<InMemoryEmailJob> },
        ) {
          const target = state.jobs.find((job) => {
            if (filter._id && job._id.toString() !== String(filter._id)) {
              return false;
            }
            if (filter.status && job.status !== filter.status) return false;
            return true;
          });

          if (!target) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
          Object.assign(target, update.$set);
          return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
        },
        async countDocuments(filter: {
          status: "pending";
          nextAttemptAt: { $lte: Date };
        }) {
          return state.jobs.filter(
            (job) =>
              job.status === filter.status &&
              job.nextAttemptAt.getTime() <= filter.nextAttemptAt.$lte.getTime(),
          ).length;
        },
      };
    },
  };
}

describe("email outbox", () => {
  beforeEach(() => {
    state.jobs = [];
    vi.clearAllMocks();
    mockGetDb.mockResolvedValue({ db: makeDb() });
    mockSendDeliveryOtpEmailNow.mockResolvedValue(undefined);
    mockSendPasswordResetEmailNow.mockResolvedValue(undefined);
    mockSendMagicLinkEmailNow.mockResolvedValue(undefined);
  });

  it("enqueues pending email jobs", async () => {
    const result = await enqueueEmailOutboxJob({
      kind: "password_reset",
      payload: {
        to: "user@example.com",
        resetUrl: "https://laundryease.test/reset?token=abc",
      },
    });

    expect(result.id).toBeTruthy();
    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0].status).toBe("pending");
    expect(state.jobs[0].kind).toBe("password_reset");
  });

  it("processes pending jobs and marks them sent", async () => {
    await enqueueEmailOutboxJob({
      kind: "delivery_otp",
      payload: {
        to: "seeker@example.com",
        otp: "123456",
        orderId: "order_1",
      },
    });

    const result = await processEmailOutboxBatch({ limit: 10, workerId: "test" });

    expect(result.processed).toBe(1);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockSendDeliveryOtpEmailNow).toHaveBeenCalledOnce();
    expect(state.jobs[0].status).toBe("sent");
    expect(state.jobs[0].sentAt).toBeInstanceOf(Date);
  });

  it("retries and eventually fails when max attempts is reached", async () => {
    mockSendPasswordResetEmailNow.mockRejectedValue(new Error("SMTP down"));

    await enqueueEmailOutboxJob({
      kind: "password_reset",
      payload: {
        to: "user@example.com",
        resetUrl: "https://laundryease.test/reset?token=abc",
      },
      maxAttempts: 1,
    });

    const result = await processEmailOutboxBatch({ limit: 10, workerId: "test" });

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.retried).toBe(0);
    expect(state.jobs[0].status).toBe("failed");
    expect(state.jobs[0].attempts).toBe(1);
    expect(String(state.jobs[0].lastError)).toContain("SMTP down");
  });

  it("dispatches magic-link jobs", async () => {
    await enqueueEmailOutboxJob({
      kind: "magic_link",
      payload: {
        to: "user@example.com",
        verificationLink: "https://laundryease.test/verify-email?token=xyz",
      },
    });

    const result = await processEmailOutboxBatch({ limit: 10, workerId: "test" });

    expect(result.processed).toBe(1);
    expect(result.sent).toBe(1);
    expect(mockSendMagicLinkEmailNow).toHaveBeenCalledOnce();
    expect(state.jobs[0].kind).toBe("magic_link");
    expect(state.jobs[0].status).toBe("sent");
  });
});
