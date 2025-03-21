type LogLevel = "debug" | "info" | "warn" | "error";

interface LogMessage {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: unknown;
}

interface Logger {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, error?: Error | unknown) => void;
}

const formatMessage = (
  level: LogLevel,
  context: string,
  message: string,
  data?: unknown
): LogMessage => ({
  level,
  message,
  timestamp: new Date().toISOString(),
  data,
});

const log = (
  context: string,
  level: LogLevel,
  message: string,
  data?: unknown
): void => {
  const logMessage = formatMessage(level, context, message, data);
  const formattedMessage = `[${
    logMessage.timestamp
  }] [${context}] [${level.toUpperCase()}] ${message}`;

  switch (level) {
    case "debug":
      console.debug(formattedMessage, data || "");
      break;
    case "info":
      console.info(formattedMessage, data || "");
      break;
    case "warn":
      console.warn(formattedMessage, data || "");
      break;
    case "error":
      console.error(formattedMessage, data || "");
      break;
  }
};

export const createLogger = (context: string): Logger => ({
  debug: (message: string, data?: unknown) =>
    log(context, "debug", message, data),
  info: (message: string, data?: unknown) =>
    log(context, "info", message, data),
  warn: (message: string, data?: unknown) =>
    log(context, "warn", message, data),
  error: (message: string, error?: Error | unknown) =>
    log(context, "error", message, error),
});
