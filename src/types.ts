/// <reference types="@cloudflare/workers-types" />

// Environment Configuration Types
export interface Env {
  /** D1 database instance */
  DB: D1Database;
  /** Notion API token */
  NOTION_TOKEN: string;
  /** Notion database ID to sync */
  NOTION_DATABASE_ID: string;
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
}

export interface NotionPage {
  id: string;
  created_time: string;
  last_edited_time: string;
  url: string;
  properties: NotionPageProperties;
}

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
}

export interface D1PostExtended {
  /** Optional excerpt text */
  excerpt: string | null;
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
}

export interface D1Post extends D1PostMetadata, D1PostExtended {}

// Operation Result Types
export interface SyncResult {
  /** Whether the sync operation was successful */
  success: boolean;
  /** Number of posts processed during sync */
  postsProcessed: number;
  /** Error details if sync failed */
  error?: Error;
}

// Error Types
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOTION_API_ERROR"
  | "DATABASE_ERROR"
  | "CONFIG_ERROR"
  | "UNKNOWN_ERROR";
