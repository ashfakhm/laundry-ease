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
};
