import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { Role } from "@/types/enums";
import { z } from "zod";
import bcrypt from "bcrypt";

const updateSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  address: z
    .object({
      line1: z.string(),
      city: z.string(),
      state: z.string(),
      country: z.string(),
      postalCode: z.string(),
      landmark: z.string().optional(),
    })
    .optional(),
  coordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
});

/**
 * GET /api/profile/seeker
 * Fetch seeker's profile information
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== Role.SEEKER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { db } = await getDb();
    const seeker = await db.collection("seekers").findOne(
      { email: session.user.email },
      {
        projection: {
          passwordHash: 0, // Exclude sensitive data
        },
      }
    );

    if (!seeker) {
      return NextResponse.json({ error: "Seeker not found" }, { status: 404 });
    }

    return NextResponse.json(seeker, { status: 200 });
  } catch (error) {
    console.error("Error fetching seeker profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/profile/seeker
 * Update seeker's profile
 */
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== Role.SEEKER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { db } = await getDb();
    const json = await req.json();
    const parsed = updateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, phone, address, coordinates, currentPassword, newPassword } = parsed.data;
    const updates: any = {};

    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (address) updates.address = address;
    if (coordinates) updates.coordinates = coordinates;
    
    // Secure Password Change Logic
    if (newPassword) {
       if (!currentPassword) {
           return NextResponse.json({ error: "Current password is required to set a new password" }, { status: 400 });
       }

       // Fetch current password hash (explicitly requested as it's usually excluded)
       const user = await db.collection("seekers").findOne(
           { email: session.user.email },
           { projection: { passwordHash: 1 } }
       );

       if (!user || !user.passwordHash) {
           // If user has no password set (e.g. Google auth only), we might allow setting one directly? 
           // For now, adhere to strict security: if they have a DB entry but no password, they likely shouldn't be setting one this way without a different flow.
           // However, let's assume standard email/pass flow:
           return NextResponse.json({ error: "User not found or no password set" }, { status: 404 });
       }

       const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
       if (!isMatch) {
            return NextResponse.json({ error: "Incorrect current password" }, { status: 401 });
       }

       updates.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: "No changes provided" }, { status: 200 });
    }

    const res = await db.collection("seekers").updateOne(
      { email: session.user.email },
      { $set: updates }
    );

    if (res.matchedCount === 0) {
      return NextResponse.json({ error: "Seeker not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Profile updated successfully" });

  } catch (error) {
    console.error("Error updating seeker profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
