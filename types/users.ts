import { ObjectId } from "mongodb";
import { Role } from "./enums";

export interface BaseUser {
  _id?: ObjectId;
  email: string;
  name?: string | null;
  phone?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  passwordHash?: string | null;
  createdAt: Date;
}

export interface Seeker extends BaseUser {
  address?: {
    line1: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    landmark?: string;
  } | null;
  coordinates?: { lat: number; lng: number };
  outstanding_fees?: number;
  blocked_until?: Date;
  isFlagged?: boolean;
  flagReason?: string;
  flaggedAt?: Date;
  cancellationCount?: number;
}

export interface Provider extends BaseUser {
  services?: string[];
  pricing?: number;
  location?: string;
  coordinates?: { lat: number; lng: number };
  locationGeoJSON?: { type: "Point"; coordinates: [number, number] };
  documents?: string[];
  radius_km?: number;
  per_km_rate?: number;
  covers_beyond_radius?: boolean;
  businessName?: string;
  bio?: string;
  description?: string;
  pricingRates?: Record<string, number>;
  free_radius_km?: number;
  capacity?: number; // Max concurrent bookings
  bankDetails?: {
    accountNumber: string;
    ifsc: string;
    accountHolderName: string;
    upiId?: string;
  };
  razorpay_fund_account_id?: string;
  razorpay_contact_id?: string;
  profilePicture?: string;
  bannerImage?: string;
  rating?: number;
  reviewCount?: number;
}

export interface Admin extends BaseUser {}

export type UserWithRole = (Seeker | Provider | Admin) & {
  role: Role;
};

// Frontend-friendly Provider type (with string IDs and distance fields)
export interface ProviderSearchResult {
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
}
