import type { ErrorCode } from "../types";

interface SyncError extends Error {
  code: ErrorCode;
  cause?: unknown;
}

type ErrorType =
  | "VALIDATION_ERROR"
  | "NOTION_API_ERROR"
  | "DATABASE_ERROR"
  | "UNKNOWN_ERROR";

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

export const createValidationError = (
  message: string,
  cause?: unknown
): SyncError =>
  createError(message, "VALIDATION_ERROR", cause, "ValidationError");

export const createNotionAPIError = (
  message: string,
  cause?: unknown
): SyncError =>
  createError(message, "NOTION_API_ERROR", cause, "NotionAPIError");

export const createDatabaseError = (
  message: string,
  cause?: unknown
): SyncError => createError(message, "DATABASE_ERROR", cause, "DatabaseError");

export const isNotionSyncError = (error: unknown): error is SyncError => {
  return error instanceof Error && "code" in error;
};

export const handleError = (error: unknown): SyncError => {
  if (isNotionSyncError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return createError(error.message, "UNKNOWN_ERROR", error);
  }

  return createError("An unknown error occurred", "UNKNOWN_ERROR", error);
};
