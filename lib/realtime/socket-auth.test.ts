import { describe, expect, it } from "vitest";
import {
  authorizeBookingRoom,
  authorizeComplaintRoom,
  authorizeOrderRoom,
  resolveRealtimeUserFromToken,
} from "./socket-auth";

describe("socket auth helpers", () => {
  it("uses the token id and role when already canonical", async () => {
    const user = await resolveRealtimeUserFromToken(
      {
        id: "507f1f77bcf86cd799439011",
        role: "seeker",
        email: "seeker@laundryease.test",
      },
      {
        findUserByEmail: async () => null,
      },
    );

    expect(user).toEqual({
      id: "507f1f77bcf86cd799439011",
      role: "seeker",
      email: "seeker@laundryease.test",
    });
  });

  it("falls back to DB lookup when token metadata is incomplete", async () => {
    const user = await resolveRealtimeUserFromToken(
      {
        email: "provider@laundryease.test",
      },
      {
        findUserByEmail: async () => ({
          _id: "507f1f77bcf86cd799439012",
          email: "provider@laundryease.test",
          role: "provider",
        }),
      },
    );

    expect(user).toEqual({
      id: "507f1f77bcf86cd799439012",
      role: "provider",
      email: "provider@laundryease.test",
    });
  });

  it("authorizes booking rooms only for participants", async () => {
    const allowed = await authorizeBookingRoom(
      {
        bookingId: "507f1f77bcf86cd799439013",
        user: { id: "507f1f77bcf86cd799439011", role: "seeker" },
      },
      {
        findBookingById: async () => ({
          seeker_id: "507f1f77bcf86cd799439011",
          provider_id: "507f1f77bcf86cd799439012",
        }),
      },
    );

    const denied = await authorizeComplaintRoom(
      {
        complaintId: "507f1f77bcf86cd799439014",
        user: { id: "507f1f77bcf86cd799439012", role: "provider" },
      },
      {
        findComplaintById: async () => ({
          seekerId: "507f1f77bcf86cd799439011",
          providerId: "507f1f77bcf86cd799439012",
          providerAccessGranted: false,
          status: "accepted",
        }),
      },
    );

    expect(allowed).toEqual({
      ok: true,
      room: "booking:507f1f77bcf86cd799439013",
    });
    expect(denied).toEqual({
      ok: false,
      error: "Provider access has not been granted.",
    });
  });

  describe("authorizeOrderRoom", () => {
    const seekerUser = { id: "507f1f77bcf86cd799439011", role: "seeker" };
    const providerUser = { id: "507f1f77bcf86cd799439012", role: "provider" };
    const adminUser = { id: "507f1f77bcf86cd799439099", role: "admin" };
    const unrelatedUser = { id: "507f1f77bcf86cd799439088", role: "seeker" };
    const validOrderId = "507f1f77bcf86cd799439020";

    const mockOrder = {
      seeker_id: "507f1f77bcf86cd799439011",
      provider_id: "507f1f77bcf86cd799439012",
    };

    const findOrderById = async (id: string) =>
      id === validOrderId ? mockOrder : null;

    it("rejects an invalid order id", async () => {
      const result = await authorizeOrderRoom(
        { orderId: "not-valid", user: seekerUser },
        { findOrderById },
      );
      expect(result).toEqual({ ok: false, error: "Invalid order id" });
    });

    it("rejects when order is not found", async () => {
      const result = await authorizeOrderRoom(
        { orderId: "507f1f77bcf86cd799439099", user: seekerUser },
        { findOrderById },
      );
      expect(result).toEqual({ ok: false, error: "Order not found" });
    });

    it("rejects an unrelated user", async () => {
      const result = await authorizeOrderRoom(
        { orderId: validOrderId, user: unrelatedUser },
        { findOrderById },
      );
      expect(result).toEqual({ ok: false, error: "Forbidden" });
    });

    it("allows the seeker on the order", async () => {
      const result = await authorizeOrderRoom(
        { orderId: validOrderId, user: seekerUser },
        { findOrderById },
      );
      expect(result).toEqual({
        ok: true,
        room: `order:${validOrderId}`,
      });
    });

    it("allows the provider on the order", async () => {
      const result = await authorizeOrderRoom(
        { orderId: validOrderId, user: providerUser },
        { findOrderById },
      );
      expect(result).toEqual({
        ok: true,
        room: `order:${validOrderId}`,
      });
    });

    it("allows an admin even if not a participant", async () => {
      const result = await authorizeOrderRoom(
        { orderId: validOrderId, user: adminUser },
        { findOrderById },
      );
      expect(result).toEqual({
        ok: true,
        room: `order:${validOrderId}`,
      });
    });
  });
});
