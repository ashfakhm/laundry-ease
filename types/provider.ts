export type ProviderSearchResult = {
  _id: string;
  name: string;
  businessName?: string;
  bio?: string;
  pricing: number;
  location: string;
  distance_km: number;
  delivery_fee: number;
  rating: number;
  reviewCount: number;
  radius_km?: number;
  per_km_rate?: number;
  covers_beyond_radius?: boolean;
  services?: string[];
  profilePicture?: string;
  bannerImage?: string;
};

export type Provider = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  businessName?: string;
  bio?: string;
  pricing?: number;
  location?: string;
  coordinates?: { lat: number; lng: number };
  locationGeoJSON?: { type: "Point"; coordinates: [number, number] };
  radius_km?: number;
  per_km_rate?: number;
  covers_beyond_radius?: boolean;
  description?: string;
  pricingRates?: Record<string, number>;
  free_radius_km?: number;
  capacity?: number; // Max concurrent bookings
};
