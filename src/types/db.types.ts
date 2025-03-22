import { UPDATABLE_FIELDS } from "../configs/constants.config";

// Database Record Types
export interface D1PostMetadata {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  notion_last_edited_at: string;
  category: string;
  author: string;
  notion_url: string;
  excerpt: string | null;
}

export interface D1PostExtended {
  summary: string | null;
  mins_read: number | null;
  image_task_id: string | null;
  image_url: string | null;
  tags: string | null;
  r2_image_url: string | null;
}

export type D1Post = D1PostMetadata & D1PostExtended;
export type D1PostRecord = D1Post & Record<string, unknown>;
export type D1PostUpdate = Partial<D1Post> & { id: string };

// Type for fields that can be updated
export type UpdatableField = (typeof UPDATABLE_FIELDS)[number];
export type UpdatableValue = string | number | null;

// Type guard for updatable fields
export const isUpdatableField = (field: string): field is UpdatableField =>
  UPDATABLE_FIELDS.includes(field as UpdatableField);

// Database Operation Types
export type WithId = { id: string };

export type BatchOperationData<T extends Record<string, unknown>> =
  T extends WithId ? T : T & WithId;

export type BatchOperation<T extends Record<string, unknown>> = {
  type: "INSERT" | "UPDATE" | "DELETE";
  data: T extends WithId ? T : T & WithId;
};

// Database Operation Results
export interface SyncStats {
  beforeCount: number;
  afterCount: number;
  postsProcessed: number;
  delta: number;
  timestamp: string;
}

export interface SyncResult {
  success: boolean;
  postsProcessed: number;
  error?: string;
  stats?: SyncStats;
}

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
}

// Comparable Fields
export const COMPARABLE_FIELDS = [
  "title",
  "notion_last_edited_at",
  "category",
  "author",
  "notion_url",
  "excerpt",
  "summary",
  "mins_read",
  "image_task_id",
  "image_url",
  "tags",
  "r2_image_url",
] as const;

export type ComparableField = (typeof COMPARABLE_FIELDS)[number];
