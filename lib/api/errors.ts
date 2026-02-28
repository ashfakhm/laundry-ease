/**
 * Centralized API error handling for FAANG-grade error consistency
 * All API routes should use these error types for predictable client handling
 */

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly statusCode: number,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const ErrorCode = {
  // Authentication (401)
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  NO_ACCOUNT: "NO_ACCOUNT",

  // Authorization (403)
  FORBIDDEN: "FORBIDDEN",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",

  // Validation (400)
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",

  // Resource (404)
  NOT_FOUND: "NOT_FOUND",
  BOOKING_NOT_FOUND: "BOOKING_NOT_FOUND",
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  PROVIDER_NOT_FOUND: "PROVIDER_NOT_FOUND",

  // Conflict (409)
  DUPLICATE_RESOURCE: "DUPLICATE_RESOURCE",
  BOOKING_ALREADY_PROCESSED: "BOOKING_ALREADY_PROCESSED",
  ORDER_ALREADY_PAID: "ORDER_ALREADY_PAID",
  CONFLICT: "CONFLICT",

  // Business Logic (422)
  INVALID_STATE_TRANSITION: "INVALID_STATE_TRANSITION",
  ESCROW_WINDOW_EXPIRED: "ESCROW_WINDOW_EXPIRED",
  BOOKING_DEADLINE_PASSED: "BOOKING_DEADLINE_PASSED",
  CAPACITY_EXCEEDED: "CAPACITY_EXCEEDED",
  PAYMENT_NOT_SETTLED: "PAYMENT_NOT_SETTLED",
  REFUND_IN_PROGRESS: "REFUND_IN_PROGRESS",

  // Rate Limiting (429)
  RATE_LIMITED: "RATE_LIMITED",

  // Server (500)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// Factory functions for common errors
export const Errors = {
  unauthorized: (message = "Authentication required") =>
    new AppError(ErrorCode.UNAUTHORIZED, 401, message),

  forbidden: (message = "You don't have permission to perform this action") =>
    new AppError(ErrorCode.FORBIDDEN, 403, message),

  notFound: (resource: string) =>
    new AppError(ErrorCode.NOT_FOUND, 404, `${resource} not found`),

  validation: (message: string, details?: Record<string, unknown>) =>
    new AppError(ErrorCode.VALIDATION_ERROR, 400, message, details),

  conflict: (message: string) =>
    new AppError(ErrorCode.DUPLICATE_RESOURCE, 409, message),

  invalidState: (message: string) =>
    new AppError(ErrorCode.INVALID_STATE_TRANSITION, 422, message),

  badRequest: (message: string) =>
    new AppError(ErrorCode.VALIDATION_ERROR, 400, message),

  internal: (message = "An unexpected error occurred") =>
    new AppError(ErrorCode.INTERNAL_ERROR, 500, message),

  rateLimited: () =>
    new AppError(
      ErrorCode.RATE_LIMITED,
      429,
      "Too many requests. Please try again later.",
    ),
} as const;
