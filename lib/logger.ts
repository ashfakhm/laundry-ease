import pino from "pino";

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

export const logger = {
  debug(prefix: string, message: string, context?: LogContext) {
    pinoLogger.debug({ prefix, ...context }, message);
  },

  info(prefix: string, message: string, context?: LogContext) {
    pinoLogger.info({ prefix, ...context }, message);
  },

  warn(prefix: string, message: string, context?: LogContext) {
    pinoLogger.warn({ prefix, ...context }, message);
  },

  error(
    prefix: string,
    message: string,
    error?: unknown,
    context?: LogContext,
  ) {
    if (error instanceof Error) {
      pinoLogger.error(
        {
          prefix,
          err: {
            message: error.message,
            stack: error.stack,
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
          error_string: String(error),
          ...context,
        },
        message,
      );
    } else {
      pinoLogger.error({ prefix, ...context }, message);
    }
  },
};

export default logger;
