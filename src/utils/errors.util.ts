import type { ErrorCode, SyncError } from "../types/types";

/**
 * Creates a new error with the specified parameters
 * @param message - Error message
 * @param code - Error code
 * @param cause - Optional cause of the error
 * @param name - Optional error name
 * @returns A new SyncError instance
 */
const createError = (
  message: string,
  code: ErrorCode,
  cause?: unknown,
  name = "NotionSyncError"
): SyncError => {
  const error = new Error(message) as SyncError;
  error.name = name;
  error.code = code;
  error.cause = cause;
  return error;
};

/**
 * Creates a validation error
 * @param message - Error message
 * @param cause - Optional cause of the error
 * @returns A new validation error
 */
export const createValidationError = (
  message: string,
  cause?: unknown
): SyncError =>
  createError(message, "VALIDATION_ERROR", cause, "ValidationError");

/**
 * Creates a Notion API error
 * @param message - Error message
 * @param cause - Optional cause of the error
 * @returns A new Notion API error
 */
export const createNotionAPIError = (
  message: string,
  cause?: unknown
): SyncError =>
  createError(message, "NOTION_API_ERROR", cause, "NotionAPIError");

/**
 * Creates a database error
 * @param message - Error message
 * @param cause - Optional cause of the error
 * @returns A new database error
 */
export const createDatabaseError = (
  message: string,
  cause?: unknown
): SyncError => createError(message, "DATABASE_ERROR", cause, "DatabaseError");

/**
 * Creates a DeepSeek API error
 * @param message - Error message
 * @param cause - Optional cause of the error
 * @returns A new DeepSeek API error
 */
export const createDeepSeekError = (
  message: string,
  cause?: unknown
): SyncError => createError(message, "DEEPSEEK_ERROR", cause, "DeepSeekError");

/**
 * Creates a DashScope API error
 * @param message - Error message
 * @param cause - Optional cause of the error
 * @returns A new DashScope API error
 */
export const createDashScopeError = (
  message: string,
  cause?: unknown
): SyncError =>
  createError(message, "DASHSCOPE_ERROR", cause, "DashScopeError");

/**
 * Creates a token limit error
 * @param message - Error message
 * @param cause - Optional cause of the error
 * @returns A new token limit error
 */
export const createTokenLimitError = (
  message: string,
  cause?: unknown
): SyncError =>
  createError(message, "TOKEN_LIMIT_ERROR", cause, "TokenLimitError");

/**
 * Creates an AI provider error
 * @param message - Error message
 * @param cause - Optional cause of the error
 * @returns A new AI provider error
 */
export const createAIProviderError = (
  message: string,
  cause?: unknown
): SyncError =>
  createError(message, "AI_PROVIDER_ERROR", cause, "AIProviderError");

/**
 * Type guard to check if an error is a SyncError
 * @param error - Error to check
 * @returns True if the error is a SyncError
 */
export const isNotionSyncError = (error: unknown): error is SyncError => {
  return error instanceof Error && "code" in error;
};

/**
 * Handles unknown errors by converting them to SyncErrors
 * @param error - Error to handle
 * @returns A SyncError instance
 */
export const handleError = (error: unknown): SyncError => {
  if (isNotionSyncError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return createError(error.message, "UNKNOWN_ERROR", error);
  }

  return createError("An unknown error occurred", "UNKNOWN_ERROR", error);
};
