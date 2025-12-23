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
// ... imports
import bcrypt from "bcrypt";

// ... GET function

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
      free_radius_km,
      per_km_rate,
      coordinates,
      pricing,
      currentPassword,
      newPassword,
      capacity,
      phone
    } = body;

    // Build update object with only provided fields
    const updateFields: Record<string, unknown> = {};
    if (name !== undefined) updateFields.name = name;
    if (businessName !== undefined) updateFields.businessName = businessName;
    if (bio !== undefined) updateFields.bio = bio;
    if (description !== undefined) updateFields.description = description;
    if (location !== undefined) updateFields.location = location;
    if (services !== undefined) updateFields.services = services;
    if (pricing !== undefined) updateFields.pricing = Number(pricing);
    if (pricingRates !== undefined) updateFields.pricingRates = pricingRates;
    if (radius_km !== undefined) updateFields.radius_km = Number(radius_km);
    if (free_radius_km !== undefined) updateFields.free_radius_km = Number(free_radius_km);
    if (per_km_rate !== undefined) updateFields.per_km_rate = Number(per_km_rate);
    if (coordinates !== undefined) updateFields.coordinates = coordinates;
    if (capacity !== undefined) updateFields.capacity = Number(capacity);
    if (phone !== undefined) updateFields.phone = phone;

    // Bank Details Update
    const { bankAccountHolder, bankAccountNumber, bankIFSC, upiId } = body;
    if (bankAccountHolder !== undefined || bankAccountNumber !== undefined || bankIFSC !== undefined || upiId !== undefined) {
      updateFields.bankDetails = {
         ...(bankAccountHolder ? { accountHolderName: bankAccountHolder } : {}),
         ...(bankAccountNumber ? { accountNumber: bankAccountNumber } : {}),
         ...(bankIFSC ? { ifsc: bankIFSC } : {}),
         ...(upiId ? { upiId } : {})
      };
      
      // If updating partial bank details, we need to merge with existing if not provided? 
      // Actually, for simplicity, let's assume the frontend sends the whole object or we use dot notation for specific fields if we want partial updates.
      // But typically React Hook Form sends the whole form. 
      // Let's use dot notation to be safe and avoid overwriting with nulls if not intended, OR simpler:
      // constructing the object. However, mongo update with $set replacement of nested object replaces the whole object.
      // Better to use dot notation for nested fields if we want to support partial updates, OR fetch existing and merge.
      // Given the form will send all fields, replacing the object is okay, BUT better to use specific fields.
      
      if (bankAccountHolder !== undefined) updateFields["bankDetails.accountHolderName"] = bankAccountHolder;
      if (bankAccountNumber !== undefined) updateFields["bankDetails.accountNumber"] = bankAccountNumber;
      if (bankIFSC !== undefined) updateFields["bankDetails.ifsc"] = bankIFSC;
      if (upiId !== undefined) updateFields["bankDetails.upiId"] = upiId;

      // Remove the direct object assignment to avoid conflict if mixed
      delete updateFields.bankDetails;
    }

    const { db } = await getDb();

    // Secure Password Change Logic
    if (newPassword) {
        if (!currentPassword) {
            return NextResponse.json({ error: "Current password is required to set a new password" }, { status: 400 });
        }

        const provider = await db.collection("providers").findOne(
            { email: session.user.email },
            { projection: { passwordHash: 1 } }
        );

        if (!provider || !provider.passwordHash) {
             return NextResponse.json({ error: "Provider not found or no password set" }, { status: 404 });
        }

        const isMatch = await bcrypt.compare(currentPassword, provider.passwordHash);
        if (!isMatch) {
            return NextResponse.json({ error: "Incorrect current password" }, { status: 401 });
        }

        updateFields.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

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
