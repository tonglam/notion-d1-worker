import { ERROR_MESSAGES } from "../configs/constants.config";

// Error Types
export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOTION_API_ERROR"
  | "DATABASE_ERROR"
  | "CONFIG_ERROR"
  | "UNKNOWN_ERROR"
  | "AI_PROVIDER_ERROR"
  | "DEEPSEEK_ERROR"
  | "DASHSCOPE_ERROR"
  | "TOKEN_LIMIT_ERROR";

export interface SyncError extends Error {
  code: ErrorCode;
  cause?: unknown;
}

// Logging Types
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogMessage {
  level: LogLevel;
  message: string;
  timestamp: string;
  context: string;
  metadata?: Record<string, unknown>;
}

export interface Logger {
  debug: (message: string, metadata?: Record<string, unknown>) => void;
  info: (message: string, metadata?: Record<string, unknown>) => void;
  warn: (message: string, metadata?: Record<string, unknown>) => void;
  error: (message: string, error?: Error | unknown) => void;
}

// Rate Limiter Types
export interface RateLimiterOptions {
  maxRequestsPerSecond: number;
  maxRequestsPerMinute: number;
}

export interface RequestRecord {
  timestamp: number;
}

// Workflow Result Types
export interface ExtendedDataResult {
  success: boolean;
  postsProcessed: number;
  error?: string;
}
