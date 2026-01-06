/**
 * Production-ready logging utility
 * Logs are only output in development or when explicitly enabled
 */

const isDevelopment = process.env.NODE_ENV === "development";
const isDebugEnabled = process.env.DEBUG_LOGGING === "true";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

function shouldLog(level: LogLevel): boolean {
  if (level === "error" || level === "warn") {
    return true; // Always log errors and warnings
  }
  return isDevelopment || isDebugEnabled;
}

function formatMessage(
  prefix: string,
  message: string,
  context?: LogContext
): string {
  const timestamp = new Date().toISOString();
  let formatted = `[${timestamp}] [${prefix}] ${message}`;

  if (context && Object.keys(context).length > 0) {
    // Redact sensitive fields
    const sanitized = sanitizeContext(context);
    formatted += ` ${JSON.stringify(sanitized)}`;
  }

  return formatted;
}

function sanitizeContext(context: LogContext): LogContext {
  const sensitiveKeys = [
    "password",
    "passwordHash",
    "token",
    "secret",
    "apiKey",
    "otp",
    "code",
    "codeHash",
    "authToken",
    "accessToken",
  ];

  const sanitized: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (
      sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))
    ) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeContext(value as LogContext);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export const logger = {
  debug(prefix: string, message: string, context?: LogContext) {
    if (shouldLog("debug")) {
      console.debug(formatMessage(prefix, message, context));
    }
  },

  info(prefix: string, message: string, context?: LogContext) {
    if (shouldLog("info")) {
      console.info(formatMessage(prefix, message, context));
    }
  },

  warn(prefix: string, message: string, context?: LogContext) {
    if (shouldLog("warn")) {
      console.warn(formatMessage(prefix, message, context));
    }
  },

  error(
    prefix: string,
    message: string,
    error?: unknown,
    context?: LogContext
  ) {
    // Always log errors
    const errorContext: LogContext = { ...context };
    if (error instanceof Error) {
      errorContext.errorName = error.name;
      errorContext.errorMessage = error.message;
      // Only include stack in development
      if (isDevelopment) {
        errorContext.stack = error.stack;
      }
    } else if (error) {
      errorContext.error = String(error);
    }
    console.error(formatMessage(prefix, message, errorContext));
  },
};

export default logger;
