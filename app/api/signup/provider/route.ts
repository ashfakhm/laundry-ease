import { successResponse, errorResponse } from "@/lib/api/response";
import { NextRequest } from "next/server";
import { RATE_LIMIT_AUTH_WINDOW_MS } from "@/lib/constants";
import { emailExists, createProvider } from "@/lib/db/index";
import { isOtpVerifiedRecently } from "@/lib/otp";
import { signupProviderSchema } from "@/lib/api/schemas";
import {
  createRazorpayContact,
  createRazorpayFundAccount,
} from "@/lib/razorpay";
import { Provider } from "@/types/users";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";

export async function POST(req: NextRequest) {
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "auth:signup:provider:ip",
      max: 8,
      windowMs: RATE_LIMIT_AUTH_WINDOW_MS,
    });

    const payload = await req.json();
    const parsed = signupProviderSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid data", parsed),
      );
    }
    const {
      name,
      email,
      password,
      phone,
      businessName,
      bio,
      description,
      services,
      location,
      radius_km,
      per_km_rate,
      pricing,
      pricingRates,
      bankAccountHolder,
      bankAccountNumber,
      bankIFSC,
      upiId,
      profilePicture,
      bannerImage,
      coordinates,
    } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Require verified OTP for email
    const emailOk = await isOtpVerifiedRecently(normalizedEmail, "email");
    if (!emailOk) {
      return errorResponse(
        new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "Email must be verified via OTP",
        ),
      );
    }

    const exists = await emailExists(normalizedEmail);
    if (exists) {
      return errorResponse(
        new AppError(ErrorCode.CONFLICT, 409, "Email already in use"),
      );
    }

    await createProvider({
      email: normalizedEmail,
      name,
      password,
      phone,
      businessName,
      bio,
      description,
      pricingRates,
      services,
      location,
      radius_km,
      per_km_rate,
      pricing,
      coordinates,
      profilePicture,
      bannerImage,
      bankDetails: {
        accountHolderName: bankAccountHolder,
        accountNumber: bankAccountNumber,
        ifsc: bankIFSC,
        upiId: upiId || undefined,
      },
    });

    // --- Razorpay Sync ---
    try {
      const { db } = await getDb();
      const newProvider = await db
        .collection<Provider>("providers")
        .findOne({ email: normalizedEmail });

      if (newProvider) {
        // 1. Create Contact
        const contact = await createRazorpayContact({
          name: name || businessName || "Provider",
          email: normalizedEmail,
          contact: phone || "",
          type: "vendor",
          reference_id: newProvider._id?.toString(),
        });

        if (contact && contact.id) {
          let fundAccountId = null;

          // 2. Create Fund Account
          if (bankAccountHolder && bankAccountNumber && bankIFSC) {
            const fundAccount = await createRazorpayFundAccount({
              contact_id: contact.id,
              account_type: "bank_account",
              bank_account: {
                name: bankAccountHolder,
                account_number: bankAccountNumber,
                ifsc: bankIFSC,
              },
            });
            fundAccountId = fundAccount.id;
          }

          // 3. Update Provider with Razorpay IDs
          if (fundAccountId) {
            await db.collection("providers").updateOne(
              { email: normalizedEmail },
              {
                $set: {
                  razorpay_contact_id: contact.id,
                  razorpay_fund_account_id: fundAccountId,
                },
              },
            );
          }
        }
      }
    } catch (error) {
      logger.error(
        "SIGNUP",
        "Error syncing with Razorpay during signup",
        error,
        {
          email: normalizedEmail,
        },
      );
      // Keep signup successful even if Razorpay sync fails.
    }
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("SIGNUP", "Provider signup failed", error);
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Failed to create account"),
    );
  }

  return successResponse(
    {
      success: true,
    },
    200,
  );
}
