/**
 * Calculate delivery charge based on distance between seeker and provider.
 * Beyond the provider's free radius, charges accrue per km.
 */
import { calculateDistance } from "@/lib/distance";

type Coordinates = { lat: number; lng: number };

export function computeDeliveryCharge(
  seekerCoords: Coordinates | null | undefined,
  providerCoords: Coordinates | null | undefined,
  freeRadiusKm: number = 5,
  perKmRate: number = 10,
): { distanceKm: number; charge: number } {
  if (!seekerCoords || !providerCoords) {
    return { distanceKm: 0, charge: 0 };
  }

  const distanceKm = calculateDistance(seekerCoords, providerCoords);
  const extraKm = Math.max(0, distanceKm - freeRadiusKm);
  const charge = Math.round(extraKm * perKmRate);
  return { distanceKm, charge };
}
