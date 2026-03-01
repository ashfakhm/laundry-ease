import { errorResponse } from "@/lib/api/response";
import { RATE_LIMIT_DEFAULT_WINDOW_MS } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/api/security";

const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_ITEMS = 20;
const MAX_OBJECT_KEYS = 30;
const MAX_DEPTH = 4;

function trimString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_STRING_LENGTH)}…`;
}

function sanitizePayload(value: unknown, depth = 0): unknown {
  if (depth >= MAX_DEPTH) {
    return "[truncated]";
  }

  if (typeof value === "string") {
    return trimString(value);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((entry) => sanitizePayload(entry, depth + 1));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      MAX_OBJECT_KEYS,
    );

    return Object.fromEntries(
      entries.map(([key, entry]) => [key, sanitizePayload(entry, depth + 1)]),
    );
  }

  return String(value);
}

export async function POST(req: Request) {
  try {
    await enforceRateLimit(req, {
      bucket: "security:csp-report",
      max: 120,
      windowMs: RATE_LIMIT_DEFAULT_WINDOW_MS,
    });

    const raw = await req.json().catch(() => null);
    const body = raw && typeof raw === "object" ? raw : {};
    const report = (body as { "csp-report"?: unknown })["csp-report"] ?? body;

    logger.warn("SECURITY", "Received CSP violation report", {
      report: sanitizePayload(report),
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("SECURITY", "Failed to process CSP report", error);
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"),
    );
  }
}
