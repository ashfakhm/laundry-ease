/**
 * Syncs provider bank details with Razorpay (contact + fund account creation).
 * Returns additional fields to merge into the provider update.
 */

import { ObjectId, type Db } from "mongodb";
import {
  createRazorpayContact,
  createRazorpayFundAccount,
} from "@/lib/razorpay";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";
import type { Provider } from "@/types/users";

export interface BankSyncInput {
  providerId: ObjectId;
  email: string;
  /** Fields being updated on the provider (mutated in-place to add Razorpay IDs + masked account) */
  updateFields: Record<string, unknown>;
}

/**
 * Creates/updates Razorpay contact + fund account when bank details change.
 * Mutates `updateFields` in-place to add:
 * - `razorpay_contact_id` (if newly created)
 * - `razorpay_fund_account_id` (if bank account linked)
 * - Truncated `bankDetails.accountNumber`
 *
 * Throws AppError on Razorpay failure so the user knows bank sync failed.
 */
export async function syncBankDetailsWithRazorpay(
  db: Db,
  input: BankSyncInput,
): Promise<void> {
  const { providerId, email, updateFields } = input;

  const currentProvider = await db
    .collection<Provider>("providers")
    .findOne({ _id: providerId });

  if (!currentProvider) return;

  const contactName =
    (updateFields.name as string) || currentProvider.name || "Provider";
  const contactPhone =
    (updateFields.phone as string) || currentProvider.phone || "";

  let contactId = currentProvider.razorpay_contact_id;

  // 1. Create Contact if missing
  if (!contactId && contactPhone) {
    const contact = await createRazorpayContact({
      name: contactName,
      email,
      contact: contactPhone,
      type: "vendor",
      reference_id: currentProvider._id?.toString(),
    });
    contactId = contact.id;
    updateFields.razorpay_contact_id = contactId;
  }

  // 2. Create Fund Account (bank) ONLY if explicit, unmasked changes are provided
  const hasUnmaskedValue = (val: unknown) => 
    typeof val === "string" && !val.includes("*") && !val.includes("X") && val.trim() !== "";

  const accName = updateFields["bankDetails.accountHolderName"] as string;
  const accNumber = updateFields["bankDetails.accountNumber"] as string;
  const accIfsc = updateFields["bankDetails.ifsc"] as string;

  const shouldSyncFund = 
    hasUnmaskedValue(accNumber) && 
    hasUnmaskedValue(accIfsc) && 
    (hasUnmaskedValue(accName) || currentProvider.bankDetails?.accountHolderName);

  if (contactId && shouldSyncFund) {
    const finalName = accName || currentProvider.bankDetails?.accountHolderName || contactName;
    
    const fundAccount = await createRazorpayFundAccount({
      contact_id: contactId,
      account_type: "bank_account",
      bank_account: {
        name: finalName,
        account_number: accNumber,
        ifsc: accIfsc,
      },
    });
    updateFields.razorpay_fund_account_id = fundAccount.id;

    // Truncate view of account number locally since Razorpay stores the real one
    if (updateFields["bankDetails.accountNumber"]) {
      const str = String(updateFields["bankDetails.accountNumber"]);
      updateFields["bankDetails.accountNumber"] =
        "X".repeat(Math.max(0, str.length - 4)) + str.slice(-4);
    }
  }
}

/**
 * Wraps `syncBankDetailsWithRazorpay` with error logging and a user-facing AppError.
 */
export async function syncBankDetailsOrFail(
  db: Db,
  input: BankSyncInput,
): Promise<void> {
  try {
    await syncBankDetailsWithRazorpay(db, input);
  } catch (e: unknown) {
    const err = e as Error;
    logger.error("PROFILE", "Razorpay sync error during profile update", err, {
      email: input.email,
    });
    throw new AppError(
      ErrorCode.INVALID_STATE_TRANSITION,
      500,
      "Failed to sync bank details with payment gateway",
    );
  }
}
