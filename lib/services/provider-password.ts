/**
 * Secure password change logic for providers.
 */

import { ObjectId, type Db } from "mongodb";
import bcrypt from "bcrypt";
import { AppError, ErrorCode } from "@/lib/api/errors";
import {
  isStrongPassword,
  PASSWORD_POLICY_MESSAGE,
} from "@/lib/auth/password-policy";
import { BCRYPT_SALT_ROUNDS } from "@/lib/constants";

/**
 * Verifies current password and returns a bcrypt hash of the new password.
 * Throws AppError on policy violation, missing current password, or mismatch.
 */
export async function verifyAndHashPassword(
  db: Db,
  providerId: ObjectId,
  currentPassword: string | undefined,
  newPassword: string,
): Promise<string> {
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

  const isMatch = await bcrypt.compare(currentPassword, provider.passwordHash);
  if (!isMatch) {
    throw new AppError(
      ErrorCode.UNAUTHORIZED,
      401,
      "Incorrect current password",
    );
  }

  return bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
}
