import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { Role } from "@/types/enums";
import bcrypt from "bcrypt";

export type User = {
  _id?: ObjectId;
  email: string;
  role: Role | null;
  name?: string | null;
  phone?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  address?: {
    line1: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    landmark?: string;
  } | null;
  passwordHash?: string | null;
  createdAt: Date;
};

export async function getUserByEmail(email?: string | null) {
  if (!email) return null;
  const { db } = await getDb();
  return db.collection<User>("users").findOne({ email });
}

export async function createUser(data: {
  email: string;
  role: Role;
  name?: string | null;
  password?: string;
}) {
  const { db } = await getDb();
  const now = new Date();
  const passwordHash = data.password
    ? await bcrypt.hash(data.password, 10)
    : null;

  const user: User = {
    email: data.email,
    role: data.role,
    name: data.name ?? null,
    passwordHash,
    createdAt: now,
  };

  const res = await db.collection<User>("users").insertOne(user);
  return { ...user, _id: res.insertedId };
}

export async function updateUserRoleAndName(
  email: string,
  data: { role: Role; name: string }
) {
  const { db } = await getDb();
  const res = await db
    .collection<User>("users")
    .updateOne({ email }, { $set: data });
  return res;
}

export type ProviderProfile = {
  _id?: ObjectId;
  userId: ObjectId;
  services: string[];
  pricing: number;
  location: string;
  documents?: string[];
};

export async function createProviderProfile(profile: ProviderProfile) {
  const { db } = await getDb();
  const res = await db
    .collection<ProviderProfile>("providers")
    .insertOne(profile);
  return { ...profile, _id: res.insertedId };
}
