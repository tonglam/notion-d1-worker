// Database Constants
/** Maximum batch size for D1 operations (free tier limit) */
export const BATCH_SIZE = 50;

/** Fields that can be updated in D1 posts */
export const UPDATABLE_FIELDS = [
  // Core metadata from Notion
  "title",
  "category",
  "author",
  "excerpt",
  "notion_url",
  "notion_last_edited_at",

  // Extended data
  "summary",
  "mins_read",
  "image_url",
  "tags",
  "r2_image_url",
  "image_task_id",
] as const;

// Validation Constants
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
  /** Error when updating post in D1 database fails */
  DB_UPDATE: "Failed to update post in D1",
  /** Error when transforming Notion data fails */
  TRANSFORM: "Failed to transform Notion data",
  /** Error when required environment variables are missing */
  MISSING_ENV: "Missing required environment variables",
} as const;
