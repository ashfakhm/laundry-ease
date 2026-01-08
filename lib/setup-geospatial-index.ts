/**
 * Setup script to create geospatial index on provider coordinates
 * 
 * This index enables efficient MongoDB geospatial queries using $geoNear.
 * Run this script once to optimize provider search performance.
 * 
 * Note: Currently, coordinates are stored as { lat, lng } format.
 * For full MongoDB geospatial support, consider migrating to GeoJSON format:
 * { type: "Point", coordinates: [lng, lat] }
 * 
 * Usage:
 * - Run this in a migration script or during app initialization
 * - Or call from a Next.js API route for one-time setup
 */

import { getDb } from "./mongodb";
import { logger } from "./logger";

export async function setupGeospatialIndex() {
  try {
    const { db } = await getDb();
    const providersCollection = db.collection("providers");

    // Check if index already exists
    const indexes = await providersCollection.indexes();
    const hasGeoIndex = indexes.some(
      (idx) => idx.key && ("coordinates" in idx.key || "locationGeoJSON" in idx.key)
    );

    if (hasGeoIndex) {
      logger.info("GEO-INDEX", "Geospatial index already exists");
      return { success: true, message: "Index already exists" };
    }

    // For now, we'll create a compound index on coordinates
    // Note: For full geospatial support, coordinates should be in GeoJSON format
    // This index helps with coordinate-based queries but doesn't enable $geoNear
    await providersCollection.createIndex(
      { "coordinates.lat": 1, "coordinates.lng": 1 },
      { name: "coordinates_2d" }
    );

    logger.info("GEO-INDEX", "Created coordinate index on providers collection");
    return { success: true, message: "Index created successfully" };
  } catch (error) {
    logger.error("GEO-INDEX", "Error setting up geospatial index", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Future: Migrate coordinates to GeoJSON format and create 2dsphere index
 * This would enable full MongoDB geospatial query capabilities
 */
export async function migrateToGeoJSONAndCreateIndex() {
  try {
    const { db } = await getDb();
    const providersCollection = db.collection("providers");

    // Find all providers with coordinates
    const providers = await providersCollection
      .find({
        coordinates: { $exists: true, $ne: null },
        locationGeoJSON: { $exists: false }, // Only migrate if not already migrated
      })
      .toArray();

    logger.info("GEO-INDEX", `Found ${providers.length} providers to migrate`);

    // Migrate each provider
    for (const provider of providers) {
      if (provider.coordinates && !provider.locationGeoJSON) {
        const { lat, lng } = provider.coordinates;
        await providersCollection.updateOne(
          { _id: provider._id },
          {
            $set: {
              locationGeoJSON: {
                type: "Point",
                coordinates: [lng, lat], // GeoJSON: [longitude, latitude]
              },
            },
          }
        );
      }
    }

    // Create 2dsphere index on locationGeoJSON
    await providersCollection.createIndex(
      { locationGeoJSON: "2dsphere" },
      { name: "locationGeoJSON_2dsphere" }
    );

    logger.info("GEO-INDEX", "Migration complete: Created GeoJSON field and 2dsphere index");
    return { success: true, message: "Migration complete" };
  } catch (error) {
    logger.error("GEO-INDEX", "Error migrating to GeoJSON", error);
    return { success: false, error: String(error) };
  }
}

