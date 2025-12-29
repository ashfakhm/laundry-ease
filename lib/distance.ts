export function calculateDistance(
  coord1: { lat: number; lng: number } | undefined,
  coord2: { lat: number; lng: number } | undefined
): number {
  if (!coord1 || !coord2) return 0;

  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(coord2.lat - coord1.lat);
  const dLon = deg2rad(coord2.lng - coord1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(coord1.lat)) *
      Math.cos(deg2rad(coord2.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return Number(d.toFixed(2));
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

/**
 * Convert coordinates from { lat, lng } to GeoJSON Point format
 * GeoJSON uses [longitude, latitude] order
 */
export function toGeoJSON(coord: { lat: number; lng: number }): {
  type: "Point";
  coordinates: [number, number];
} {
  return {
    type: "Point",
    coordinates: [coord.lng, coord.lat], // GeoJSON: [lng, lat]
  };
}

/**
 * Convert GeoJSON Point to { lat, lng } format
 */
export function fromGeoJSON(
  geoJson: { type: "Point"; coordinates: [number, number] } | undefined
): { lat: number; lng: number } | undefined {
  if (!geoJson || geoJson.type !== "Point") return undefined;
  const [lng, lat] = geoJson.coordinates;
  return { lat, lng };
}
