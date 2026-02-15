import bcrypt from "bcrypt";
import fs from "node:fs";
import path from "node:path";
import { MongoClient, ObjectId } from "mongodb";

export const smokeUsers = {
  seeker: {
    email: "smoke.seeker@laundryease.test",
    password: "SmokePass1!",
    name: "Smoke Seeker",
  },
  provider: {
    email: "smoke.provider@laundryease.test",
    password: "SmokePass1!",
    name: "Smoke Provider",
    businessName: "Smoke Provider Laundry",
  },
  admin: {
    email: "smoke.admin@laundryease.test",
    password: "SmokePass1!",
    name: "Smoke Admin",
  },
} as const;

type SeedResult = {
  seekerId: ObjectId;
  providerId: ObjectId;
  adminId: ObjectId;
  bookingId: ObjectId;
  orderId: ObjectId;
  complaintId: ObjectId;
};

export type SettlementSeedResult = SeedResult & {
  complaintTitle: string;
  expectedPlatformCommission: number;
  expectedDistributableAmount: number;
  expectedHalfSettlement: number;
};

type SettlementSeedOptions = {
  complaintTitle?: string;
};

function parseEnvValue(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readEnvFromFile(key: string): string | undefined {
  const envFiles = [".env.local", ".env"];

  for (const fileName of envFiles) {
    const filePath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) continue;

      const envKey = trimmed.slice(0, separatorIndex).trim();
      if (envKey !== key) continue;

      const envValue = trimmed.slice(separatorIndex + 1);
      return parseEnvValue(envValue);
    }
  }

  return undefined;
}

function resolveEnv(key: string): string | undefined {
  return process.env[key] || readEnvFromFile(key);
}

export function getSmokeDbConfig(): { mongoUri: string; dbName: string } {
  const mongoUri = resolveEnv("MONGODB_URI");
  const dbName = resolveEnv("MONGODB_DB") || "laundryease";

  if (!mongoUri) {
    throw new Error("MONGODB_URI is required for Playwright smoke seeding");
  }

  return { mongoUri, dbName };
}

