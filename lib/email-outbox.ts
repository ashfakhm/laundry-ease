import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import {
  sendDeliveryOtpEmailNow,
  type DeliveryOtpEmailPayload,
} from "@/lib/delivery-otp-email";
import {
  sendPasswordResetEmailNow,
  type PasswordResetEmailPayload,
} from "@/lib/password-reset-email";
import {
  sendMagicLinkEmailNow,
  type MagicLinkEmailPayload,
} from "@/lib/magic-link-email";
import {
  sendOtpCodeEmailNow,
  type OtpCodeEmailPayload,
} from "@/lib/otp-code-email";

export type EmailOutboxKind =
  | "delivery_otp"
  | "password_reset"
  | "magic_link"
  | "otp_email";

type EmailOutboxPayloadMap = {
  delivery_otp: DeliveryOtpEmailPayload;
  password_reset: PasswordResetEmailPayload;
  magic_link: MagicLinkEmailPayload;
  otp_email: OtpCodeEmailPayload;
};

export type EmailOutboxStatus = "pending" | "processing" | "sent" | "failed";

type EmailOutboxJobBase = {
  _id?: ObjectId;
  status: EmailOutboxStatus;
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

type DeliveryOtpOutboxJob = EmailOutboxJobBase & {
  kind: "delivery_otp";
  payload: DeliveryOtpEmailPayload;
};

type PasswordResetOutboxJob = EmailOutboxJobBase & {
  kind: "password_reset";
  payload: PasswordResetEmailPayload;
};

type MagicLinkOutboxJob = EmailOutboxJobBase & {
  kind: "magic_link";
  payload: MagicLinkEmailPayload;
};

type OtpEmailOutboxJob = EmailOutboxJobBase & {
  kind: "otp_email";
  payload: OtpCodeEmailPayload;
};

type EmailOutboxJob =
  | DeliveryOtpOutboxJob
  | PasswordResetOutboxJob
  | MagicLinkOutboxJob
  | OtpEmailOutboxJob;

export type EnqueueEmailOutboxInput<K extends EmailOutboxKind = EmailOutboxKind> = {
  kind: K;
  payload: EmailOutboxPayloadMap[K];
  maxAttempts?: number;
};

export type EmailOutboxProcessResult = {
  processed: number;
  sent: number;
  retried: number;
  failed: number;
  pendingReady: number;
};

const DEFAULT_BATCH_LIMIT = 25;
const MAX_BATCH_LIMIT = 200;
const DEFAULT_MAX_ATTEMPTS = 5;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const BASE_BACKOFF_MS = 30 * 1000;
const MAX_BACKOFF_MS = 30 * 60 * 1000;

function clampBatchLimit(limit?: number) {
  if (!Number.isFinite(limit) || !limit) {
    return DEFAULT_BATCH_LIMIT;
  }
  return Math.max(1, Math.min(MAX_BATCH_LIMIT, Math.floor(limit)));
}

function computeBackoffMs(attempt: number) {
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1), MAX_BACKOFF_MS);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function dispatchEmailJob(job: EmailOutboxJob) {
  if (job.kind === "delivery_otp") {
    await sendDeliveryOtpEmailNow(job.payload);
    return;
  }

  if (job.kind === "password_reset") {
    await sendPasswordResetEmailNow(job.payload);
    return;
  }

  if (job.kind === "magic_link") {
    await sendMagicLinkEmailNow(job.payload);
    return;
  }

  if (job.kind === "otp_email") {
    await sendOtpCodeEmailNow(job.payload);
    return;
  }

  throw new Error("Unsupported outbox email kind");
}

