import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { Provider } from "@/lib/db";
import { createRazorpayContact, createRazorpayFundAccount } from "@/lib/razorpay";
import { ObjectId } from "mongodb";
// import { auth } from "@/auth"; // Assuming auth is handled via some middleware or library

export async function POST(req: NextRequest) {
    try {
        // TODO: Add proper authentication check here
        // const session = await auth();
        // if (!session || session.user.role !== 'provider') return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { providerId, bankDetails } = await req.json();

        if (!providerId || !bankDetails) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const { db } = await getDb();
        const provider = await db.collection<Provider>("providers").findOne({ _id: new ObjectId(providerId) });

        if (!provider) {
            return NextResponse.json({ error: "Provider not found" }, { status: 404 });
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
            { _id: new ObjectId(providerId) },
            {
                $set: {
                    bankDetails: bankDetails,
                    razorpay_contact_id: contact.id,
                    razorpay_fund_account_id: fundAccount.id,
                },
            }
        );

        return NextResponse.json({ success: true, message: "Bank details saved and linked to Razorpay" });

    } catch (error: any) {
        console.error("Error saving bank details:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
