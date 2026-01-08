import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { maskBankDetails } from "@/lib/utils";
import { getDb } from "@/lib/mongodb";
import {
  createRazorpayContact,
  createRazorpayFundAccount,
} from "@/lib/razorpay";
import { Provider } from "@/lib/db";
import { logger } from "@/lib/logger";
import { updateProviderProfileSchema } from "@/lib/api/schemas";

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

    // Mask bank details before returning by creating a safe copy for the response
    const safeProvider = {
      ...provider,
      bankDetails: provider.bankDetails
        ? maskBankDetails(
            provider.bankDetails as {
              accountNumber?: string;
              ifsc?: string;
              upiId?: string;
              accountHolderName?: string;
            }
          )
        : undefined,
    } as unknown;

    return NextResponse.json(safeProvider, { status: 200 });
  } catch (error) {
    logger.error("PROFILE", "Error fetching provider profile", error);
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
    const parsed = updateProviderProfileSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    
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
      phone,
      profilePicture,
      bannerImage,
      bankAccountHolder,
      bankAccountNumber,
      bankIFSC,
      upiId,
    } = parsed.data;

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
    if (free_radius_km !== undefined)
      updateFields.free_radius_km = Number(free_radius_km);
    if (per_km_rate !== undefined)
      updateFields.per_km_rate = Number(per_km_rate);
    if (coordinates !== undefined) updateFields.coordinates = coordinates;
    if (capacity !== undefined) updateFields.capacity = Number(capacity);
    if (phone !== undefined) updateFields.phone = phone;
    if (profilePicture !== undefined)
      updateFields.profilePicture = profilePicture;
    if (bannerImage !== undefined) updateFields.bannerImage = bannerImage;

    // Bank Details Update
    if (
      bankAccountHolder !== undefined ||
      bankAccountNumber !== undefined ||
      bankIFSC !== undefined ||
      upiId !== undefined
    ) {
      updateFields.bankDetails = {
        ...(bankAccountHolder ? { accountHolderName: bankAccountHolder } : {}),
        ...(bankAccountNumber ? { accountNumber: bankAccountNumber } : {}),
        ...(bankIFSC ? { ifsc: bankIFSC } : {}),
        ...(upiId ? { upiId } : {}),
      };

      // If updating partial bank details, we need to merge with existing if not provided?
      // Actually, for simplicity, let's assume the frontend sends the whole object or we use dot notation for specific fields if we want partial updates.
      // But typically React Hook Form sends the whole form.
      // Let's use dot notation to be safe and avoid overwriting with nulls if not intended, OR simpler:
      // constructing the object. However, mongo update with $set replacement of nested object replaces the whole object.
      // Better to use dot notation for nested fields if we want to support partial updates, OR fetch existing and merge.
      // Given the form will send all fields, replacing the object is okay, BUT better to use specific fields.

      if (bankAccountHolder !== undefined)
        updateFields["bankDetails.accountHolderName"] = bankAccountHolder;
      if (bankAccountNumber !== undefined)
        updateFields["bankDetails.accountNumber"] = bankAccountNumber;
      if (bankIFSC !== undefined) updateFields["bankDetails.ifsc"] = bankIFSC;
      if (upiId !== undefined) updateFields["bankDetails.upiId"] = upiId;

      // Remove the direct object assignment to avoid conflict if mixed
      delete updateFields.bankDetails;

      try {
        const { db } = await getDb();
        // Fetch current provider to get contact_id if exists, and fallback details
        const currentProvider = await db
          .collection<Provider>("providers")
          .findOne({ email: session.user.email });

        if (currentProvider) {
          const contactName =
            (updateFields.name as string) || currentProvider.name || "Provider";
          const contactEmail = session.user.email;
          const contactPhone =
            (updateFields.phone as string) || currentProvider.phone || "";

          let contactId = currentProvider.razorpay_contact_id;

          // 1. Create/Get Contact
          if (!contactId && contactPhone) {
            const contact = await createRazorpayContact({
              name: contactName,
              email: contactEmail,
              contact: contactPhone,
              type: "vendor",
              reference_id: currentProvider._id?.toString(),
            });
            contactId = contact.id;
            updateFields.razorpay_contact_id = contactId;
          }

          // 2. Create Fund Account (Bank)
          // We prioritize Bank Account over UPI for now as per mandatory fields
          const accName =
            (updateFields["bankDetails.accountHolderName"] as string) ||
            currentProvider.bankDetails?.accountHolderName;
          const accNumber =
            (updateFields["bankDetails.accountNumber"] as string) ||
            currentProvider.bankDetails?.accountNumber;
          const accIfsc =
            (updateFields["bankDetails.ifsc"] as string) ||
            currentProvider.bankDetails?.ifsc;

          if (contactId && accName && accNumber && accIfsc) {
            const fundAccount = await createRazorpayFundAccount({
              contact_id: contactId,
              account_type: "bank_account",
              bank_account: {
                name: accName,
                account_number: accNumber,
                ifsc: accIfsc,
              },
            });
            updateFields.razorpay_fund_account_id = fundAccount.id;
          }
        }
      } catch (e: unknown) {
        const err = e as Error;
        logger.error("PROFILE", "Razorpay sync error during profile update", err, { email: session.user.email });
        // Fail the request if critical bank details sync fails so user knows
        return NextResponse.json(
          {
            error: `Payment Gateway Error: ${
              err?.message || "Failed to sync bank details"
            }`,
          },
          { status: 500 }
        );
      }
    }

    const { db } = await getDb();

    // Secure Password Change Logic
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required to set a new password" },
          { status: 400 }
        );
      }

      const provider = await db
        .collection("providers")
        .findOne(
          { email: session.user.email },
          { projection: { passwordHash: 1 } }
        );

      if (!provider || !provider.passwordHash) {
        return NextResponse.json(
          { error: "Provider not found or no password set" },
          { status: 404 }
        );
      }

      const isMatch = await bcrypt.compare(
        currentPassword,
        provider.passwordHash
      );
      if (!isMatch) {
        return NextResponse.json(
          { error: "Incorrect current password" },
          { status: 401 }
        );
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

    // findOneAndUpdate returns an object with 'value' containing the updated doc
    const updated =
      (result as { value?: Provider }).value || (result as Provider);

    const safeUpdated = {
      ...updated,
      bankDetails: (updated as Provider).bankDetails
        ? maskBankDetails(
            (updated as Provider).bankDetails as {
              accountNumber?: string;
              ifsc?: string;
              upiId?: string;
              accountHolderName?: string;
            }
          )
        : undefined,
    } as unknown;

    return NextResponse.json(safeUpdated, { status: 200 });
  } catch (error) {
    logger.error("PROFILE", "Error updating provider profile", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
