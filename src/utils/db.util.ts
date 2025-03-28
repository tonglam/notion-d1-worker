import { UPDATABLE_FIELDS } from "../configs/constants.config";
import type { D1Post, UpdatableField } from "../types/db.types";
import { createLogger } from "../utils/logger.util";

const logger = createLogger("D1Utils");

/**
 * Gets changed fields between new and existing post
 * @param newPost - New post data
 * @param existingPost - Existing post data
 * @returns Object containing only changed fields
 */
export const getChangedFields = (
  newPost: D1Post,
  existingPost: D1Post
): Pick<D1Post, UpdatableField> => {
  const changes = {} as Pick<D1Post, UpdatableField>;

  for (const field of UPDATABLE_FIELDS) {
    const key = field as keyof D1Post;
    const newValue = newPost[key];
    const existingValue = existingPost[key];

    if (newValue !== existingValue) {
      // @ts-expect-error - The types are compatible at runtime
      changes[key] = newValue;
    }
  }
  return changes;
};

/**
 * Maps a database row to a D1Post object
 * @param row - Database row
 * @returns D1Post object
 */
export const mapRowToPost = (row: Record<string, unknown>): D1Post => {
  return {
    id: row.id as string,
    title: row.title as string,
    category: row.category as string,
    excerpt: row.excerpt as string | null,
    summary: row.summary as string | null,
    mins_read: row.mins_read as number | null,
    tags: row.tags as string | null,
    image_url: row.image_url as string | null,
    r2_image_url: row.r2_image_url as string | null,
    image_task_id: row.image_task_id as string | null,
    notion_url: row.notion_url as string,
    notion_last_edited_at: row.notion_last_edited_at as string,
    author: row.author as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
};

/**
 * Adds timestamps to a record
 * @param data - Record to add timestamps to
 * @param isNew - Whether this is a new record
 * @returns Record with timestamps
 */
export const withTimestamps = <T extends Record<string, unknown>>(
  data: T,
  isNew: boolean
): T & { updated_at: string; created_at?: string } => {
  const now = new Date().toISOString();
  const timestamps: { updated_at: string; created_at?: string } = {
    updated_at: now,
    ...(isNew ? { created_at: now } : {}),
  };
  return { ...data, ...timestamps };
};

/**
 * Checks if a field is updatable
 * @param field - Field name to check
 * @returns Whether the field is updatable
 */
export const isUpdatableField = (field: string): field is UpdatableField => {
  return UPDATABLE_FIELDS.includes(field as UpdatableField);
};
