import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getBookingById, updateBookingStatus } from "@/lib/db";
import { Role } from "@/types/enums";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import {
  createRazorpayContact,
  createRazorpayFundAccount,
} from "@/lib/razorpay";
import { logger } from "@/lib/logger";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || session.user.role !== Role.PROVIDER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();

    // Get provider by email
    const provider = await db
      .collection("providers")
      .findOne({ email: session.user.email });

    if (!provider) {
      return NextResponse.json(
        { message: "Provider not found" },
        { status: 404 }
      );
    }

    // Enforce provider capacity
    const activeBookingsCount = await db.collection("bookings").countDocuments({
      provider_id: provider._id,
      status: { $in: ["accepted", "pickup_proposed", "confirmed"] },
    });
    const maxCapacity = provider.capacity ?? 5;
    if (activeBookingsCount >= maxCapacity) {
      return NextResponse.json(
        {
          message: `You are at your maximum capacity of ${maxCapacity} active bookings.`,
        },
        { status: 400 }
      );
    }

    const booking_id = new ObjectId(id);
    const booking = await getBookingById(booking_id);

    if (!booking) {
      return NextResponse.json(
        { message: "Booking not found" },
        { status: 404 }
      );
    }

    if (booking.provider_id.toString() !== provider._id.toString()) {
      return NextResponse.json(
        { message: "You are not authorized to accept this booking" },
        { status: 403 }
      );
    }

    if (booking.status !== "requested") {
      return NextResponse.json(
        { message: "Booking has already been acted upon" },
        { status: 400 }
      );
    }

    // Check for Provider Payment Details (Mandatory)
    if (!provider.razorpay_fund_account_id) {
      // Attempt to sync on-the-fly if details exist locally
      const { accountHolderName, accountNumber, ifsc } =
        provider.bankDetails || {};

      if (accountHolderName && accountNumber && ifsc) {
        try {
          // 1. Create Contact
          const contact = await createRazorpayContact({
            name: provider.name || provider.businessName || "Provider",
            email: provider.email,
            contact: provider.phone || "",
            type: "vendor",
            reference_id: provider._id.toString(),
          });

          // 2. Create Fund Account
          const fundAccount = await createRazorpayFundAccount({
            contact_id: contact.id,
            account_type: "bank_account",
            bank_account: {
              name: accountHolderName,
              account_number: accountNumber,
              ifsc: ifsc,
            },
          });

          // 3. Update Provider
          await db.collection("providers").updateOne(
            { _id: provider._id },
            {
              $set: {
                razorpay_contact_id: contact.id,
                razorpay_fund_account_id: fundAccount.id,
              },
            }
          );
          // Proceed with acceptance
        } catch (err: any) {
          logger.error("BOOKINGS", "Auto-sync Razorpay failed", err, {
            bookingId: id,
            providerId: provider._id,
          });
          return NextResponse.json(
            {
              message: `Payment Setup Failed: ${
                err.message || "Invalid Bank Details/API Keys"
              }`,
            },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          {
            message:
              "You must complete your Payment/Bank Details in Profile before accepting bookings.",
          },
          { status: 400 }
        );
      }
    }

    // Commission Calculation
    const bookingFee = booking.bookingFee || 0;
    const platform_commission = bookingFee * 0.05; // 5%
    const provider_payout_amount = bookingFee - platform_commission; // 95%

    const updateRes = await db.collection("bookings").updateOne(
      { _id: booking_id },
      {
        $set: {
          status: "accepted",
          platform_commission,
          provider_payout_amount,
          payout_status: "pending",
          updatedAt: new Date(),
        },
      }
    );
    const success = updateRes.modifiedCount > 0;

    if (success) {
      return NextResponse.json({ message: "Booking accepted" });
    } else {
      return NextResponse.json(
        { message: "Failed to accept booking" },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error("BOOKINGS", "Error accepting booking", error, {
      bookingId: id,
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
