// Mock environment variables BEFORE importing anything
process.env.MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/laundryease-test";
process.env.MONGODB_DB = "laundryease-test";
process.env.EMAIL_USER = "mock";
process.env.EMAIL_PASS = "mock";
process.env.TWILIO_ACCOUNT_SID = "mock";
process.env.TWILIO_AUTH_TOKEN = "mock";
process.env.TWILIO_PHONE_NUMBER = "mock";
process.env.RAZORPAY_KEY_ID = "mock";
process.env.RAZORPAY_KEY_SECRET = "mock";
process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "mock";
process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "mock";
process.env.CRON_SECRET = "mock";
process.env.NEXTAUTH_SECRET = "mock";
process.env.GOOGLE_ID = "mock";
process.env.GOOGLE_SECRET = "mock";
process.env.NEXTAUTH_URL = "http://localhost:3000";

async function verify() {
  console.log("Verifying geospatial index...");

  // Dynamic imports to avoid hoisting issues
  const { getDb } = await import("../lib/mongodb");
  const { setupGeospatialIndex, migrateToGeoJSONAndCreateIndex } =
    await import("../lib/setup-geospatial-index");

  const { db } = await getDb();
  const collection = db.collection("providers");

  // 1. Ensure initial index exists
  await setupGeospatialIndex();

  // 2. Insert dummy provider
  const dummyProvider = {
    name: "Test Provider",
    email: "test-geo@example.com",
    coordinates: { lat: 40.7128, lng: -74.006 }, // NYC
    createdAt: new Date(),
  };

  await collection.deleteOne({ email: dummyProvider.email });
  await collection.insertOne(dummyProvider);

  console.log("Checking indexes...");
  let indexes = await collection.indexes();
  console.log("Initial Indexes:", JSON.stringify(indexes, null, 2));

  // Check for 2dsphere index
  let has2dsphere = indexes.some(
    (idx) => idx.key.locationGeoJSON === "2dsphere",
  );

  if (!has2dsphere) {
    console.log("⚠️ No 2dsphere index found. Running migration...");
    await migrateToGeoJSONAndCreateIndex();

    indexes = await collection.indexes();
    console.log("Post-migration Indexes:", JSON.stringify(indexes, null, 2));
    has2dsphere = indexes.some((idx) => idx.key.locationGeoJSON === "2dsphere");

    if (has2dsphere) {
      console.log("✅ Migration successful: 2dsphere index created.");
    } else {
      console.error("❌ Migration failed: 2dsphere index NOT created.");
      process.exit(1);
    }
  } else {
    console.log("✅ 2dsphere index already exists.");
  }

  // 3. Test Query using $near (now supported with 2dsphere)
  // Need to use the new locationGeoJSON field
  console.log("Testing $near query...");
  try {
    const results = await collection
      .find({
        locationGeoJSON: {
          $near: {
            $geometry: { type: "Point", coordinates: [-74.006, 40.7128] },
            $maxDistance: 5000, // 5km
          },
        },
      })
      .toArray();

    console.log(`Found ${results.length} providers near NYC.`);
    if (results.length > 0) {
      console.log("✅ $near query successful.");
    } else {
      console.error("❌ $near query returned no results.");
    }
  } catch (err) {
    console.error("❌ $near query failed:", err);
  }

  // Clean up
  await collection.deleteOne({ email: dummyProvider.email });
  console.log("Done.");
  process.exit(0);
}

verify().catch(console.error);
