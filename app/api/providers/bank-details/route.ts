import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { Provider } from "@/types/users";
import {
  createRazorpayContact,
  createRazorpayFundAccount,
} from "@/lib/razorpay";
import { ObjectId } from "mongodb";
import { requireProvider } from "@/lib/api/auth";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { successResponse, errorResponse } from "@/lib/api/response";
import { AppError, ErrorCode } from "@/lib/api/errors";

const bankDetailsPayloadSchema = z.object({
  bankDetails: z.object({
    accountHolderName: z
      .string()
      .trim()
      .min(2, "Account holder name is required"),
    accountNumber: z.string().trim().min(6, "Account number is required"),
    ifsc: z
      .string()
      .trim()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i, "Invalid IFSC code"),
    upiId: z.string().trim().optional(),
  }),
});

export async function POST(req: NextRequest) {
  try {
    // Authentication check - only providers can update bank details
    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"));
    }

    const payload = await req.json().catch(() => null);
    const parsed = bankDetailsPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: "Missing or invalid bank details",
        details: parsed.error.flatten().fieldErrors
      }, {
        status: 400
      });
    }
    const { bankDetails } = parsed.data;

    const { db } = await getDb();
    // Use the authenticated user's ID, not from request body (security fix)
    const provider = await db
      .collection<Provider>("providers")
      .findOne({ _id: new ObjectId(user.id) });

    if (!provider) {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Provider not found"));
    }

    // 1. Create Contact in RazorpayX
    const contact = await createRazorpayContact({
      name: provider.name || provider.businessName || "Provider",
      email: provider.email,
      contact: provider.phone || "",
      type: "vendor",
      reference_id: provider._id?.toString(),
    });

    if (!contact || !contact.id) {
      throw new Error("Failed to create Razorpay Contact");
    }

    // 2. Create Fund Account in RazorpayX
    const fundAccount = await createRazorpayFundAccount({
      contact_id: contact.id,
      account_type: "bank_account",
      bank_account: {
        name: bankDetails.accountHolderName,
        ifsc: bankDetails.ifsc,
        account_number: bankDetails.accountNumber,
      },
    });

    if (!fundAccount || !fundAccount.id) {
      throw new Error("Failed to create Razorpay Fund Account");
    }

    // 3. Save to DB
    await db.collection<Provider>("providers").updateOne(
      { _id: new ObjectId(user.id) },
      {
        $set: {
          bankDetails: bankDetails,
          razorpay_contact_id: contact.id,
          razorpay_fund_account_id: fundAccount.id,
        },
      },
    );

    return successResponse({ message: "Bank details saved and linked to Razorpay" });
  } catch (error: unknown) {
    logger.error("PROVIDER", "Error saving bank details", error);
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Failed to save bank details"));
  }
}
