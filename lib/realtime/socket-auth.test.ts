import { describe, expect, it } from "vitest";
import {
  authorizeBookingRoom,
  authorizeComplaintRoom,
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
});
