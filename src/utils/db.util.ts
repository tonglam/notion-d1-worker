import type { D1Database } from "@cloudflare/workers-types";
import { BATCH_SIZE, UPDATABLE_FIELDS } from "../configs/constants.config";
import type {
  BatchOperation,
  BatchOperationData,
  D1Post,
  UpdatableField,
  WithId,
} from "../types/db.types";
import { createDatabaseError } from "./errors.util";

// Validation Functions
/**
 * Type guard to check if a field is updatable
 */
export const isUpdatableField = (field: string): field is UpdatableField => {
  return UPDATABLE_FIELDS.includes(field as UpdatableField);
};

/**
 * Validates batch size for database operations
 */
export const validateBatchSize = (size: number): void => {
  if (size <= 0) {
    throw createDatabaseError("Batch size must be greater than 0");
  }
  if (size > BATCH_SIZE) {
    throw createDatabaseError(
      `Batch size ${size} exceeds maximum allowed (${BATCH_SIZE})`
    );
  }
};

/**
 * Validates post ID format
 */
export const validatePostId = (id: string): void => {
  if (!id) {
    throw createDatabaseError("Post ID is required");
  }
  if (!/^[a-f0-9-]+$/i.test(id)) {
    throw createDatabaseError("Invalid post ID format");
  }
};

// Data Transformation Functions
/**
 * Maps a database row to a D1Post object
 */
export const mapRowToPost = (row: Record<string, unknown>): D1Post => ({
  id: row.id as string,
  title: row.title as string,
  created_at: row.created_at as string,
  updated_at: row.updated_at as string,
  notion_last_edited_at: row.notion_last_edited_at as string,
  category: row.category as string,
  author: row.author as string,
  excerpt: row.excerpt as string | null,
  summary: row.summary as string | null,
  mins_read: row.mins_read as number | null,
  image_url: row.image_url as string | null,
  notion_url: row.notion_url as string,
  tags: row.tags as string | null,
  r2_image_url: row.r2_image_url as string | null,
  image_task_id: row.image_task_id as string | null,
});

/**
 * Adds or updates timestamps for database operations
 */
export const withTimestamps = <T>(
  data: T,
  isNew: boolean
): T & { updated_at: string; created_at?: string } => {
  const now = new Date().toISOString();
  return {
    ...data,
    updated_at: now,
    ...(isNew && { created_at: now }),
  };
};

/**
 * Compares two posts and returns fields that have changed
 * Only includes fields that are allowed to be updated
 */
export const getChangedFields = (
  newPost: D1Post,
  existingPost: D1Post
): Partial<D1Post> => {
  return UPDATABLE_FIELDS.reduce((changes, field) => {
    const newValue = newPost[field];
    const existingValue = existingPost[field];

    if (newValue !== existingValue) {
      // Type assertion is safe here because we're only using fields from UPDATABLE_FIELDS
      (changes as Record<string, string | number | null>)[field] = newValue;
    }

    return changes;
  }, {} as Partial<D1Post>);
};

// SQL Statement Generators
/**
 * Creates a batch insert statement for D1
 */
const createBatchInsertStatement = (
  tableName: string,
  columns: string[],
  batchSize: number
): string => {
  const placeholders = Array(batchSize)
    .fill(`(${Array(columns.length).fill("?").join(",")})`)
    .join(",");

  return `
    INSERT INTO ${tableName} (${columns.join(",")})
    VALUES ${placeholders}
  `;
};

/**
 * Creates a batch update statement
 */
const createBatchUpdateStatement = (
  tableName: string,
  columns: string[],
  whereColumn: string
): string => {
  const setClauses = columns.map((col) => `${col} = ?`).join(",");
  return `
    UPDATE ${tableName}
    SET ${setClauses}
    WHERE ${whereColumn} = ?
  `;
};

// Batch Operation Functions
/**
 * Executes a batch insert operation
 */
const executeBatchInsert = async <T extends Record<string, unknown>>(
  db: D1Database,
  items: T[]
): Promise<void> => {
  if (items.length === 0) return;

  const columns = Object.keys(items[0]);
  const values = items.flatMap((item) => columns.map((col) => item[col]));
  const statement = createBatchInsertStatement("posts", columns, items.length);

  await db
    .prepare(statement)
    .bind(...values)
    .run();
};

/**
 * Executes a batch update operation
 */
const executeBatchUpdate = async <T extends Record<string, unknown> & WithId>(
  db: D1Database,
  items: T[]
): Promise<void> => {
  if (items.length === 0) return;

  const updates = items.map((item) => {
    const { id, ...updateFields } = item;
    const columns = Object.keys(updateFields);
    const values = [...columns.map((col) => updateFields[col]), id];
    const statement = createBatchUpdateStatement("posts", columns, "id");

    return db
      .prepare(statement)
      .bind(...values)
      .run();
  });

  await Promise.all(updates);
};

/**
 * Executes a batch delete operation
 */
const executeBatchDelete = async <T extends Record<string, unknown> & WithId>(
  db: D1Database,
  items: T[]
): Promise<void> => {
  if (items.length === 0) return;

  const ids = items.map((item) => item.id);
  const placeholders = ids.map(() => "?").join(",");
  const statement = `DELETE FROM posts WHERE id IN (${placeholders})`;

  await db
    .prepare(statement)
    .bind(...ids)
    .run();
};

/**
 * Executes a batch of database operations in a transaction
 */
export const executeBatchOperations = async <T extends Record<string, unknown>>(
  db: D1Database,
  operations: BatchOperation<T>[],
  batchSize: number = BATCH_SIZE
): Promise<void> => {
  try {
    validateBatchSize(batchSize);

    // Group operations by type
    const groups = operations.reduce((acc, op) => {
      const { type } = op;
      if (!acc[type]) acc[type] = [];
      acc[type].push(op.data);
      return acc;
    }, {} as Record<string, BatchOperationData<T>[]>);

    // Process each group in batches
    for (const [type, items] of Object.entries(groups)) {
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, Math.min(i + batchSize, items.length));

        // Execute the appropriate batch operation
        switch (type) {
          case "INSERT":
            await executeBatchInsert(db, batch);
            break;
          case "UPDATE":
            await executeBatchUpdate(db, batch as (T & WithId)[]);
            break;
          case "DELETE":
            await executeBatchDelete(db, batch as (T & WithId)[]);
            break;
          default:
            throw createDatabaseError(`Unknown batch operation type: ${type}`);
        }
      }
    }
  } catch (error) {
    throw createDatabaseError("Failed to execute batch operations", error);
  }
};
