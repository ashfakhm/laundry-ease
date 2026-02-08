"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";

export async function getProviderProfile() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "provider") {
    throw new Error("Unauthorized");
  }

  const { db } = await getDb();

  const provider = await db
    .collection("providers")
    .findOne({ email: session.user.email });

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
