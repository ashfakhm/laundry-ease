import { Db } from "mongodb";
import { logger } from "./logger";
import { env } from "./env";

type IndexSpec = {
  collection: string;
  keys: Record<string, 1 | -1 | "text" | "2dsphere">;
  options?: Record<string, unknown>;
  critical?: boolean;
};

const INDEX_SPECS: IndexSpec[] = [
  // Hard integrity constraints
  {
    collection: "orders",
    keys: { booking_id: 1 },
    options: { name: "orders_booking_id_unique", unique: true },
    critical: true,
  },
  {
    collection: "orders",
    keys: { razorpay_order_id: 1 },
    options: {
      name: "orders_razorpay_order_id_unique",
      unique: true,
      partialFilterExpression: { razorpay_order_id: { $type: "string" } },
    },
    critical: true,
  },
  {
    collection: "orders",
    keys: { razorpay_payment_id: 1 },
    options: {
      name: "orders_razorpay_payment_id_unique",
      unique: true,
      partialFilterExpression: { razorpay_payment_id: { $type: "string" } },
    },
    critical: true,
  },
  {
    collection: "orders",
    keys: { payout_id: 1 },
    options: {
      name: "orders_payout_id_unique",
      unique: true,
      partialFilterExpression: { payout_id: { $type: "string" } },
    },
    critical: true,
  },
  {
    collection: "complaints",
    keys: { order_id: 1 },
    options: { name: "complaints_order_id_unique", unique: true },
    critical: true,
  },
  {
    collection: "bookings",
    keys: { razorpay_order_id: 1 },
    options: {
      name: "bookings_razorpay_order_id_unique",
      unique: true,
      partialFilterExpression: { razorpay_order_id: { $type: "string" } },
    },
    critical: true,
  },
  {
    collection: "bookings",
    keys: { razorpay_payment_id: 1 },
    options: {
      name: "bookings_razorpay_payment_id_unique",
      unique: true,
      partialFilterExpression: { razorpay_payment_id: { $type: "string" } },
    },
    critical: true,
  },
  {
    collection: "password_reset_tokens",
    keys: { tokenHash: 1 },
    options: { name: "password_reset_token_hash_unique", unique: true },
    critical: true,
  },
  {
    collection: "seekers",
    keys: { email: 1 },
    options: {
      name: "seekers_email_unique",
      unique: true,
      partialFilterExpression: { email: { $type: "string" } },
    },
    critical: true,
  },
  {
    collection: "providers",
    keys: { email: 1 },
    options: {
      name: "providers_email_unique",
      unique: true,
      partialFilterExpression: { email: { $type: "string" } },
    },
    critical: true,
  },
  {
    collection: "providers",
    keys: { locationGeoJSON: "2dsphere" },
    options: {
      name: "providers_location_geo_2dsphere",
      partialFilterExpression: { locationGeoJSON: { $exists: true } },
    },
  },
  {
    collection: "admins",
    keys: { email: 1 },
    options: {
      name: "admins_email_unique",
      unique: true,
      partialFilterExpression: { email: { $type: "string" } },
    },
    critical: true,
  },
  {
    collection: "webhook_events",
    keys: { event_id: 1 },
    options: { name: "webhook_event_id_unique", unique: true },
    critical: true,
  },
  {
    collection: "payments",
    keys: { razorpay_payment_id: 1 },
    options: {
      name: "payments_razorpay_payment_id_unique",
      unique: true,
      partialFilterExpression: { razorpay_payment_id: { $type: "string" } },
    },
    critical: true,
  },
  {
    collection: "refunds",
    keys: { razorpay_refund_id: 1 },
    options: {
      name: "refunds_razorpay_refund_id_unique",
      unique: true,
      partialFilterExpression: { razorpay_refund_id: { $type: "string" } },
    },
    critical: true,
  },

  // Admin Dashboard performance indexes
  {
    collection: "orders",
    keys: { payment_status: 1 },
    options: { name: "orders_payment_status" },
  },
  {
    collection: "system_alerts",
    keys: { status: 1, severity: 1 },
    options: { name: "system_alerts_status_severity" },
  },
  {
    collection: "complaints",
    keys: { status: 1 },
    options: { name: "complaints_status" },
  },

  // Query/performance indexes
  {
    collection: "orders",
    keys: { payment_status: 1, escrow_release_at: 1 },
    options: { name: "orders_payment_status_escrow_release" },
  },
  {
    collection: "system_alerts",
    keys: { status: 1, severity: 1, firstSeenAt: -1 },
    options: { name: "system_alerts_status_severity_firstSeenAt" },
  },
  {
    collection: "bookings",
    keys: { provider_id: 1, status: 1, createdAt: -1 },
    options: { name: "bookings_provider_status_createdAt" },
  },
  {
    collection: "bookings",
    keys: { seeker_id: 1, createdAt: -1 },
    options: { name: "bookings_seeker_createdAt" },
  },
  {
    collection: "orders",
    keys: { provider_id: 1, process_status: 1, createdAt: -1 },
    options: { name: "orders_provider_status_createdAt" },
  },
  {
    collection: "orders",
    keys: { seeker_id: 1, createdAt: -1 },
    options: { name: "orders_seeker_createdAt" },
  },
  {
    collection: "complaints",
    keys: { status: 1, response_deadline: 1 },
    options: { name: "complaints_status_deadline" },
  },
  {
    collection: "email_outbox",
    keys: { status: 1, nextAttemptAt: 1, createdAt: 1 },
    options: { name: "email_outbox_status_nextAttempt_createdAt" },
  },
  {
    collection: "email_outbox",
    keys: { status: 1, lockedAt: 1 },
    options: { name: "email_outbox_status_lockedAt" },
  },

  // TTL cleanup indexes
  {
    collection: "otp_codes",
    keys: { expiresAt: 1 },
    options: { name: "otp_codes_expire_ttl", expireAfterSeconds: 0 },
  },
  {
    collection: "password_reset_tokens",
    keys: { expiresAt: 1 },
    options: {
      name: "password_reset_tokens_expire_ttl",
      expireAfterSeconds: 0,
    },
  },
  {
    collection: "audit_logs",
    keys: { timestamp: 1 },
    options: {
      name: "audit_logs_expire_ttl",
      expireAfterSeconds: 30 * 24 * 60 * 60,
    }, // 30 days
  },
  {
    collection: "cron_runs",
    keys: { startedAt: 1 },
    options: {
      name: "cron_runs_expire_ttl",
      expireAfterSeconds: 7 * 24 * 60 * 60,
    }, // 7 days
  },
];

