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
    const errorContext: LogContext = { ...context };

    // Normalize errors for Pino traversal
    if (error instanceof Error) {
      errorContext.err = {
        name: error.name,
        message: error.message,
        stack: isDevelopment ? error.stack : undefined,
      };
    } else if (error) {
      errorContext.error_string = String(error);
    }

    pinoLogger.error({ prefix, ...errorContext }, message);
  },
};

export default logger;
