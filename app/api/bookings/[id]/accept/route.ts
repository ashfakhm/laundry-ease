import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getBookingById, acceptBookingWithCapacityCheck } from "@/lib/db";
import { Role } from "@/types/enums";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import {
  createRazorpayContact,
  createRazorpayFundAccount,
} from "@/lib/razorpay";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "bookings:accept",
      max: 25,
      windowMs: 5 * 60 * 1000,
    });

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
        { status: 404 },
      );
    }

    let booking_id: ObjectId;
    try {
      booking_id = new ObjectId(id);
    } catch {
      return NextResponse.json({ message: "Invalid booking id" }, { status: 400 });
    }

    // Get booking to calculate commission
    const booking = await getBookingById(booking_id);

    if (!booking) {
      return NextResponse.json(
        { message: "Booking not found" },
        { status: 404 },
      );
    }

    // Ensure booking fee is paid before accepting
    if (booking.bookingFeeStatus !== "paid") {
      return NextResponse.json(
        { message: "Booking fee must be paid before provider can accept" },
        { status: 400 },
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
            },
          );
          // Proceed with acceptance
        } catch (err: unknown) {
          const errorMessage =
            err instanceof Error
              ? err.message
              : "Invalid Bank Details/API Keys";
          logger.error("BOOKINGS", "Auto-sync Razorpay failed", err, {
            bookingId: id,
            providerId: provider._id,
          });
          return NextResponse.json(
            {
              message: `Payment Setup Failed: ${errorMessage}`,
            },
            { status: 400 },
          );
        }
      } else {
        return NextResponse.json(
          {
            message:
              "You must complete your Payment/Bank Details in Profile before accepting bookings.",
          },
          { status: 400 },
        );
      }
    }

    // Commission Calculation
    const bookingFee = booking.bookingFee || 0;
    const platform_commission = bookingFee * 0.05; // 5%
    const provider_payout_amount = bookingFee - platform_commission; // 95%
    const maxCapacity = provider.capacity ?? 100;

    // Atomic accept with capacity check using transaction
    // Prevents race condition where multiple accepts could exceed capacity
    try {
      const updatedBooking = await acceptBookingWithCapacityCheck({
        booking_id,
        provider_id: provider._id,
        maxCapacity,
        platform_commission,
        provider_payout_amount,
      });

      if (updatedBooking) {
        return NextResponse.json({ message: "Booking accepted" });
      } else {
        return NextResponse.json(
          { message: "Failed to accept booking" },
          { status: 500 },
        );
      }
    } catch (error) {
      // Handle specific error types from the atomic operation
      if (error instanceof Error) {
        if (error.message.startsWith("BOOKING_NOT_FOUND:")) {
          return NextResponse.json(
            { message: "Booking not found" },
            { status: 404 },
          );
        }
        if (error.message.startsWith("UNAUTHORIZED:")) {
          return NextResponse.json(
            { message: "You are not authorized to accept this booking" },
            { status: 403 },
          );
        }
        if (error.message.startsWith("ALREADY_PROCESSED:")) {
          return NextResponse.json(
            { message: "Booking has already been acted upon" },
            { status: 400 },
          );
        }
        if (error.message.startsWith("CAPACITY_EXCEEDED:")) {
          return NextResponse.json(
            { message: error.message.replace("CAPACITY_EXCEEDED:", "") },
            { status: 400 },
          );
        }
        if (error.message.startsWith("PAYMENT_NOT_SETTLED:")) {
          return NextResponse.json(
            { message: error.message.replace("PAYMENT_NOT_SETTLED:", "") },
            { status: 409 },
          );
        }
        if (error.message.startsWith("REFUND_IN_PROGRESS:")) {
          return NextResponse.json(
            { message: error.message.replace("REFUND_IN_PROGRESS:", "") },
            { status: 409 },
          );
        }
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.statusCode },
      );
    }

    logger.error("BOOKINGS", "Error accepting booking", error, {
      bookingId: id,
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
