"use server";

import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { requireProvider } from "@/lib/api/auth";

export async function getProviderProfile() {
  let providerId: ObjectId;
  try {
    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) throw new Error("Unauthorized");
    providerId = new ObjectId(user.id);
  } catch {
    throw new Error("Unauthorized");
  }

  const { db } = await getDb();

  const provider = await db.collection("providers").findOne({ _id: providerId });

  if (!provider) {
    throw new Error("Provider not found");
  }

  // Map database schema to UI requirements
  // DB: services: string[], pricingRates: Record<string, number>
  // UI: services: { name: string, pricePerKg: number }[]

  const services = (provider.services || []).map((serviceName: string) => ({
    name: serviceName,
    pricePerKg: provider.pricingRates?.[serviceName] || provider.pricing || 0,
  }));

  return {
    _id: provider._id.toString(),
    name: provider.name || "",
    businessName: provider.businessName,
    email: provider.email,
    phone: provider.phone || "",
    services: services,
  };
}
