import { NextResponse } from "next/server";
import { AppError } from "@/lib/api/errors";

export function legacyErrorBody(
  message: string,
  details?: Record<string, unknown>,
) {
  return {
    message,
    error: message,
    ...(details ? { details } : {}),
  };
}

export function legacyErrorResponse(
  message: string,
  status: number,
  details?: Record<string, unknown>,
) {
  return NextResponse.json(legacyErrorBody(message, details), { status });
}

export function appErrorLegacyResponse(error: AppError) {
  return legacyErrorResponse(error.message, error.statusCode, error.details);
}

export function appErrorMessageResponse(
  error: AppError,
  key: "error" | "message" = "error",
) {
  return NextResponse.json(
    {
      [key]: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
    { status: error.statusCode },
  );
}
