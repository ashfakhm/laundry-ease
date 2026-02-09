import { describe, expect, it } from "vitest";
import {
  adminComplaintResolveSchema,
  adminRefundSchema,
  complaintMessageSchema,
  paymentVerifySchema,
} from "./schemas";

const ORDER_ID = "507f1f77bcf86cd799439011";
const BOOKING_ID = "507f1f77bcf86cd799439012";

describe("api schema contracts", () => {
  describe("adminRefundSchema", () => {
    it("accepts booking-targeted refunds", () => {
      const result = adminRefundSchema.safeParse({
        paymentId: "pay_123",
        bookingId: BOOKING_ID,
        reason: "Provider cancelled before service",
      });
      expect(result.success).toBe(true);
    });

    it("accepts order-targeted refunds", () => {
      const result = adminRefundSchema.safeParse({
        paymentId: "pay_123",
        orderId: ORDER_ID,
        amount: 499,
        reason: "Escrow reversal due to dispute resolution",
      });
      expect(result.success).toBe(true);
    });

    it("rejects payloads with both bookingId and orderId", () => {
      const result = adminRefundSchema.safeParse({
        paymentId: "pay_123",
        bookingId: BOOKING_ID,
        orderId: ORDER_ID,
        reason: "Invalid target combination",
      });
      expect(result.success).toBe(false);
    });

    it("rejects payloads with neither bookingId nor orderId", () => {
      const result = adminRefundSchema.safeParse({
        paymentId: "pay_123",
        reason: "Missing target",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("adminComplaintResolveSchema", () => {
    it("accepts split settlement payload with seeker refund amount", () => {
      const result = adminComplaintResolveSchema.safeParse({
        outcome: "refund_partial",
        seeker_refund_amount: 149.5,
      });

      expect(result.success).toBe(true);
    });

    it("rejects split settlement payload without seeker refund amount", () => {
      const result = adminComplaintResolveSchema.safeParse({
        outcome: "refund_partial",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("paymentVerifySchema", () => {
    it("accepts canonical snake_case payment verify payload", () => {
      const result = paymentVerifySchema.safeParse({
        razorpay_order_id: "order_abc",
        razorpay_payment_id: "pay_abc",
        razorpay_signature: "sig_abc",
      });
      expect(result.success).toBe(true);
    });

    it("rejects incomplete payment verify payload", () => {
      const result = paymentVerifySchema.safeParse({
        razorpay_order_id: "order_abc",
        razorpay_payment_id: "pay_abc",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("complaintMessageSchema", () => {
    it("accepts valid text messages with optional attachments", () => {
      const result = complaintMessageSchema.safeParse({
        content: "Please review the attached issue photo.",
        attachments: ["https://example.com/evidence.jpg"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects more than 5 attachments", () => {
      const result = complaintMessageSchema.safeParse({
        content: "Too many files",
        attachments: [
          "https://example.com/1.jpg",
          "https://example.com/2.jpg",
          "https://example.com/3.jpg",
          "https://example.com/4.jpg",
          "https://example.com/5.jpg",
          "https://example.com/6.jpg",
        ],
      });
      expect(result.success).toBe(false);
    });
  });
});
