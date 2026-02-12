import { geocodeLocationText } from "../lib/geocoding";

// Mock env var
process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "mock-key";

// Mock Fetch
const originalFetch = global.fetch;

async function testGeocoding() {
  console.log("Testing Geocoding Logic...");

  // Scenario 1: Success
  console.log("\n1. Testing Success Case...");
  global.fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        status: "OK",
        results: [
          {
            geometry: {
              location: { lat: 40.7128, lng: -74.006 },
            },
          },
        ],
      }),
    }) as any;

  const coords = await geocodeLocationText("New York, NY");
  if (coords && coords.lat === 40.7128 && coords.lng === -74.006) {
    console.log("✅ Success case passed: Parsed coordinates correctly.");
  } else {
    console.error("❌ Success case failed:", coords);
  }

  // Scenario 2: API Error (Invalid Key)
  console.log("\n2. Testing API Error (Invalid Key)...");
  global.fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        status: "REQUEST_DENIED",
        error_message: "The provided API key is invalid.",
        results: [],
      }),
    }) as any;

  const coordsError = await geocodeLocationText("New York, NY");
  if (coordsError === null) {
    console.log(
      "✅ Error case passed: Handled REQUEST_DENIED correctly (returned null).",
    );
  } else {
    console.error("❌ Error case failed: Expected null, got", coordsError);
  }

  // Scenario 3: Network Error
  console.log("\n3. Testing Network Error...");
  global.fetch = async () => {
    throw new Error("Network error");
  };

  const coordsNetwork = await geocodeLocationText("New York, NY");
  if (coordsNetwork === null) {
    console.log(
      "✅ Network error passed: Handled exception correctly (returned null).",
    );
  } else {
    console.error("❌ Network error failed: Expected null, got", coordsNetwork);
  }

  // Restore fetch
  global.fetch = originalFetch;
  console.log("\nDone.");
}

testGeocoding().catch(console.error);
