// Mock env vars
process.env.MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/laundryease-test";
process.env.MONGODB_DB = "laundryease-test";
process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "mock-key";
process.env.PROVIDER_SEARCH_DEBUG = "true";
process.env.EMAIL_USER = "mock";
process.env.EMAIL_PASS = "mock";
process.env.TWILIO_ACCOUNT_SID = "mock";
process.env.TWILIO_AUTH_TOKEN = "mock";
process.env.TWILIO_PHONE_NUMBER = "mock";
process.env.RAZORPAY_KEY_ID = "mock";
process.env.RAZORPAY_KEY_SECRET = "mock";
process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "mock";
process.env.CRON_SECRET = "mock";
process.env.NEXTAUTH_SECRET = "mock";
process.env.GOOGLE_ID = "mock";
process.env.GOOGLE_SECRET = "mock";
process.env.NEXTAUTH_URL = "http://localhost:3000";

async function simulate() {
  console.log("Simulating Discovery API...");

  // Dynamic imports
  const { getDb } = await import("../lib/mongodb");
  const { GET } = await import("../app/api/providers/route"); // Importing the specific route

  const { db } = await getDb();
  const collection = db.collection("providers");

  // 1. Setup Test Data
  const nycProvider = {
    _id: "nyc-provider-1",
    name: "NYC Laundry",
    email: "nyc@test.com",
    coordinates: { lat: 40.7128, lng: -74.006 },
    radius_km: 10,
    services: ["Wash"],
    pricing: 10,
  };

  const londonProvider = {
    _id: "london-provider-1",
    name: "London Laundry",
    email: "london@test.com",
    coordinates: { lat: 51.5074, lng: -0.1278 },
    radius_km: 10,
    services: ["Dry Cleaning"],
    pricing: 20,
  };

  await collection.deleteMany({
    email: { $in: ["nyc@test.com", "london@test.com"] },
  });
  await collection.insertMany([nycProvider, londonProvider]);

  // 2. Mock Request for NYC Search
  // We mock the Request object shape expected by the handler
  const createMockRequest = (url: string) =>
    ({
      nextUrl: new URL(url),
    }) as any;

  console.log("\nTest 1: Search near NYC (expect 1 provider)");
  const reqNYC = createMockRequest(
    "http://localhost/api/providers?lat=40.7128&lng=-74.0060&radius=20",
  );

  try {
    const resNYC = await GET(reqNYC);
    const jsonNYC = await resNYC.json();

    console.log(`Status: ${resNYC.status}`);
    console.log(`Found: ${jsonNYC.providers?.length}`);

    if (
      jsonNYC.providers?.length === 1 &&
      jsonNYC.providers[0].email === "nyc@test.com"
    ) {
      console.log("✅ NYC Search passed.");
    } else {
      console.error("❌ NYC Search failed.", jsonNYC);
    }
  } catch (e) {
    console.error("❌ NYC Search threw error:", e);
  }

  console.log("\nTest 2: Search near London (expect 1 provider)");
  const reqLondon = createMockRequest(
    "http://localhost/api/providers?lat=51.5&lng=-0.1&radius=20",
  );

  try {
    const resLondon = await GET(reqLondon);
    const jsonLondon = await resLondon.json();

    console.log(`Status: ${resLondon.status}`);
    console.log(`Found: ${jsonLondon.providers?.length}`);

    if (
      jsonLondon.providers?.length === 1 &&
      jsonLondon.providers[0].email === "london@test.com"
    ) {
      console.log("✅ London Search passed.");
    } else {
      console.error("❌ London Search failed.", jsonLondon);
    }
  } catch (e) {
    console.error("❌ London Search threw error:", e);
  }

  // Clean up
  await collection.deleteMany({
    email: { $in: ["nyc@test.com", "london@test.com"] },
  });
  console.log("\nDone.");
  process.exit(0);
}

simulate().catch(console.error);
