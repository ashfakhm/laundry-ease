import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { Role } from "@/types/enums";
import bcrypt from "bcrypt";

export type BaseUser = {
  _id?: ObjectId;
  email: string;
  name?: string | null;
  phone?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  passwordHash?: string | null;
  createdAt: Date;
};

export type Seeker = BaseUser & {
  address?: {
    line1: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    landmark?: string;
  } | null;
};

export type Provider = BaseUser & {
  services?: string[];
  pricing?: number;
  location?: string;
  documents?: string[];
};

export type Admin = BaseUser;

export type UserWithRole = (Seeker | Provider | Admin) & {
  role: Role;
};

/**
 * Find user by email across all collections (seekers → providers → admins)
 * Returns user with their role
 */
export async function getUserByEmail(
  email?: string | null
): Promise<UserWithRole | null> {
  if (!email) return null;
  const { db } = await getDb();

  // Check seekers collection first
  const seeker = await db.collection<Seeker>("seekers").findOne({ email });
  if (seeker) {
    return { ...seeker, role: Role.SEEKER };
  }

  // Check providers collection
  const provider = await db
    .collection<Provider>("providers")
    .findOne({ email });
  if (provider) {
    return { ...provider, role: Role.PROVIDER };
  }

  // Check admins collection
  const admin = await db.collection<Admin>("admins").findOne({ email });
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
}) {
  const { db } = await getDb();
  const now = new Date();
  const passwordHash = data.password
    ? await bcrypt.hash(data.password, 10)
    : null;

  const seeker: Seeker = {
    email: data.email,
    name: data.name ?? null,
    phone: data.phone ?? null,
    passwordHash,
    emailVerified: false,
    phoneVerified: false,
    address: null,
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
}) {
  const { db } = await getDb();
  const now = new Date();
  const passwordHash = data.password
    ? await bcrypt.hash(data.password, 10)
    : null;

  const provider: Provider = {
    email: data.email,
    name: data.name ?? null,
    phone: data.phone ?? null,
    passwordHash,
    emailVerified: false,
    phoneVerified: false,
    services: data.services ?? [],
    pricing: data.pricing,
    location: data.location,
    documents: [],
    createdAt: now,
  };

  const res = await db.collection<Provider>("providers").insertOne(provider);
  return { ...provider, _id: res.insertedId };
}

// Note: admin creation and profile update helpers used to live here.
// They have been removed for now because they were unused. Reintroduce
// them alongside the first real admin/profile management features.
