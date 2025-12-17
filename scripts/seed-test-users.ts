/**
 * Script to seed test users for authentication testing
 * Run with: node --env-file=.env.local -r tsx/register scripts/seed-test-users.ts
 * Or: npx tsx --env-file=.env.local scripts/seed-test-users.ts
 */

import { createSeeker, createProvider, createAdmin } from "../lib/db";

async function seedTestUsers() {
  console.log("🌱 Seeding test users...\n");

  try {
    // Create test seeker
    console.log("Creating test seeker...");
    const seeker = await createSeeker({
      email: "seeker@test.com",
      name: "Test Seeker",
      password: "password123",
      phone: "+1234567890",
    });
    console.log("✅ Seeker created:");
    console.log("   Email: seeker@test.com");
    console.log("   Password: password123");
    console.log("   ID:", seeker._id?.toString());
    console.log();

    // Create test provider
    console.log("Creating test provider...");
    const provider = await createProvider({
      email: "provider@test.com",
      name: "Test Provider",
      password: "password123",
      phone: "+1234567891",
      services: ["Washing", "Dry Cleaning", "Ironing"],
      pricing: 50,
      location: "New York, NY",
    });
    console.log("✅ Provider created:");
    console.log("   Email: provider@test.com");
    console.log("   Password: password123");
    console.log("   ID:", provider._id?.toString());
    console.log();

    // Create test admin
    console.log("Creating test admin...");
    const admin = await createAdmin({
      email: "admin@test.com",
      name: "Test Admin",
      password: "password123",
    });
    console.log("✅ Admin created:");
    console.log("   Email: admin@test.com");
    console.log("   Password: password123");
    console.log("   ID:", admin._id?.toString());
    console.log();

    console.log("🎉 All test users created successfully!");
    console.log("\nYou can now test authentication with:");
    console.log("- Seeker: seeker@test.com / password123");
    console.log("- Provider: provider@test.com / password123");
    console.log("- Admin: admin@test.com / password123");
  } catch (error) {
    console.error("❌ Error seeding test users:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seedTestUsers();
