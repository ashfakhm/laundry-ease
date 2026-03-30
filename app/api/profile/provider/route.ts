import { maskBankDetails } from "@/lib/utils";
import { enqueueEmailOutboxJob } from "@/lib/email-outbox";
import { getDb } from "@/lib/mongodb";
import { requireProvider } from "@/lib/api/auth";
import { Provider } from "@/types/users";
import { logger } from "@/lib/logger";
import { updateProviderProfileSchema } from "@/lib/api/schemas";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { ObjectId } from "mongodb";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/security";
import { syncBankDetailsOrFail } from "@/lib/services/provider-bank-sync";
import { verifyAndHashPassword } from "@/lib/services/provider-password";
import { buildProviderAvailabilitySummary } from "@/lib/services/provider-availability";
import { z } from "zod";
import { Role } from "@/types/enums";
import bcrypt from "bcrypt";
import { checkDeletionBlockers, softDeleteAccount } from "@/lib/services/account-deletion";

const deleteProfileSchema = z.object({
  currentPassword: z.string().optional(),
});
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
    const provider = await db.collection<Provider>("providers").findOne(
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
      availability: buildProviderAvailabilitySummary(provider),
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
    await requireSameOrigin(req);
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
    const isMasked = (val: unknown) => 
      typeof val === "string" && (val.includes("*") || val.includes("X"));

    let hasBankUpdate = false;

    if (bankAccountHolder !== undefined) {
      updateFields["bankDetails.accountHolderName"] = bankAccountHolder;
      hasBankUpdate = true;
    }
    if (bankAccountNumber !== undefined && !isMasked(bankAccountNumber)) {
      updateFields["bankDetails.accountNumber"] = bankAccountNumber;
      hasBankUpdate = true;
    }
    if (bankIFSC !== undefined && !isMasked(bankIFSC)) {
      updateFields["bankDetails.ifsc"] = bankIFSC;
      hasBankUpdate = true;
    }
    if (upiId !== undefined && !isMasked(upiId)) {
      updateFields["bankDetails.upiId"] = upiId;
    }

    if (hasBankUpdate) {
      const { db: bankDb } = await getDb();
      await syncBankDetailsOrFail(bankDb, {
        providerId,
        email: user.email,
        updateFields,
      });
    }

    const { db } = await getDb();

    // Secure Password Change Logic
    if (newPassword) {
      updateFields.passwordHash = await verifyAndHashPassword(
        db,
        providerId,
        currentPassword,
        newPassword,
      );
      updateFields.passwordChangedAt = new Date();
    }

    if (Object.keys(updateFields).length === 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "No fields to update",
      );
    }

    updateFields.updatedAt = new Date();

    const result = await db
      .collection<Provider>("providers")
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

    // Send "password changed" security notification email when password changes.
    if (updateFields.passwordChangedAt) {
      try {
        await enqueueEmailOutboxJob({
          kind: "password_changed",
          payload: {
            to: user.email,
            changedAt: (updateFields.passwordChangedAt as Date).toISOString(),
          },
        });
      } catch (emailErr) {
        // Don't fail the profile update if the notification fails to enqueue.
        logger.error(
          "PROFILE",
          "Failed to enqueue password-changed email for provider",
          emailErr,
        );
      }
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
      availability: buildProviderAvailabilitySummary(updated as Provider),
    } as unknown;

    return successResponse(safeUpdated);
  } catch (error) {
    logger.error("PROFILE", "Error updating provider profile", error);
    return errorResponse(error);
  }
}

/**
 * DELETE /api/profile/provider
 * Soft delete provider's profile
 */
export async function DELETE(req: Request) {
  try {
    await requireSameOrigin(req);
    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized");
    }

    const { db } = await getDb();
    const providerId = new ObjectId(user.id);
    
    // Check if the user has a password set
    const userDoc = await db
      .collection("providers")
      .findOne({ _id: providerId }, { projection: { passwordHash: 1 } });
      
    if (!userDoc) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Provider not found");
    }

    // Require password confirmation only if user has a password set
    if (userDoc.passwordHash) {
      const json = await req.json().catch(() => ({}));
      const parsed = deleteProfileSchema.safeParse(json);
      
      if (!parsed.success) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "Invalid data",
          parsed.error.flatten().fieldErrors,
        );
      }
      
      const { currentPassword } = parsed.data;
      
      if (!currentPassword) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "Current password is required to delete your account",
        );
      }
      
      const isMatch = await bcrypt.compare(currentPassword, userDoc.passwordHash);
      if (!isMatch) {
         throw new AppError(
          ErrorCode.UNAUTHORIZED,
          401,
          "Incorrect current password",
        );
      }
    }

    const blockers = await checkDeletionBlockers(user.id, Role.PROVIDER);
    if (blockers.length > 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        409,
        "Cannot delete account due to active items",
        { blockers }
      );
    }
    
    const success = await softDeleteAccount(user.id, Role.PROVIDER, "self");
    if (!success) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, 500, "Failed to delete account");
    }

    return successResponse({ message: "Account successfully deleted" });
  } catch (error) {
    logger.error("PROFILE", "Error deleting provider profile", error);
    return errorResponse(error);
  }
}