export async function enqueueEmailOutboxJob<K extends EmailOutboxKind>(
  input: EnqueueEmailOutboxInput<K>,
) {
  const { db } = await getDb();
  const now = new Date();
  const baseFields: EmailOutboxJobBase = {
    status: "pending",
    attempts: 0,
    maxAttempts: Math.max(1, Math.floor(input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)),
    nextAttemptAt: now,
    createdAt: now,
    updatedAt: now,
    lockedAt: null,
    lockedBy: null,
    lastError: null,
  };
  let doc: EmailOutboxJob;
  if (input.kind === "delivery_otp") {
    doc = {
      ...baseFields,
      kind: "delivery_otp",
      payload: input.payload as DeliveryOtpEmailPayload,
    };
  } else if (input.kind === "password_reset") {
    doc = {
      ...baseFields,
      kind: "password_reset",
      payload: input.payload as PasswordResetEmailPayload,
    };
  } else if (input.kind === "magic_link") {
    doc = {
      ...baseFields,
      kind: "magic_link",
      payload: input.payload as MagicLinkEmailPayload,
    };
  } else {
    doc = {
      ...baseFields,
      kind: "otp_email",
      payload: input.payload as OtpCodeEmailPayload,
    };
  }

  const result = await db.collection<EmailOutboxJob>("email_outbox").insertOne(doc);
  return {
    id: result.insertedId.toString(),
    queuedAt: now.toISOString(),
  };
}

export async function processEmailOutboxBatch(opts?: {
  limit?: number;
  workerId?: string;
}) {
  const limit = clampBatchLimit(opts?.limit);
  const workerId = opts?.workerId || "email-outbox-worker";
  const { db } = await getDb();
  const collection = db.collection<EmailOutboxJob>("email_outbox");

  let processed = 0;
  let sent = 0;
  let retried = 0;
  let failed = 0;

  for (let i = 0; i < limit; i++) {
    const now = new Date();
    const staleLockBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS);

    const claimedJob = await collection.findOneAndUpdate(
      {
        status: "pending",
        nextAttemptAt: { $lte: now },
        $or: [
          { lockedAt: { $exists: false } },
          { lockedAt: null },
          { lockedAt: { $lt: staleLockBefore } },
        ],
      },
      {
        $set: {
          status: "processing",
          lockedAt: now,
          lockedBy: workerId,
          updatedAt: now,
        },
      },
      {
        sort: { nextAttemptAt: 1, createdAt: 1 },
        returnDocument: "after",
      },
    );

    if (!claimedJob) break;

    processed += 1;

    try {
      await dispatchEmailJob(claimedJob);

      await collection.updateOne(
        { _id: claimedJob._id, status: "processing" },
        {
          $set: {
            status: "sent",
            sentAt: new Date(),
            updatedAt: new Date(),
            lockedAt: null,
            lockedBy: null,
            lastError: null,
          },
        },
      );
      sent += 1;
    } catch (error) {
      const attempt = claimedJob.attempts + 1;
      const willFailPermanently = attempt >= claimedJob.maxAttempts;
      const nowOnError = new Date();
      const nextAttemptAt = new Date(
        nowOnError.getTime() + computeBackoffMs(attempt),
      );

      await collection.updateOne(
        { _id: claimedJob._id, status: "processing" },
        {
          $set: {
            status: willFailPermanently ? "failed" : "pending",
            attempts: attempt,
            nextAttemptAt,
            updatedAt: nowOnError,
            lockedAt: null,
            lockedBy: null,
            lastError: getErrorMessage(error).slice(0, 500),
          },
        },
      );

      if (willFailPermanently) {
        failed += 1;
      } else {
        retried += 1;
      }

      logger.error("EMAIL_OUTBOX", "Email outbox dispatch failed", error, {
        jobId: claimedJob._id?.toString(),
        kind: claimedJob.kind,
        attempts: attempt,
        maxAttempts: claimedJob.maxAttempts,
        workerId,
        willFailPermanently,
      });
    }
  }

  const pendingReady = await collection.countDocuments({
    status: "pending",
    nextAttemptAt: { $lte: new Date() },
  });

  const result: EmailOutboxProcessResult = {
    processed,
    sent,
    retried,
    failed,
    pendingReady,
  };

  logger.info("EMAIL_OUTBOX", "Processed email outbox batch", {
    ...result,
    limit,
    workerId,
  });

  return result;
}
