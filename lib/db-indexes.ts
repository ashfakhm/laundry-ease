import { Db } from "mongodb";
import { logger } from "./logger";

type IndexSpec = {
  collection: string;
  keys: Record<string, 1 | -1 | "text" | "2dsphere">;
  options?: Record<string, unknown>;
};

const INDEX_SPECS: IndexSpec[] = [
  // Hard integrity constraints
  {
    collection: "orders",
    keys: { booking_id: 1 },
    options: { name: "orders_booking_id_unique", unique: true },
  },
  {
    collection: "orders",
    keys: { razorpay_order_id: 1 },
    options: {
      name: "orders_razorpay_order_id_unique",
      unique: true,
      partialFilterExpression: { razorpay_order_id: { $type: "string" } },
    },
  },
  {
    collection: "orders",
    keys: { razorpay_payment_id: 1 },
    options: {
      name: "orders_razorpay_payment_id_unique",
      unique: true,
      partialFilterExpression: { razorpay_payment_id: { $type: "string" } },
    },
  },
  {
    collection: "orders",
    keys: { payout_id: 1 },
    options: {
      name: "orders_payout_id_unique",
      unique: true,
      partialFilterExpression: { payout_id: { $type: "string" } },
    },
  },
  {
    collection: "complaints",
    keys: { order_id: 1 },
    options: { name: "complaints_order_id_unique", unique: true },
  },
  {
    collection: "bookings",
    keys: { razorpay_order_id: 1 },
    options: {
      name: "bookings_razorpay_order_id_unique",
      unique: true,
      partialFilterExpression: { razorpay_order_id: { $type: "string" } },
    },
  },
  {
    collection: "bookings",
    keys: { razorpay_payment_id: 1 },
    options: {
      name: "bookings_razorpay_payment_id_unique",
      unique: true,
      partialFilterExpression: { razorpay_payment_id: { $type: "string" } },
    },
  },
  {
    collection: "password_reset_tokens",
    keys: { tokenHash: 1 },
    options: { name: "password_reset_token_hash_unique", unique: true },
  },
  {
    collection: "seekers",
    keys: { email: 1 },
    options: {
      name: "seekers_email_unique",
      unique: true,
      partialFilterExpression: { email: { $type: "string" } },
    },
  },
  {
    collection: "providers",
    keys: { email: 1 },
    options: {
      name: "providers_email_unique",
      unique: true,
      partialFilterExpression: { email: { $type: "string" } },
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
  },
  {
    collection: "webhook_events",
    keys: { event_id: 1 },
    options: { name: "webhook_event_id_unique", unique: true },
  },
  {
    collection: "payments",
    keys: { razorpay_payment_id: 1 },
    options: {
      name: "payments_razorpay_payment_id_unique",
      unique: true,
      partialFilterExpression: { razorpay_payment_id: { $type: "string" } },
    },
  },
  {
    collection: "refunds",
    keys: { razorpay_refund_id: 1 },
    options: {
      name: "refunds_razorpay_refund_id_unique",
      unique: true,
      partialFilterExpression: { razorpay_refund_id: { $type: "string" } },
    },
  },

  // Query/performance indexes
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
];

async function createIndexSafe(db: Db, spec: IndexSpec) {
  try {
    await db.collection(spec.collection).createIndex(spec.keys, spec.options);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    // Duplicate-key errors during index creation indicate existing bad historical data.
    // We keep the app running and log explicit remediation guidance.
    logger.error(
      "DB_INDEX",
      `Failed to create index ${String(spec.options?.name || "unnamed")} on ${spec.collection}`,
      error,
      {
        collection: spec.collection,
        keys: spec.keys,
        message,
      },
    );
  }
}

export async function ensureDbIndexes(db: Db) {
  for (const spec of INDEX_SPECS) {
    await createIndexSafe(db, spec);
  }

  logger.info("DB_INDEX", "Database index initialization completed", {
    totalIndexesAttempted: INDEX_SPECS.length,
  });
}
