import { successResponse, errorResponse } from "@/lib/api/response";
import { getBookingById, acceptBookingWithCapacityCheck } from "@/lib/db/index";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { requireProvider } from "@/lib/api/auth";
import {
  createRazorpayContact,
  createRazorpayFundAccount,
} from "@/lib/razorpay";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import {
  PLATFORM_COMMISSION_RATE,
  RATE_LIMIT_STRICT_WINDOW_MS,
} from "@/lib/constants";

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
      windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
    });

    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );
    }

    const { db } = await getDb();
    const provider = await db
      .collection("providers")
      .findOne({ _id: new ObjectId(user.id) });

    if (!provider) {
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "Provider not found"),
      );
    }

    if (!ObjectId.isValid(id)) {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid booking id"),
      );
    }
    const booking_id = new ObjectId(id);

    const booking = await getBookingById(booking_id);

    if (!booking) {
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found"),
      );
    }

    // Ensure booking fee is paid before accepting
    if (booking.bookingFeeStatus !== "paid") {
      return errorResponse(
        new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "Booking fee must be paid before provider can accept",
        ),
      );
    }

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
          logger.error("BOOKINGS", "Auto-sync Razorpay failed", err, {
            bookingId: id,
            providerId: provider._id,
          });
          return errorResponse(
            new AppError(
              ErrorCode.VALIDATION_ERROR,
              400,
              "Payment setup failed. Please verify your bank details and try again.",
            ),
          );
        }
      } else {
        return errorResponse(
          new AppError(
            ErrorCode.VALIDATION_ERROR,
            400,
            "You must complete your Payment/Bank Details in Profile before accepting bookings.",
          ),
        );
      }
    }

    // Commission Calculation
    const bookingFee = booking.bookingFee || 0;
    const platform_commission = bookingFee * PLATFORM_COMMISSION_RATE;
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
        return successResponse({ message: "Booking accepted" });
      } else {
        return errorResponse(
          new AppError(
            ErrorCode.INTERNAL_ERROR,
            500,
            "Failed to accept booking",
          ),
        );
      }
    } catch (error) {
      // Handle specific error types from the atomic operation
      if (error instanceof Error) {
        if (error.message.startsWith("BOOKING_NOT_FOUND:")) {
          return errorResponse(
            new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found"),
          );
        }
        if (error.message.startsWith("UNAUTHORIZED:")) {
          return errorResponse(
            new AppError(
              ErrorCode.NOT_FOUND, 404, "Provider not found",
            ),
          );
        }
        if (error.message.startsWith("ALREADY_PROCESSED:")) {
          return errorResponse(
            new AppError(
              ErrorCode.VALIDATION_ERROR,
              400,
              "Booking has already been acted upon",
            ),
          );
        }
        if (error.message.startsWith("CAPACITY_EXCEEDED:")) {
          return errorResponse(
            new AppError(
              ErrorCode.VALIDATION_ERROR,
              400,
              "Provider has reached maximum booking capacity",
            ),
          );
        }
        if (error.message.startsWith("PAYMENT_NOT_SETTLED:")) {
          return errorResponse(
            new AppError(
              ErrorCode.CONFLICT,
              409,
              "Booking payment has not been settled yet",
            ),
          );
        }
        if (error.message.startsWith("REFUND_IN_PROGRESS:")) {
          return errorResponse(
            new AppError(
              ErrorCode.CONFLICT,
              409,
              "A refund is currently being processed for this booking",
            ),
          );
        }
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("BOOKINGS", "Error accepting booking", error, {
      bookingId: id,
    });
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"),
    );
  }
}
