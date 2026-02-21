import type { Collection } from "mongodb";
import { AppError, ErrorCode, Errors } from "./errors";
import { logger } from "../logger";
import {
  collectAllowedOriginsFromRequest,
  extractRequestOrigin,
  isUnsafeHttpMethod,
} from "../security/origin";

const RATE_LIMIT_COLLECTION = "api_rate_limits";
const RATE_LIMIT_GRACE_MS = 60_000;

declare global {
  var _apiRateLimitIndexInitPromise: Promise<void> | undefined;
}

type RateLimitDocument = {
  key: string;
  windowStart: Date;
  count: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type RateLimitOptions = {
  bucket: string;
  max: number;
  windowMs: number;
  identifier?: string;
};

export type RateLimitResult = {
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

export function extractClientIp(req: Request): string {
  // Trust strict proxy headers first
  const vercelForwarded = req.headers.get("x-vercel-forwarded-for");
  if (vercelForwarded) {
    const [first] = vercelForwarded
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean);
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  // Fallback to x-forwarded-for but recognize it is spoofable
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const [first] = forwarded
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean);
    if (first) return first;
  }

  return "127.0.0.1";
}

export function collectAllowedOrigins(req: Request): string[] {
  return collectAllowedOriginsFromRequest({
    requestUrl: req.url,
    headers: req.headers,
    envOrigins: [
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.NEXT_PUBLIC_BASE_URL,
      process.env.NEXTAUTH_URL,
    ],
  });
}

export function getRequestOrigin(req: Request): string | null {
  return extractRequestOrigin(req.headers);
}

export async function requireSameOrigin(req: Request): Promise<void> {
  if (!isUnsafeHttpMethod(req.method)) return;

  const requestOrigin = getRequestOrigin(req);
  const allowedOrigins = new Set(collectAllowedOrigins(req));

  if (requestOrigin) {
    if (!allowedOrigins.has(requestOrigin)) {
      throw Errors.forbidden("Invalid request origin");
    }
    return;
  }

  // Some clients can strip Origin/Referer even for same-origin requests.
  // Accept only explicit same-origin browser metadata as a strict fallback.
  const fetchSite = req.headers.get("sec-fetch-site")?.toLowerCase().trim();
  if (fetchSite === "same-origin") {
    return;
  }

  throw Errors.forbidden("Missing request origin");
}

function getWindowStart(nowMs: number, windowMs: number): Date {
  const windowStartMs = Math.floor(nowMs / windowMs) * windowMs;
  return new Date(windowStartMs);
}

async function ensureRateLimitIndexes(
  collection: Collection<RateLimitDocument>,
): Promise<void> {
  await collection.createIndex(
    { key: 1, windowStart: 1 },
    { unique: true, name: "api_rate_limits_key_window_unique" },
  );
  await collection.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: "api_rate_limits_expires_ttl" },
  );
}

async function getRateLimitCollection(): Promise<
  Collection<RateLimitDocument>
> {
  const { getDb } = await import("../mongodb");
  const { db } = await getDb();
  const collection = db.collection<RateLimitDocument>(RATE_LIMIT_COLLECTION);

  if (!global._apiRateLimitIndexInitPromise) {
    global._apiRateLimitIndexInitPromise = ensureRateLimitIndexes(
      collection,
    ).catch((error) => {
      logger.error(
        "RATE_LIMIT",
        "Failed to initialize rate-limit indexes. Continuing without hard failure.",
        error,
      );
    });
  }
  await global._apiRateLimitIndexInitPromise;

  return collection;
}

async function incrementCounter(
  collection: Collection<RateLimitDocument>,
  key: string,
  windowStart: Date,
  expiresAt: Date,
): Promise<RateLimitDocument | null> {
  try {
    return await collection.findOneAndUpdate(
      { key, windowStart },
      {
        $inc: { count: 1 },
        $set: {
          expiresAt,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          key,
          windowStart,
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      },
    );
  } catch (error) {
    const duplicateKey = (
      error as {
        code?: number;
      }
    )?.code;

    // Retry once for upsert races under burst traffic.
    if (duplicateKey === 11000) {
      return collection.findOneAndUpdate(
        { key, windowStart },
        {
          $inc: { count: 1 },
          $set: {
            expiresAt,
            updatedAt: new Date(),
          },
        },
        { returnDocument: "after" },
      );
    }

    throw error;
  }
}

export async function enforceRateLimit(
  req: Request,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const { bucket, max, windowMs, identifier } = options;

  if (!bucket || max < 1 || windowMs < 1_000) {
    throw Errors.internal("Invalid rate limit configuration");
  }

  const actor = identifier?.trim() || extractClientIp(req);
  const key = `${bucket}:${actor}`;

  const nowMs = Date.now();
  const windowStart = getWindowStart(nowMs, windowMs);
  const resetAt = new Date(windowStart.getTime() + windowMs);
  const expiresAt = new Date(resetAt.getTime() + RATE_LIMIT_GRACE_MS);

  const collection = await getRateLimitCollection();
  const doc = await incrementCounter(collection, key, windowStart, expiresAt);

  if (!doc) {
    throw Errors.internal("Rate limit check failed");
  }

  const remaining = Math.max(0, max - doc.count);
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((resetAt.getTime() - nowMs) / 1000),
  );

  if (doc.count > max) {
    logger.warn("RATE_LIMIT", "Rate limit exceeded", {
      bucket,
      actor,
      key,
      count: doc.count,
      max,
      resetAt: resetAt.toISOString(),
    });

    throw new AppError(
      ErrorCode.RATE_LIMITED,
      429,
      "Too many requests. Please try again shortly.",
      {
        bucket,
        retryAfterSeconds,
      },
    );
  }

  return {
    limit: max,
    remaining,
    resetAt,
    retryAfterSeconds,
  };
}
