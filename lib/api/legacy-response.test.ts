import { describe, expect, it } from "vitest";
import { AppError, ErrorCode } from "@/lib/api/errors";
import {
  appErrorLegacyResponse,
  legacyErrorBody,
  legacyErrorResponse,
  legacyMessageBody,
  legacyMessageResponse,
  legacySuccessBody,
  legacySuccessResponse,
} from "@/lib/api/legacy-response";

describe("legacy response helpers", () => {
  it("returns compatibility error body with both message and error", () => {
    const body = legacyErrorBody("Invalid booking id", { bookingId: "b1" });

    expect(body).toEqual({
      message: "Invalid booking id",
      error: "Invalid booking id",
      details: { bookingId: "b1" },
    });
  });

  it("returns compatibility message body with extras", () => {
    const body = legacyMessageBody("OTP resent", { retryAfterSeconds: 30 });

    expect(body).toEqual({
      message: "OTP resent",
      error: "OTP resent",
      retryAfterSeconds: 30,
    });
  });

  it("returns compatibility success body with ok + success", () => {
    const body = legacySuccessBody({ message: "Done" });

    expect(body).toEqual({
      success: true,
      ok: true,
      message: "Done",
    });
  });

  it("builds legacy error response with status and keys", async () => {
    const response = legacyErrorResponse("Unauthorized", 401);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      message: "Unauthorized",
      error: "Unauthorized",
    });
  });

  it("builds legacy message response with status and extras", async () => {
    const response = legacyMessageResponse("Rate limited", 429, {
      retryAfterSeconds: 60,
    });
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({
      message: "Rate limited",
      error: "Rate limited",
      retryAfterSeconds: 60,
    });
  });

  it("builds legacy success response with ok + success", async () => {
    const response = legacySuccessResponse({ message: "Booking accepted" });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      ok: true,
      message: "Booking accepted",
    });
  });

  it("maps AppError to compatibility response", async () => {
    const response = appErrorLegacyResponse(
      new AppError(ErrorCode.FORBIDDEN, 403, "Forbidden action", {
        action: "delete",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      message: "Forbidden action",
      error: "Forbidden action",
      details: { action: "delete" },
    });
  });
});