type IndexCreateResult = {
  ok: boolean;
  critical: boolean;
  indexName: string;
  collection: string;
  keys: Record<string, 1 | -1 | "text" | "2dsphere">;
  message?: string;
};

function isIndexFailFastEnabled(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    env.ALLOW_START_WITH_INDEX_ERRORS !== "1"
  );
}

async function createIndexSafe(
  db: Db,
  spec: IndexSpec,
): Promise<IndexCreateResult> {
  const indexName = String(spec.options?.name || "unnamed");
  try {
    await db.collection(spec.collection).createIndex(spec.keys, spec.options);
    return {
      ok: true,
      critical: Boolean(spec.critical),
      indexName,
      collection: spec.collection,
      keys: spec.keys,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    // Duplicate-key errors during index creation indicate existing bad historical data.
    // We keep the app running and log explicit remediation guidance.
    logger.error(
      "DB_INDEX",
      `Failed to create index ${indexName} on ${spec.collection}`,
      error,
      {
        collection: spec.collection,
        keys: spec.keys,
        message,
      },
    );
    return {
      ok: false,
      critical: Boolean(spec.critical),
      indexName,
      collection: spec.collection,
      keys: spec.keys,
      message,
    };
  }
}

export async function ensureDbIndexes(db: Db) {
  const failures: IndexCreateResult[] = [];
  for (const spec of INDEX_SPECS) {
    const result = await createIndexSafe(db, spec);
    if (!result.ok) failures.push(result);
  }

  const criticalFailures = failures.filter((result) => result.critical);
  if (criticalFailures.length > 0) {
    const failFast = isIndexFailFastEnabled();
    const indexList = criticalFailures
      .map((failure) => `${failure.collection}.${failure.indexName}`)
      .join(", ");

    const logPayload = {
      criticalFailedCount: criticalFailures.length,
      criticalIndexes: criticalFailures.map((failure) => ({
        collection: failure.collection,
        indexName: failure.indexName,
        message: failure.message,
      })),
      failFast,
    };

    if (failFast) {
      logger.error(
        "DB_INDEX",
        "Critical index initialization failed; refusing startup in production",
        undefined,
        logPayload,
      );
      throw new Error(
        `Critical database index initialization failed: ${indexList}. Resolve duplicate/incompatible data or set ALLOW_START_WITH_INDEX_ERRORS=1 to bypass.`,
      );
    }

    logger.warn(
      "DB_INDEX",
      "Critical index initialization failed; continuing startup because fail-fast is disabled",
      logPayload,
    );
  }

  logger.info("DB_INDEX", "Database index initialization completed", {
    totalIndexesAttempted: INDEX_SPECS.length,
    failedIndexes: failures.length,
    criticalFailedIndexes: criticalFailures.length,
  });
}
