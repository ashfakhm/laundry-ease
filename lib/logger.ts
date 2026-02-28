import pino from "pino";
import { AsyncLocalStorage } from "async_hooks";

const isDevelopment = process.env.NODE_ENV === "development";
const isDebugEnabled = process.env.DEBUG_LOGGING === "true";

// Configure strict redaction paths for Pino to natively strip secrets from logs before serialization
const redactionPaths = [
  "*.password",
  "*.passwordHash",
  "*.token",
  "*.secret",
  "*.apiKey",
  "*.otp",
  "*.code",
  "*.codeHash",
  "*.authToken",
  "*.accessToken",
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

const pinoLogger = pino({
  level: isDebugEnabled ? "debug" : isDevelopment ? "debug" : "info",
  redact: redactionPaths,
  ...(isDevelopment && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        ignore: "pid,hostname",
        translateTime: "SYS:standard",
      },
    },
  }),
});

interface LogContext {
  [key: string]: unknown;
}

export const traceStorage = new AsyncLocalStorage<{ traceId: string }>();

export const logger = {
  debug(prefix: string, message: string, context?: LogContext) {
    const traceId = traceStorage.getStore()?.traceId;
    pinoLogger.debug({ prefix, traceId, ...context }, message);
  },

  info(prefix: string, message: string, context?: LogContext) {
    const traceId = traceStorage.getStore()?.traceId;
    pinoLogger.info({ prefix, traceId, ...context }, message);
  },

  warn(prefix: string, message: string, context?: LogContext) {
    const traceId = traceStorage.getStore()?.traceId;
    pinoLogger.warn({ prefix, traceId, ...context }, message);
  },

  error(
    prefix: string,
    message: string,
    error?: unknown,
    context?: LogContext,
  ) {
    const traceId = traceStorage.getStore()?.traceId;

    if (error instanceof Error) {
      pinoLogger.error(
        {
          prefix,
          traceId,
          err: {
            message: error.message,
            stack: isDevelopment ? error.stack : undefined,
            name: error.name,
          },
          ...context,
        },
        message,
      );
    } else if (error) {
      pinoLogger.error(
        {
          prefix,
          traceId,
          error_string: String(error),
          ...context,
        },
        message,
      );
    } else {
      pinoLogger.error({ prefix, traceId, ...context }, message);
    }
  },
};

export default logger;
