import { describe, expect, it } from "vitest";
import {
  canAccessComplaintConversation,
  isComplaintOngoing,
} from "./access";

describe("complaint access policy", () => {
  it("allows seeker access while complaint is ongoing", () => {
    const result = canAccessComplaintConversation({
      actorId: "seeker-1",
      actorRole: "seeker",
      complaint: {
        seekerId: "seeker-1",
        providerId: "provider-1",
        providerAccessGranted: false,
        status: "open",
      },
    });

    expect(result).toEqual({ allowed: true, role: "seeker" });
  });

  it("blocks provider access until admin grants provider access", () => {
    const result = canAccessComplaintConversation({
      actorId: "provider-1",
      actorRole: "provider",
      complaint: {
        seekerId: "seeker-1",
        providerId: "provider-1",
        providerAccessGranted: false,
        status: "accepted",
      },
    });

    expect(result).toEqual({
      allowed: false,
      error: "Provider access has not been granted.",
    });
  });

  it("blocks non-admin access after complaint is finalized", () => {
    const result = canAccessComplaintConversation({
      actorId: "seeker-1",
      actorRole: "seeker",
      complaint: {
        seekerId: "seeker-1",
        providerId: "provider-1",
        providerAccessGranted: true,
        status: "resolved",
      },
    });

    expect(result).toEqual({
      allowed: false,
      error: "Dispute is resolved. Access is restricted to Admin only.",
    });
  });

  it("allows admin access to finalized complaints", () => {
    const result = canAccessComplaintConversation({
      actorId: "admin-1",
      actorRole: "admin",
      complaint: {
        seekerId: "seeker-1",
        providerId: "provider-1",
        providerAccessGranted: false,
        status: "rejected",
      },
    });

    expect(result).toEqual({ allowed: true, role: "admin" });
  });
});

describe("isComplaintOngoing", () => {
  it("returns true for active statuses and false for finalized statuses", () => {
    expect(isComplaintOngoing("open")).toBe(true);
    expect(isComplaintOngoing("accepted")).toBe(true);
    expect(isComplaintOngoing("in_review")).toBe(true);
    expect(isComplaintOngoing("resolved")).toBe(false);
    expect(isComplaintOngoing("rejected")).toBe(false);
    expect(isComplaintOngoing(undefined)).toBe(false);
  });
});
