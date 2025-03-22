import type { LogLevel, LogMessage, Logger } from "../types";
import { isNotionSyncError } from "./errors.util";

/**
 * Format a log message with context and metadata
 * @param level - Log level
 * @param context - Logger context
 * @param message - Log message
 * @param metadata - Optional metadata
 * @returns Formatted log message
 */
const formatMessage = (
  level: LogLevel,
  context: string,
  message: string,
  metadata?: Record<string, unknown>
): LogMessage => ({
  level,
  message,
  timestamp: new Date().toISOString(),
  context,
  metadata,
});

/**
 * Format error metadata for logging
 * @param error - Error object
 * @returns Formatted error metadata
 */
const formatErrorMetadata = (error: unknown): Record<string, unknown> => {
  if (isNotionSyncError(error)) {
    return {
      name: error.name,
      code: error.code,
      cause: error.cause,
      stack: error.stack,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      stack: error.stack,
    };
  }

  return { error };
};

/**
 * Log a message with the specified level and metadata
 * @param context - Logger context
 * @param level - Log level
 * @param message - Log message
 * @param metadata - Optional metadata
 */
const log = (
  context: string,
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>
): void => {
  const logMessage = formatMessage(level, context, message, metadata);
  const formattedMessage = `[${
    logMessage.timestamp
  }] [${context}] [${level.toUpperCase()}] ${message}`;

  switch (level) {
    case "debug":
      console.debug(formattedMessage, metadata || "");
      break;
    case "info":
      console.info(formattedMessage, metadata || "");
      break;
    case "warn":
      console.warn(formattedMessage, metadata || "");
      break;
    case "error":
      console.error(formattedMessage, metadata || "");
      break;
  }
};

/**
 * Create a new logger instance with the specified context
 * @param context - Logger context
 * @returns Logger instance
 */
export const createLogger = (context: string): Logger => ({
  debug: (message: string, metadata?: Record<string, unknown>) =>
    log(context, "debug", message, metadata),
  info: (message: string, metadata?: Record<string, unknown>) =>
    log(context, "info", message, metadata),
  warn: (message: string, metadata?: Record<string, unknown>) =>
    log(context, "warn", message, metadata),
  error: (message: string, error?: Error | unknown) =>
    log(
      context,
      "error",
      message,
      error ? formatErrorMetadata(error) : undefined
    ),
});
