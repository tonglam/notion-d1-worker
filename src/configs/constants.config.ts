// API Configuration
/** Notion API version to use */
export const NOTION_API_VERSION = "2022-06-28";

/** DeepSeek API Configuration */
export interface DeepSeekConfig {
  LIMITS: {
    MAX_INPUT_TOKENS: number;
    MAX_OUTPUT_TOKENS: number;
  };
}

export const DEEPSEEK_API: DeepSeekConfig = {
  LIMITS: {
    MAX_INPUT_TOKENS: 32000, // Max CoT tokens for reasoner
    MAX_OUTPUT_TOKENS: 8000,
  },
} as const;

/** DashScope API Configuration */
export interface DashScopeConfig {
  BASE_URL: string;
  ENDPOINTS: {
    IMAGE_SYNTHESIS: string;
    TASK_STATUS: (taskId: string) => string;
  };
  MODELS: {
    IMAGE: string;
  };
  DEFAULT_CONFIG: {
    IMAGE: {
      SIZE: string;
      COUNT: number;
      MAX_ATTEMPTS: number;
      CHECK_INTERVAL: number;
    };
  };
  HEADERS: {
    ASYNC: string;
    CONTENT_TYPE: string;
  };
  LIMITS: {
    MAX_PROMPT_LENGTH: number;
    MAX_CONCURRENT_TASKS: number;
  };
}

export const DASHSCOPE_API: DashScopeConfig = {
  BASE_URL: "https://dashscope.aliyuncs.com/api/v1",
  ENDPOINTS: {
    IMAGE_SYNTHESIS: "/text2image/generation",
    TASK_STATUS: (taskId: string) => `/tasks/${taskId}`,
  },
  MODELS: {
    IMAGE: "stable-diffusion-xl",
  },
  DEFAULT_CONFIG: {
    IMAGE: {
      SIZE: "1024*1024",
      COUNT: 1,
      MAX_ATTEMPTS: 30,
      CHECK_INTERVAL: 2000,
    },
  },
  HEADERS: {
    ASYNC: "X-DashScope-Async",
    CONTENT_TYPE: "application/json",
  },
  LIMITS: {
    MAX_PROMPT_LENGTH: 1000,
    MAX_CONCURRENT_TASKS: 50,
  },
} as const;

// Database Configuration
/** Maximum batch size for D1 operations (free tier limit) */
export const BATCH_SIZE = 50;

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
  /** Error when updating post in D1 database fails */
  DB_UPDATE: "Failed to update post in D1",
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
  SYNC_COMPLETE: (count: number) => `Sync completed. ${count} posts processed.`,
  /** Log message when fetching posts from Notion starts */
  FETCH_START: "Fetching posts from Notion...",
  /** Log message when fetching posts from Notion completes */
  FETCH_COMPLETE: (count: number) => `Fetched ${count} posts from Notion.`,
  /** Log message when transforming Notion data starts */
  TRANSFORM_START: "Transforming Notion data...",
  /** Log message when transforming Notion data completes */
  TRANSFORM_COMPLETE: (count: number) => `Transformed ${count} posts.`,
  /** Log message when clearing posts from D1 starts */
  CLEAR_START: "Clearing existing posts...",
  /** Log message when clearing posts from D1 completes */
  CLEAR_COMPLETE: "Cleared existing posts.",
  /** Log message when inserting posts into D1 starts */
  INSERT_START: (count: number) => `Inserting ${count} posts...`,
  /** Log message when inserting posts into D1 completes */
  INSERT_COMPLETE: "Posts inserted successfully.",
  /** Log message when updating post in D1 starts */
  UPDATE_START: (id: string) => `Updating post ${id}...`,
  /** Log message when updating post in D1 completes */
  UPDATE_COMPLETE: "Post updated successfully.",
  /** Log message for batch processing progress */
  BATCH_PROGRESS: (current: number, total: number) =>
    `Processing batch ${current} of ${Math.ceil(total / BATCH_SIZE)}`,
} as const;

// Type Definitions for Constants
export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;
export type LogMessageKey = keyof typeof LOG_MESSAGES;
export type RequiredPropertyKey = (typeof REQUIRED_PROPERTIES)[number];
