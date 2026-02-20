import { NextResponse } from "next/server";
import { AppError, ErrorCode, ApiResponse, ApiSuccessResponse } from "./errors";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";

/**
 * Standardized API response helpers
 * Ensures consistent response format across all API routes
 */

export function successResponse<T>(
  data: T,
  status = 200,
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true as const,
      ok: true,
      message: null,
      error: null,
      data,
    },
    { status },
  );
}

export function errorResponse(error: unknown): NextResponse {
  // Handle known AppError
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false as const,
        ok: false,
        message: error.message,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && { details: error.details }),
        },
      },
      { status: error.statusCode },
    );
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    error.issues.forEach((err) => {
      const path = err.path.join(".");
      fieldErrors[path] = err.message;
    });

    return NextResponse.json(
      {
        success: false as const,
        ok: false,
        message: "Validation failed",
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "Validation failed",
          details: { fields: fieldErrors },
        },
      },
      { status: 400 },
    );
  }

  // Log unexpected errors (FAANG practice: structured logging)
  logger.error("API", "Unexpected error in API route", error, {
    type: error instanceof Error ? error.name : "Unknown",
    timestamp: new Date().toISOString(),
  });

  // Generic error response (don't leak internal details)
  return NextResponse.json(
    {
      success: false as const,
      ok: false,
      message: "An unexpected error occurred",
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: "An unexpected error occurred",
      },
    },
    { status: 500 },
  );
}

/**
 * Wraps an async handler to catch errors and return consistent responses
 * Compatible with Next.js App Router API routes
 */
export function withErrorHandling<T, C = unknown>(
  handler: (req: Request, context?: C) => Promise<NextResponse<ApiResponse<T>>>,
) {
  return async (req: Request, context?: C): Promise<Response> => {
    try {
      return await handler(req, context);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
