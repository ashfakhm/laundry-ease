/**
 * Script to seed test users for authentication testing
 * Run with: node --env-file=.env.local scripts/seed-test-users.mjs
 */

import { MongoClient } from "mongodb";
import bcrypt from "bcrypt";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "laundryease";

async function seedTestUsers() {
  console.log("🌱 Seeding test users...\n");

  if (!uri) {
    console.error("❌ MONGODB_URI is not set in environment");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);

    // Create test seeker
    console.log("Creating test seeker...");
    const seekerPasswordHash = await bcrypt.hash("password123", 10);
    const seekerResult = await db.collection("seekers").insertOne({
      email: "seeker@test.com",
      name: "Test Seeker",
      phone: "+1234567890",
      passwordHash: seekerPasswordHash,
      emailVerified: true,
      phoneVerified: true,
      address: {
        line1: "123 Test St",
        city: "Test City",
        state: "Test State",
        country: "Test Country",
        postalCode: "12345",
        landmark: "Near Test Mall",
      },
      createdAt: new Date(),
    });
    console.log("✅ Seeker created:");
    console.log("   Email: seeker@test.com");
    console.log("   Password: password123");
    console.log("   ID:", seekerResult.insertedId.toString());
    console.log();

    // Create test provider
    console.log("Creating test provider...");
    const providerPasswordHash = await bcrypt.hash("password123", 10);
    const providerResult = await db.collection("providers").insertOne({
      email: "provider@test.com",
      name: "Test Provider",
      phone: "+1234567891",
      passwordHash: providerPasswordHash,
      emailVerified: true,
      phoneVerified: true,
      services: ["Washing", "Dry Cleaning", "Ironing"],
      pricing: 50,
      location: "New York, NY",
      documents: [],
      createdAt: new Date(),
    });
    console.log("✅ Provider created:");
    console.log("   Email: provider@test.com");
    console.log("   Password: password123");
    console.log("   ID:", providerResult.insertedId.toString());
    console.log();

    // Create test admin
    console.log("Creating test admin...");
    const adminPasswordHash = await bcrypt.hash("password123", 10);
    const adminResult = await db.collection("admins").insertOne({
      email: "admin@test.com",
      name: "Test Admin",
      passwordHash: adminPasswordHash,
      emailVerified: true,
      phoneVerified: false,
      createdAt: new Date(),
    });
    console.log("✅ Admin created:");
    console.log("   Email: admin@test.com");
    console.log("   Password: password123");
    console.log("   ID:", adminResult.insertedId.toString());
    console.log();

    console.log("🎉 All test users created successfully!");
    console.log("\n📝 Test Credentials:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Seeker:   seeker@test.com   / password123");
    console.log("Provider: provider@test.com / password123");
    console.log("Admin:    admin@test.com    / password123");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  } catch (error) {
    if (error.code === 11000) {
      console.log("\n⚠️  Test users already exist in database");
      console.log("\n📝 Test Credentials:");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("Seeker:   seeker@test.com   / password123");
      console.log("Provider: provider@test.com / password123");
      console.log("Admin:    admin@test.com    / password123");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    } else {
      console.error("❌ Error seeding test users:", error);
      process.exit(1);
    }
  } finally {
    await client.close();
    process.exit(0);
  }
}

seedTestUsers();
