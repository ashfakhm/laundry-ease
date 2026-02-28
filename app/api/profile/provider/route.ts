import { maskBankDetails } from "@/lib/utils";
import { getDb } from "@/lib/mongodb";
import { requireProvider } from "@/lib/api/auth";
import {
  createRazorpayContact,
  createRazorpayFundAccount,
} from "@/lib/razorpay";
import { Provider } from "@/types/users";
import { logger } from "@/lib/logger";
import { updateProviderProfileSchema } from "@/lib/api/schemas";
import {
  isStrongPassword,
  PASSWORD_POLICY_MESSAGE,
} from "@/lib/auth/password-policy";
import { AppError, ErrorCode } from "@/lib/api/errors";
import bcrypt from "bcrypt";
import { ObjectId } from "mongodb";
import { successResponse, errorResponse } from "@/lib/api/response";

/**
 * GET /api/profile/provider
 * Get the logged-in provider's profile
 */
export async function GET() {
  try {
    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized");
    }

    const { db } = await getDb();
    const providerId = new ObjectId(user.id);
    const provider = await db.collection("providers").findOne(
      { _id: providerId },
      {
        projection: {
          passwordHash: 0, // Exclude sensitive data
          emailVerified: 0,
          phoneVerified: 0,
        },
      },
    );

    if (!provider) {
      throw new AppError(
        ErrorCode.PROVIDER_NOT_FOUND,
        404,
        "Provider profile not found",
      );
    }

    // Mask bank details before returning by creating a safe copy for the response

    const safeProvider = {
      ...provider,
      bankDetails: provider.bankDetails
        ? maskBankDetails(provider.bankDetails)
        : undefined,
    };

    return successResponse(safeProvider);
  } catch (error) {
    logger.error("PROFILE", "Error fetching provider profile", error);
    return errorResponse(error);
  }
}

/**
 * PATCH /api/profile/provider
 * Update the logged-in provider's profile
 */
export async function PATCH(req: Request) {
  try {
    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized");
    }
    const providerId = new ObjectId(user.id);

    const body = await req.json();
    const parsed = updateProviderProfileSchema.safeParse(body);

    if (!parsed.success) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "Invalid data",
        parsed.error.flatten().fieldErrors,
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
    if (coordinates !== undefined) {
      updateFields.coordinates = coordinates;
      updateFields.locationGeoJSON = {
        type: "Point",
        coordinates: [coordinates.lng, coordinates.lat],
      };
    }
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
          .findOne({ _id: providerId });

        if (currentProvider) {
          const contactName =
            (updateFields.name as string) || currentProvider.name || "Provider";
          const contactEmail = user.email;
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

            // Truncate the bank account number locally since we've secured it in Razorpay
            if (updateFields["bankDetails.accountNumber"]) {
              const str = String(updateFields["bankDetails.accountNumber"]);
              updateFields["bankDetails.accountNumber"] =
                "X".repeat(Math.max(0, str.length - 4)) + str.slice(-4);
            }
          }
        }
      } catch (e: unknown) {
        const err = e as Error;
        logger.error(
          "PROFILE",
          "Razorpay sync error during profile update",
          err,
          { email: user.email },
        );
        // Fail the request if critical bank details sync fails so user knows
        throw new AppError(
          ErrorCode.INVALID_STATE_TRANSITION,
          500,
          "Failed to sync bank details with payment gateway",
        );
      }
    }

    const { db } = await getDb();

    // Secure Password Change Logic
    if (newPassword) {
      if (!isStrongPassword(newPassword)) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          PASSWORD_POLICY_MESSAGE,
        );
      }

      if (!currentPassword) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "Current password is required to set a new password",
        );
      }

      const provider = await db
        .collection("providers")
        .findOne({ _id: providerId }, { projection: { passwordHash: 1 } });

      if (!provider || !provider.passwordHash) {
        throw new AppError(
          ErrorCode.PROVIDER_NOT_FOUND,
          404,
          "Provider not found or no password set",
        );
      }

      const isMatch = await bcrypt.compare(
        currentPassword,
        provider.passwordHash,
      );
      if (!isMatch) {
        throw new AppError(
          ErrorCode.UNAUTHORIZED,
          401,
          "Incorrect current password",
        );
      }

      const { BCRYPT_SALT_ROUNDS } = await import("@/lib/constants");
      updateFields.passwordHash = await bcrypt.hash(
        newPassword,
        BCRYPT_SALT_ROUNDS,
      );
    }

    if (Object.keys(updateFields).length === 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "No fields to update",
      );
    }

    const result = await db
      .collection("providers")
      .findOneAndUpdate(
        { _id: providerId },
        { $set: updateFields },
        { returnDocument: "after", projection: { passwordHash: 0 } },
      );

    if (!result) {
      throw new AppError(
        ErrorCode.PROVIDER_NOT_FOUND,
        404,
        "Provider not found",
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
            },
          )
        : undefined,
    } as unknown;

    return successResponse(safeUpdated);
  } catch (error) {
    logger.error("PROFILE", "Error updating provider profile", error);
    return errorResponse(error);
  }
}
