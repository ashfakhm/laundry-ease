import { getDb } from "@/lib/mongodb";
import bcrypt from "bcrypt";
import { logger } from "@/lib/logger";
import { updateSeekerProfileSchema } from "@/lib/api/schemas";
import { ObjectId } from "mongodb";
import { requireSeeker } from "@/lib/api/auth";
import { AppError, ErrorCode } from "@/lib/api/errors";
import {
  isStrongPassword,
  PASSWORD_POLICY_MESSAGE,
} from "@/lib/auth/password-policy";
import { successResponse, errorResponse } from "@/lib/api/response";

/**
 * GET /api/profile/seeker
 * Fetch seeker's profile information
 */
export async function GET() {
  try {
    const { user } = await requireSeeker();
    if (!ObjectId.isValid(user.id)) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized");
    }

    const { db } = await getDb();
    const seekerId = new ObjectId(user.id);
    const seeker = await db.collection("seekers").findOne(
      { _id: seekerId },
      {
        projection: {
          passwordHash: 0,
        },
      },
    );

    if (!seeker) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Seeker not found");
    }

    return successResponse(seeker);
  } catch (error) {
    logger.error("PROFILE", "Error fetching seeker profile", error);
    return errorResponse(error);
  }
}

/**
 * PUT /api/profile/seeker
 * Update seeker's profile
 */
export async function PUT(req: Request) {
  try {
    const { user } = await requireSeeker();
    if (!ObjectId.isValid(user.id)) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized");
    }

    const json = await req.json();
    const parsed = updateSeekerProfileSchema.safeParse(json);

    if (!parsed.success) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "Invalid data",
        parsed.error.flatten().fieldErrors,
      );
    }

    const { db } = await getDb();
    const seekerFilter = { _id: new ObjectId(user.id) };

    const { name, phone, address, coordinates, currentPassword, newPassword } =
      parsed.data;
    const updates: Record<string, unknown> = {};

    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (address) updates.address = address;
    if (coordinates) updates.coordinates = coordinates;

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

      // Fetch current password hash (explicitly requested as it's usually excluded)
      const userDoc = await db
        .collection("seekers")
        .findOne(seekerFilter, { projection: { passwordHash: 1 } });

      if (!userDoc || !userDoc.passwordHash) {
        // If user has no password set (e.g. Google auth only), we might allow setting one directly?
        // For now, adhere to strict security: if they have a DB entry but no password, they likely shouldn't be setting one this way without a different flow.
        // However, let's assume standard email/pass flow:
        throw new AppError(
          ErrorCode.NOT_FOUND,
          404,
          "User not found or no password set",
        );
      }

      const isMatch = await bcrypt.compare(
        currentPassword,
        userDoc.passwordHash,
      );
      if (!isMatch) {
        throw new AppError(
          ErrorCode.UNAUTHORIZED,
          401,
          "Incorrect current password",
        );
      }

      const { BCRYPT_SALT_ROUNDS } = await import("@/lib/constants");
      updates.passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    }

    if (Object.keys(updates).length === 0) {
      return successResponse({ message: "No changes provided" });
    }

    const res = await db
      .collection("seekers")
      .updateOne(seekerFilter, { $set: updates });

    if (res.matchedCount === 0) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Seeker not found");
    }

    return successResponse({ message: "Profile updated successfully" });
  } catch (error) {
    logger.error("PROFILE", "Error updating seeker profile", error);
    return errorResponse(error);
  }
}
