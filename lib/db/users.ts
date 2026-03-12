import { Seeker, Provider, Admin, UserWithRole } from "@/types/users";
import { Role } from "@/types/enums";
import { getDb } from "../mongodb";
import bcrypt from "bcrypt";
import { ObjectId } from "mongodb";
import { BCRYPT_SALT_ROUNDS } from "../constants";

/**
 * Find user by email across all collections (seekers → providers → admins)
 * Returns user with their role
 */
export async function getUserByEmail(
  email?: string | null,
): Promise<UserWithRole | null> {
  if (!email) return null;
  const { db } = await getDb();
  const normalizedEmail = email.trim().toLowerCase();

  const seeker = await db
    .collection<Seeker>("seekers")
    .findOne({ email: normalizedEmail });
  if (seeker) {
    return { ...seeker, role: Role.SEEKER };
  }

  const provider = await db
    .collection<Provider>("providers")
    .findOne({ email: normalizedEmail });
  if (provider) {
    return { ...provider, role: Role.PROVIDER };
  }

  const admin = await db
    .collection<Admin>("admins")
    .findOne({ email: normalizedEmail });
  if (admin) {
    return { ...admin, role: Role.ADMIN };
  }

  return null;
}

/**
 * Check if email exists in any collection
 */
export async function emailExists(email: string): Promise<boolean> {
  const user = await getUserByEmail(email);
  return user !== null;
}

/**
 * Create a new seeker user
 */
export async function createSeeker(data: {
  email: string;
  name?: string | null;
  password?: string;
  phone?: string | null;
  address?: {
    line1: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    landmark?: string;
  } | null;
  coordinates?: { lat: number; lng: number };
}) {
  const { db } = await getDb();
  const now = new Date();
  const passwordHash = data.password
    ? await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS)
    : null;

  const seeker: Seeker = {
    email: data.email.trim().toLowerCase(),
    name: data.name ?? null,
    phone: data.phone ?? null,
    passwordHash,
    // Signup routes require OTP verification before user creation.
    emailVerified: true,
    phoneVerified: true,
    address: data.address ?? null,
    coordinates: data.coordinates,
    createdAt: now,
  };

  const res = await db.collection<Seeker>("seekers").insertOne(seeker);
  return { ...seeker, _id: res.insertedId };
}

/**
 * Create a new provider user
 */
export async function createProvider(data: {
  email: string;
  name?: string | null;
  password?: string;
  phone?: string | null;
  services?: string[];
  pricing?: number;
  location?: string;
  businessName?: string;
  bio?: string;
  description?: string;
  pricingRates?: Record<string, number>;
  radius_km?: number;
  free_radius_km?: number;
  per_km_rate?: number;
  capacity?: number;
  bankDetails: {
    accountHolderName: string;
    accountNumber: string;
    ifsc: string;
    upiId?: string;
  };
  profilePicture?: string;
  bannerImage?: string;
  coordinates?: { lat: number; lng: number };
}) {
  const { db } = await getDb();
  const now = new Date();
  const passwordHash = data.password
    ? await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS)
    : null;

  const provider: Provider = {
    email: data.email.trim().toLowerCase(),
    name: data.name ?? null,
    phone: data.phone ?? null,
    passwordHash,
    // Signup routes require OTP verification before user creation.
    emailVerified: true,
    phoneVerified: true,
    services: data.services ?? [],
    pricing: data.pricing,
    location: data.location,
    businessName: data.businessName,
    bio: data.bio,
    description: data.description,
    pricingRates: data.pricingRates,
    radius_km: data.radius_km ?? 10,
    free_radius_km: data.free_radius_km ?? 5,
    per_km_rate: data.per_km_rate ?? 0,
    documents: [],
    createdAt: now,
    capacity: data.capacity ?? 100, // Default to 100 concurrent bookings if not provided
    bankDetails: data.bankDetails,
    profilePicture: data.profilePicture,
    bannerImage: data.bannerImage,
    coordinates: data.coordinates,
    ...(data.coordinates
      ? {
          locationGeoJSON: {
            type: "Point" as const,
            coordinates: [data.coordinates.lng, data.coordinates.lat] as [
              number,
              number,
            ],
          },
        }
      : {}),
  };

  const res = await db.collection<Provider>("providers").insertOne(provider);
  return { ...provider, _id: res.insertedId };
}

/**
 * Get provider by their MongoDB ID
 */
export async function getProviderById(
  id: ObjectId | string,
): Promise<Provider | null> {
  const { db } = await getDb();
  const queryId = typeof id === "string" ? new ObjectId(id) : id;
  return db.collection<Provider>("providers").findOne({ _id: queryId });
}

/**
 * Update the Razorpay contact and fund account details for a provider
 */
export async function updateProviderRazorpayIds(
  id: ObjectId | string,
  contactId: string,
  fundAccountId: string,
): Promise<boolean> {
  const { db } = await getDb();
  const queryId = typeof id === "string" ? new ObjectId(id) : id;
  const res = await db.collection<Provider>("providers").updateOne(
    { _id: queryId },
    {
      $set: {
        razorpay_contact_id: contactId,
        razorpay_fund_account_id: fundAccountId,
      },
    },
  );
  return res.modifiedCount > 0;
}
