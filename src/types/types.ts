/// <reference types="@cloudflare/workers-types" />

// Environment Configuration Types
export interface Env {
  /** D1 database binding */
  DB: D1Database;
  /** Notion API token */
  NOTION_TOKEN: string;
  /** Notion root page/database ID */
  NOTION_ROOT_PAGE_ID: string;
  /** DashScope API key */
  DASHSCOPE_API_KEY: string;
  /** DeepSeek API key */
  DEEPSEEK_API_KEY: string;
}

// Notion API Types
export interface NotionRichText {
  plain_text: string;
  href: string | null;
  annotations: NotionAnnotations;
}

export interface NotionAnnotations {
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  underline: boolean;
  code: boolean;
  color: string;
}

export interface NotionTitle {
  title: Array<{
    plain_text: string;
    href: string | null;
  }>;
}

export interface NotionPerson {
  id: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
}

export interface NotionPageProperties {
  Title: {
    title: Array<{
      plain_text: string;
    }>;
  };
  Category: {
    select: {
      name: string;
    } | null;
  };
  Tags: {
    multi_select: Array<{
      name: string;
    }>;
  };
  Author: {
    people: Array<NotionPerson>;
  };
  Excerpt: {
    rich_text: Array<NotionRichText>;
  };
  Summary: {
    rich_text: Array<NotionRichText>;
  };
  "Mins Read": {
    number: number | null;
  };
  "Image URL": {
    url: string | null;
  };
  "Content Key": {
    rich_text: Array<NotionRichText>;
  };
}

export interface NotionPage {
  id: string;
  created_time: string;
  last_edited_time: string;
  url: string;
  properties: NotionPageProperties;
}

// Notion Property Type Validation
export const PROPERTY_TYPE_MAP = {
  Title: "title",
  Category: "select",
  Tags: "multi_select",
  Author: "people",
  Excerpt: "rich_text",
  Summary: "rich_text",
  "Mins Read": "number",
  "Image URL": "url",
  "Content Key": "rich_text",
} as const;

export type NotionPropertyType =
  (typeof PROPERTY_TYPE_MAP)[keyof typeof PROPERTY_TYPE_MAP];
export type ValidPropertyKey = keyof typeof PROPERTY_TYPE_MAP;

// Database Types
export interface D1PostMetadata {
  /** Unique identifier from Notion */
  id: string;
  /** Post title */
  title: string;
  /** ISO timestamp of creation */
  created_at: string;
  /** ISO timestamp of last update in D1 */
  updated_at: string;
  /** ISO timestamp of last edit in Notion */
  notion_last_edited_at: string;
  /** Post category */
  category: string;
  /** Post author name */
  author: string;
  /** URL to Notion page */
  notion_url: string;
  excerpt: string | null;
}

export interface D1PostExtended {
  /** Optional summary text */
  summary: string | null;
  /** Optional reading time in minutes */
  mins_read: number | null;
  /** Optional URL to original image */
  image_url: string | null;
  /** Optional comma-separated tags */
  tags: string | null;
  /** Optional URL to R2 image */
  r2_image_url: string | null;
  /** Optional DashScope image generation task ID */
  image_task_id: string | null;
  /** Optional error message from processing */
  error: string | null;
}

export type D1Post = D1PostMetadata & D1PostExtended;

// Operation Result Types
/**
 * Sync statistics
 */
export interface SyncStats {
  beforeCount: number;
  afterCount: number;
  postsProcessed: number;
  delta: number;
  timestamp: string;
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  success: boolean;
  postsProcessed: number;
  error?: string;
  stats?: SyncStats;
}

/**
 * Statistics for image collection operations
 */
export interface ImageCollectionStats {
  postsProcessed: number;
  imagesCollected: number;
  failedTasks: number;
  remainingTasks: number;
  timestamp: string;
}

export interface ImageCollectionResult {
  success: boolean;
  postsProcessed: number;
  imagesCollected: number;
  error?: string;
  stats?: ImageCollectionStats;
}

// Error Types
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

// AI Service Types
/** Configuration for AI services */
export interface AIServiceConfig {
  /** DashScope API key */
  dashscopeApiKey: string;
  /** Maximum attempts for status checks */
  maxAttempts?: number;
  /** Interval between status checks in ms */
  checkInterval?: number;
}

/** Result of image generation operations */
export interface ImageResult {
  /** URL of the generated image */
  image_url?: string;
  /** Task ID for tracking generation progress */
  task_id?: string;
}

// Provider Response Types
export interface DashScopeResponse {
  output?: {
    task_id?: string;
    task_status?: string;
    results?: Array<{
      url?: string;
    }>;
    error?: string;
  };
}

// AI Generation Results
export interface GenerationResult<T> {
  data?: T;
  error?: string;
}

/** Base error interface for sync operations */
export interface SyncError extends Error {
  /** Error code identifying the type of error */
  code: ErrorCode;
  /** Optional cause of the error */
  cause?: unknown;
}

/** Available log levels */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** Structure of a log message */
export interface LogMessage {
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** ISO timestamp */
  timestamp: string;
  /** Optional context data */
  context: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/** Logger interface */
export interface Logger {
  /** Log debug message */
  debug: (message: string, metadata?: Record<string, unknown>) => void;
  /** Log info message */
  info: (message: string, metadata?: Record<string, unknown>) => void;
  /** Log warning message */
  warn: (message: string, metadata?: Record<string, unknown>) => void;
  /** Log error message */
  error: (message: string, error?: Error | unknown) => void;
}

// DashScope Provider Types
/** Result of creating an image generation task */
export interface CreateTaskResult {
  /** Task ID for tracking progress */
  taskId?: string;
  /** Error message if task creation failed */
  error?: string;
}

/** Status of an image generation task */
export interface TaskStatusResult {
  /** Current status of the task */
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  /** URL of the generated image if successful */
  imageUrl?: string;
  /** Error message if task failed */
  error?: string;
}

// DeepSeek Provider Types
export interface DeepSeekResult {
  /** Generated text response */
  text: string;
  /** Chain of thought reasoning (if available) */
  reasoning?: string;
}
