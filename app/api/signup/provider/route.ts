import { NextRequest, NextResponse } from "next/server";
import { emailExists, createProvider } from "@/lib/db";
import { isOtpVerifiedRecently } from "@/lib/otp";
import { signupProviderSchema } from "@/lib/api/schemas";
import {
  createRazorpayContact,
  createRazorpayFundAccount,
} from "@/lib/razorpay";
import { Provider } from "@/lib/db";
import { getDb } from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const parsed = signupProviderSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
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

  // Require verified OTPs for email and phone
  const emailOk = await isOtpVerifiedRecently(email, "email");
  const phoneOk = await isOtpVerifiedRecently(phone, "phone");
  if (!emailOk || !phoneOk) {
    return NextResponse.json(
      { error: "Email and phone must be verified via OTP" },
      { status: 400 }
    );
  }

  // Check if email already exists in any collection
  const exists = await emailExists(email);
  if (exists) {
    return NextResponse.json(
      { error: "Email already in use" },
      { status: 409 }
    );
  }

  // Create provider in providers collection
  await createProvider({
    email,
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
      .findOne({ email });

    if (newProvider) {
      // 1. Create Contact
      const contact = await createRazorpayContact({
        name: name || businessName || "Provider",
        email: email,
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
            { email },
            {
              $set: {
                razorpay_contact_id: contact.id,
                razorpay_fund_account_id: fundAccountId,
              },
            }
          );
        }
      }
    }
  } catch (error) {
    console.error("Error syncing with Razorpay during signup:", error);
    // We do NOT fail the signup here, just log it.
    // They can retry syncing by updating their profile later.
  }

  return NextResponse.json({ ok: true });
}
