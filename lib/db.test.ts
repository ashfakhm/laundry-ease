import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { ObjectId, type Db, type MongoClient } from "mongodb";
import { createBooking, acceptBookingWithCapacityCheck } from "./db/index";

const { mockedEnv } = vi.hoisted(() => ({
  mockedEnv: {
    MONGODB_URI: "",
    MONGODB_DB: "laundryease_db_test",
  },
}));

vi.mock("@/lib/env", () => ({
  env: mockedEnv,
}));

vi.mock("./audit", () => ({
  auditBookingStateChange: vi.fn(),
  auditEscrowStateChange: vi.fn(),
}));

let mongoServer: MongoMemoryReplSet;
let db: Db;
let mongoClient: MongoClient;

describe("lib/db.ts - Booking Atomic Transactions", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    mockedEnv.MONGODB_URI = mongoServer.getUri();

    // Import and get connected db
    const { getDb } = await import("./mongodb");
    const connected = await getDb();
    db = connected.db;
    mongoClient = connected.client;
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await Promise.all([
      db.collection("bookings").deleteMany({}),
      db.collection("orders").deleteMany({}),
      db.collection("providers").deleteMany({}),
      db.collection("seekers").deleteMany({}),
    ]);
  });

  afterAll(async () => {
    if (mongoClient) await mongoClient.close();
    if (mongoServer) await mongoServer.stop();
  });

  describe("createBooking", () => {
    it("creates a booking when capacity is available", async () => {
      const seekerId = new ObjectId();
      const providerId = new ObjectId();
      const capacity = 5;

      const booking = await createBooking({
        seeker_id: seekerId,
        provider_id: providerId,
        bookingFee: 149,
        capacity,
      });

      expect(booking).toBeDefined();
      expect(booking?.status).toBe("requested");
      expect(booking?.seeker_id.toString()).toBe(seekerId.toString());

      const count = await db.collection("bookings").countDocuments();
      expect(count).toBe(1);
    });

    it("throws error when provider capacity is reached (bookings + orders)", async () => {
      const seekerId = new ObjectId();
      const providerId = new ObjectId();
      const capacity = 2;

      // Fill capacity: 1 active booking + 1 active order
      await db.collection("bookings").insertOne({
        provider_id: providerId,
        status: "accepted",
      });
      await db.collection("orders").insertOne({
        provider_id: providerId,
        process_status: "processing",
      });

      await expect(
        createBooking({
          seeker_id: seekerId,
          provider_id: providerId,
          bookingFee: 149,
          capacity,
        }),
      ).rejects.toThrow(/CAPACITY_EXCEEDED/);

      // Verify no new booking was created
      const count = await db.collection("bookings").countDocuments();
      expect(count).toBe(1);
    });
  });

  describe("acceptBookingWithCapacityCheck", () => {
    it("accepts a booking when capacity is available", async () => {
      const bookingId = new ObjectId();
      const providerId = new ObjectId();

      await db.collection("bookings").insertOne({
        _id: bookingId,
        provider_id: providerId,
        status: "requested",
        bookingFeeStatus: "paid",
      });

      const updated = await acceptBookingWithCapacityCheck({
        booking_id: bookingId,
        provider_id: providerId,
        maxCapacity: 5,
        platform_commission: 0.05,
        provider_payout_amount: 500,
      });

      expect(updated).toBeDefined();
      expect(updated?.status).toBe("accepted");
      expect(updated?.platform_commission).toBe(0.05);

      const dbBooking = await db
        .collection("bookings")
        .findOne({ _id: bookingId });
      expect(dbBooking?.status).toBe("accepted");
    });

    it("throws error when capacity is reached upon acceptance", async () => {
      const bookingId = new ObjectId();
      const providerId = new ObjectId();
      const maxCapacity = 1;

      // Initial requested booking
      await db.collection("bookings").insertOne({
        _id: bookingId,
        provider_id: providerId,
        status: "requested",
        bookingFeeStatus: "paid",
      });

      // Another active booking already exists
      await db.collection("bookings").insertOne({
        provider_id: providerId,
        status: "accepted",
      });

      await expect(
        acceptBookingWithCapacityCheck({
          booking_id: bookingId,
          provider_id: providerId,
          maxCapacity,
          platform_commission: 0.05,
          provider_payout_amount: 500,
        }),
      ).rejects.toThrow(/CAPACITY_EXCEEDED/);

      const dbBooking = await db
        .collection("bookings")
        .findOne({ _id: bookingId });
      expect(dbBooking?.status).toBe("requested"); // Should not have changed
    });

    it("replaces fresh refund lock successfully", async () => {
      // Test the logic where it unsets refund_in_progress_at if it's stale or handled
      const bookingId = new ObjectId();
      const providerId = new ObjectId();
      const staleDate = new Date(Date.now() - 10 * 60 * 1000); // 10 mins ago (stale)

      await db.collection("bookings").insertOne({
        _id: bookingId,
        provider_id: providerId,
        status: "requested",
        bookingFeeStatus: "paid",
        refund_in_progress_at: staleDate,
      });

      const updated = await acceptBookingWithCapacityCheck({
        booking_id: bookingId,
        provider_id: providerId,
        maxCapacity: 5,
        platform_commission: 0.05,
        provider_payout_amount: 500,
      });

      expect(updated?.status).toBe("accepted");
      expect(updated?.refund_in_progress_at).toBeUndefined();
    });
  });
});