async function upsertSeeker(
  client: MongoClient,
  dbName: string,
  hashedPassword: string,
) {
  const seekers = client.db(dbName).collection("seekers");
  const now = new Date();
  await seekers.updateOne(
    { email: smokeUsers.seeker.email },
    {
      $set: {
        email: smokeUsers.seeker.email,
        name: smokeUsers.seeker.name,
        passwordHash: hashedPassword,
        emailVerified: true,
        phoneVerified: true,
        phone: "+919999999999",
        address: {
          line1: "123 Smoke Street",
          city: "Bengaluru",
          state: "Karnataka",
          country: "India",
          postalCode: "560001",
        },
        coordinates: {
          lat: 12.9716,
          lng: 77.5946,
        },
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );

  const seeker = await seekers.findOne({ email: smokeUsers.seeker.email });
  if (!seeker?._id) throw new Error("Failed to seed seeker");
  return seeker._id as ObjectId;
}

async function upsertProvider(
  client: MongoClient,
  dbName: string,
  hashedPassword: string,
) {
  const providers = client.db(dbName).collection("providers");
  const now = new Date();
  await providers.updateOne(
    { email: smokeUsers.provider.email },
    {
      $set: {
        email: smokeUsers.provider.email,
        name: smokeUsers.provider.name,
        businessName: smokeUsers.provider.businessName,
        passwordHash: hashedPassword,
        emailVerified: true,
        phoneVerified: true,
        phone: "+918888888888",
        location: "Bengaluru",
        services: ["Wash", "Fold"],
        pricing: 120,
        radius_km: 10,
        per_km_rate: 10,
        razorpay_fund_account_id: "fa_e2e_smoke_provider",
        coordinates: {
          lat: 12.9716,
          lng: 77.5946,
        },
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );

  const provider = await providers.findOne({ email: smokeUsers.provider.email });
  if (!provider?._id) throw new Error("Failed to seed provider");
  return provider._id as ObjectId;
}

async function upsertAdmin(
  client: MongoClient,
  dbName: string,
  hashedPassword: string,
) {
  const admins = client.db(dbName).collection("admins");
  const now = new Date();
  await admins.updateOne(
    { email: smokeUsers.admin.email },
    {
      $set: {
        email: smokeUsers.admin.email,
        name: smokeUsers.admin.name,
        passwordHash: hashedPassword,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );

  const admin = await admins.findOne({ email: smokeUsers.admin.email });
  if (!admin?._id) throw new Error("Failed to seed admin");
  return admin._id as ObjectId;
}

export async function seedSmokeData(): Promise<SeedResult> {
  const { mongoUri, dbName } = getSmokeDbConfig();

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);
  const now = new Date();

  try {
    const hashedPassword = await bcrypt.hash(smokeUsers.seeker.password, 10);
    const [seekerId, providerId, adminId] = await Promise.all([
      upsertSeeker(client, dbName, hashedPassword),
      upsertProvider(client, dbName, hashedPassword),
      upsertAdmin(client, dbName, hashedPassword),
    ]);

    const bookingId = new ObjectId("66f0aa01aa01aa01aa01aa01");
    const orderId = new ObjectId("66f0aa02aa02aa02aa02aa02");
    const complaintId = new ObjectId("66f0aa03aa03aa03aa03aa03");

    await db.collection("bookings").updateOne(
      { _id: bookingId },
      {
        $set: {
          _id: bookingId,
          seeker_id: seekerId,
          provider_id: providerId,
          status: "accepted",
          bookingFee: 149,
          bookingFeeStatus: "paid",
          createdAt: now,
          updatedAt: now,
          deadline: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        },
      },
      { upsert: true },
    );

    await db.collection("orders").updateOne(
      { _id: orderId },
      {
        $set: {
          _id: orderId,
          booking_id: bookingId,
          seeker_id: seekerId,
          provider_id: providerId,
          process_status: "delivered",
          payment_status: "held",
          total_price: 499,
          delivery_charge: 49,
          provider_payout_amount: 420,
          razorpay_order_id: "order_smoke_1",
          razorpay_payment_id: "pay_smoke_1",
          otp_confirmed_at: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          escrow_started_at: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          escrow_release_at: new Date(now.getTime() + 22 * 60 * 60 * 1000),
          createdAt: now,
          updatedAt: now,
        },
        $unset: {
          payout_id: "",
          payout_status: "",
          payout_failure_reason: "",
          payout_failure_at: "",
          payout_initiated_at: "",
          payout_updated_at: "",
          payout_lock_at: "",
          refund_amount: "",
          refund_reason: "",
          refund_at: "",
          razorpay_refund_id: "",
          escrow_released_at: "",
          escrow_frozen: "",
          escrow_frozen_at: "",
        },
      },
      { upsert: true },
    );

    await db.collection("complaints").updateOne(
      { _id: complaintId },
      {
        $set: {
          _id: complaintId,
          order_id: orderId,
          booking_id: bookingId,
          seeker_id: seekerId,
          provider_id: providerId,
          complaint_type: "quality_issue",
          title: "Smoke complaint for role navigation",
          description: "Used by Playwright smoke tests.",
          status: "open",
          provider_access_granted: true,
          participants: [seekerId, providerId],
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );

    await db.collection("complaint_messages").updateOne(
      {
        complaint_id: complaintId,
        message_type: "TEXT",
        sender_role: "seeker",
      },
      {
        $set: {
          complaint_id: complaintId,
          sender_id: seekerId,
          sender_role: "seeker",
          message_type: "TEXT",
          content: "Smoke initial message",
          createdAt: now,
        },
      },
      { upsert: true },
    );

    return {
      seekerId,
      providerId,
      adminId,
      bookingId,
      orderId,
      complaintId,
    };
  } finally {
    await client.close();
  }
}

export async function seedSettlementJourneyData(
  options?: SettlementSeedOptions,
): Promise<SettlementSeedResult> {
  const { mongoUri, dbName } = getSmokeDbConfig();

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);
  const now = new Date();

  try {
    const hashedPassword = await bcrypt.hash(smokeUsers.seeker.password, 10);
    const [seekerId, providerId, adminId] = await Promise.all([
      upsertSeeker(client, dbName, hashedPassword),
      upsertProvider(client, dbName, hashedPassword),
      upsertAdmin(client, dbName, hashedPassword),
    ]);

    const bookingId = new ObjectId();
    const orderId = new ObjectId();
    const complaintId = new ObjectId();
    const scenarioToken = complaintId.toString().slice(-8);
    const complaintTitle =
      options?.complaintTitle?.trim() ||
      `Settlement Chain E2E Complaint ${complaintId.toString().slice(-6)}`;

    const totalPrice = 500;
    const platformCommission = 25;
    const distributableAmount = totalPrice - platformCommission;
    const halfSettlement = distributableAmount / 2;

    await db.collection("bookings").updateOne(
      { _id: bookingId },
      {
        $set: {
          _id: bookingId,
          seeker_id: seekerId,
          provider_id: providerId,
          status: "accepted",
          bookingFee: 149,
          bookingFeeStatus: "paid",
          createdAt: now,
          updatedAt: now,
          deadline: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        },
      },
      { upsert: true },
    );

    await db.collection("orders").updateOne(
      { _id: orderId },
      {
        $set: {
          _id: orderId,
          booking_id: bookingId,
          seeker_id: seekerId,
          provider_id: providerId,
          process_status: "delivered",
          payment_status: "held",
          total_price: totalPrice,
          delivery_charge: 50,
          platform_commission: platformCommission,
          provider_payout_amount: distributableAmount,
          razorpay_order_id: `order_settlement_e2e_${scenarioToken}`,
          razorpay_payment_id: `pay_settlement_e2e_${scenarioToken}`,
          otp_confirmed_at: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          escrow_started_at: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          escrow_release_at: new Date(now.getTime() + 22 * 60 * 60 * 1000),
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );

    await db.collection("complaints").updateOne(
      { _id: complaintId },
      {
        $set: {
          _id: complaintId,
          order_id: orderId,
          booking_id: bookingId,
          seeker_id: seekerId,
          provider_id: providerId,
          complaint_type: "quality_issue",
          title: complaintTitle,
          description: "Deterministic settlement-chain E2E complaint fixture.",
          status: "open",
          provider_access_granted: true,
          participants: [seekerId, providerId],
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );

    await db.collection("complaint_messages").updateOne(
      {
        complaint_id: complaintId,
        message_type: "TEXT",
        sender_role: "seeker",
      },
      {
        $set: {
          complaint_id: complaintId,
          sender_id: seekerId,
          sender_role: "seeker",
          message_type: "TEXT",
          content: "Settlement chain initial message",
          createdAt: now,
        },
      },
      { upsert: true },
    );

    return {
      seekerId,
      providerId,
      adminId,
      bookingId,
      orderId,
      complaintId,
      complaintTitle,
      expectedPlatformCommission: platformCommission,
      expectedDistributableAmount: distributableAmount,
      expectedHalfSettlement: halfSettlement,
    };
  } finally {
    await client.close();
  }
}
