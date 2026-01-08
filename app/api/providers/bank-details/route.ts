import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { Provider } from "@/lib/db";
import {
  createRazorpayContact,
  createRazorpayFundAccount,
} from "@/lib/razorpay";
import { ObjectId } from "mongodb";
import { requireProvider } from "@/lib/api/auth";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    // Authentication check - only providers can update bank details
    const { user } = await requireProvider();

    const { bankDetails } = await req.json();

    if (!bankDetails) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { db } = await getDb();
    // Use the authenticated user's ID, not from request body (security fix)
    const provider = await db
      .collection<Provider>("providers")
      .findOne({ _id: new ObjectId(user.id) });

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
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
      }
    );

    return NextResponse.json({
      success: true,
      message: "Bank details saved and linked to Razorpay",
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    logger.error("PROVIDER", "Error saving bank details", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
