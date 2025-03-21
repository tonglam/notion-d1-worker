// API Configuration
/** Notion API version to use */
export const NOTION_API_VERSION = "2022-06-28";

// Database Configuration
/** Maximum batch size for D1 operations (free tier limit) */
export const BATCH_SIZE = 100;

// Validation Configuration
/** Required properties for Notion pages */
export const REQUIRED_PROPERTIES = [
  "Title",
  "Slug",
  "Published",
  "Category",
  "Tags",
  "Author",
  "Content Key",
] as const;

// Error Messages
export const ERROR_MESSAGES = {
  /** Error when fetching posts from Notion API fails */
  NOTION_FETCH: "Failed to fetch posts from Notion",
  /** Error when clearing posts from D1 database fails */
  DB_CLEAR: "Failed to clear existing posts from D1",
  /** Error when inserting posts into D1 database fails */
  DB_INSERT: "Failed to insert posts into D1",
  /** Error when transforming Notion data fails */
  TRANSFORM: "Failed to transform Notion data",
  /** Error when required environment variables are missing */
  MISSING_ENV: "Missing required environment variables",
} as const;

// Log Messages
export const LOG_MESSAGES = {
  /** Log message when sync operation starts */
  SYNC_START: "Starting Notion to D1 sync...",
  /** Log message when sync operation completes */
  SYNC_COMPLETE: (count: number): string =>
    `Sync completed successfully. Processed ${count} posts.`,
  /** Log message when fetching posts from Notion starts */
  FETCH_START: "Fetching posts from Notion...",
  /** Log message when fetching posts from Notion completes */
  FETCH_COMPLETE: (count: number): string =>
    `Fetched ${count} posts from Notion.`,
  /** Log message when clearing posts from D1 starts */
  CLEAR_START: "Clearing existing posts from D1...",
  /** Log message when clearing posts from D1 completes */
  CLEAR_COMPLETE: "Cleared existing posts from D1.",
  /** Log message when inserting posts into D1 starts */
  INSERT_START: (count: number): string =>
    `Inserting ${count} posts into D1...`,
  /** Log message when inserting posts into D1 completes */
  INSERT_COMPLETE: "Posts inserted successfully.",
  /** Log message for batch processing progress */
  BATCH_PROGRESS: (current: number, total: number): string =>
    `Processing batch ${current} of ${Math.ceil(total / BATCH_SIZE)}...`,
} as const;

// Type Definitions for Constants
export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;
export type LogMessageKey = keyof typeof LOG_MESSAGES;
export type RequiredPropertyKey = (typeof REQUIRED_PROPERTIES)[number];
