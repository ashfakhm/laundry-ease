import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";

/**
 * GET /api/profile/provider
 * Get the logged-in provider's profile
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();
    const provider = await db.collection("providers").findOne(
      { email: session.user.email },
      {
        projection: {
          passwordHash: 0, // Exclude sensitive data
          emailVerified: 0,
          phoneVerified: 0,
        },
      }
    );

    if (!provider) {
      return NextResponse.json(
        { error: "Provider profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(provider, { status: 200 });
  } catch (error) {
    console.error("Error fetching provider profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/profile/provider
 * Update the logged-in provider's profile
 */
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      businessName,
      bio,
      description,
      location,
      services,
      pricingRates,
      radius_km,
      coordinates,
    } = body;

    // Build update object with only provided fields
    const updateFields: Record<string, unknown> = {};
    if (name !== undefined) updateFields.name = name;
    if (businessName !== undefined) updateFields.businessName = businessName;
    if (bio !== undefined) updateFields.bio = bio;
    if (description !== undefined) updateFields.description = description;
    if (location !== undefined) updateFields.location = location;
    if (services !== undefined) updateFields.services = services;
    if (pricingRates !== undefined) updateFields.pricingRates = pricingRates;
    if (radius_km !== undefined) updateFields.radius_km = Number(radius_km);
    if (coordinates !== undefined) updateFields.coordinates = coordinates;

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { db } = await getDb();
    const result = await db
      .collection("providers")
      .findOneAndUpdate(
        { email: session.user.email },
        { $set: updateFields },
        { returnDocument: "after", projection: { passwordHash: 0 } }
      );

    if (!result) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error updating provider profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
