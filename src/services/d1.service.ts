import type { D1Database } from "@cloudflare/workers-types";
import {
  BATCH_SIZE,
  ERROR_MESSAGES,
  LOG_MESSAGES,
} from "../configs/constants.config";
import type { D1Post, D1PostExtended } from "../types/types";
import { createDatabaseError } from "../utils/errors.util";
import { createLogger } from "../utils/logger.util";

const logger = createLogger("D1Service");

// Define which fields can be updated
const UPDATABLE_FIELDS = [
  "summary",
  "mins_read",
  "image_url",
  "tags",
  "r2_image_url",
  "image_task_id",
] as const;

type UpdatableField = (typeof UPDATABLE_FIELDS)[number];

/**
 * Type guard to check if a field is updatable
 * @param field - Field name to check
 * @returns Whether the field is updatable
 */
const isUpdatableField = (field: string): field is UpdatableField => {
  return UPDATABLE_FIELDS.includes(field as UpdatableField);
};

/**
 * Maps a database row to a D1Post object
 * @param row - Database row
 * @returns D1Post object
 */
const mapRowToPost = (row: Record<string, unknown>): D1Post => ({
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
  error: row.error as string | null,
});

/**
 * Validates batch size for database operations
 * @param size - Batch size to validate
 * @throws {DatabaseError} If batch size is invalid
 */
const validateBatchSize = (size: number): void => {
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
 * @param id - Post ID to validate
 * @throws {DatabaseError} If ID is invalid
 */
const validatePostId = (id: string): void => {
  if (!id) {
    throw createDatabaseError("Post ID is required");
  }
  if (!/^[a-f0-9-]+$/i.test(id)) {
    throw createDatabaseError("Invalid post ID format");
  }
};

/**
 * Gets all posts from the database
 * @param db - D1 database instance
 * @returns Array of posts
 * @throws {DatabaseError} If query fails
 */
export const getPosts = async (db: D1Database): Promise<D1Post[]> => {
  try {
    const { results } = await db.prepare("SELECT * FROM posts").all();
    return results.map(mapRowToPost);
  } catch (error) {
    logger.error("Failed to get posts", error);
    throw createDatabaseError("Failed to get posts", error);
  }
};

/**
 * Clears all posts from the database
 * @param db - D1 database instance
 * @throws {DatabaseError} If deletion fails
 */
export const clearPosts = async (db: D1Database): Promise<void> => {
  logger.info(LOG_MESSAGES.CLEAR_START);
  try {
    await db.prepare("DELETE FROM posts").run();
    logger.info(LOG_MESSAGES.CLEAR_COMPLETE);
  } catch (error) {
    logger.error(ERROR_MESSAGES.DB_CLEAR, error);
    throw createDatabaseError(ERROR_MESSAGES.DB_CLEAR, error);
  }
};

/**
 * Inserts posts into the database in batches
 * @param db - D1 database instance
 * @param posts - Array of posts to insert
 * @throws {DatabaseError} If insertion fails
 */
export const insertPosts = async (
  db: D1Database,
  posts: D1Post[]
): Promise<void> => {
  logger.info(LOG_MESSAGES.INSERT_START(posts.length));

  try {
    const batches = [];
    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const batch = posts.slice(i, i + BATCH_SIZE);
      validateBatchSize(batch.length);

      logger.debug("Processing batch", {
        batchNumber: Math.floor(i / BATCH_SIZE) + 1,
        totalBatches: Math.ceil(posts.length / BATCH_SIZE),
        batchSize: batch.length,
      });

      const placeholders = batch
        .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .join(",");

      const values = batch.flatMap((post) => [
        post.id,
        post.title,
        post.created_at,
        post.updated_at,
        post.notion_last_edited_at,
        post.category,
        post.author,
        post.excerpt,
        post.notion_url,
        post.summary,
        post.mins_read,
        post.image_url,
        post.tags,
        post.r2_image_url,
        post.image_task_id,
      ]);

      const statement = db.prepare(`
        INSERT INTO posts (
          id, title, created_at, updated_at, notion_last_edited_at,
          category, author, excerpt, notion_url, summary, mins_read,
          image_url, tags, r2_image_url, image_task_id
        ) VALUES ${placeholders}
      `);

      batches.push(statement.bind(...values).run());
    }

    await Promise.all(batches);
    logger.info(LOG_MESSAGES.INSERT_COMPLETE);
  } catch (error) {
    logger.error(ERROR_MESSAGES.DB_INSERT, error);
    throw createDatabaseError(ERROR_MESSAGES.DB_INSERT, error);
  }
};

/**
 * Gets the total number of posts in the database
 * @param db - D1 database instance
 * @returns Post count
 * @throws {DatabaseError} If query fails
 */
export const getPostCount = async (db: D1Database): Promise<number> => {
  try {
    const result = await db
      .prepare("SELECT COUNT(*) as count FROM posts")
      .first<{ count: number }>();
    return result?.count ?? 0;
  } catch (error) {
    logger.error("Failed to get post count", error);
    throw createDatabaseError("Failed to get post count", error);
  }
};

/**
 * Gets posts by category
 * @param db - D1 database instance
 * @param category - Category to filter by
 * @returns Array of posts
 * @throws {DatabaseError} If query fails
 */
export const getPostsByCategory = async (
  db: D1Database,
  category: string
): Promise<D1Post[]> => {
  try {
    if (!category) {
      throw createDatabaseError("Category is required");
    }

    const { results } = await db
      .prepare("SELECT * FROM posts WHERE category = ?")
      .bind(category)
      .all();
    return results.map(mapRowToPost);
  } catch (error) {
    logger.error("Failed to get posts by category", error);
    throw createDatabaseError("Failed to get posts by category", error);
  }
};

/**
 * Gets posts by author
 * @param db - D1 database instance
 * @param author - Author to filter by
 * @returns Array of posts
 * @throws {DatabaseError} If query fails
 */
export const getPostsByAuthor = async (
  db: D1Database,
  author: string
): Promise<D1Post[]> => {
  try {
    if (!author) {
      throw createDatabaseError("Author is required");
    }

    const { results } = await db
      .prepare("SELECT * FROM posts WHERE author = ?")
      .bind(author)
      .all();
    return results.map(mapRowToPost);
  } catch (error) {
    logger.error("Failed to get posts by author", error);
    throw createDatabaseError("Failed to get posts by author", error);
  }
};

/**
 * Updates a post in the database
 * @param db - D1 database instance
 * @param id - Post ID to update
 * @param updates - Fields to update
 * @throws {DatabaseError} If update fails or invalid fields are provided
 */
export const updatePost = async (
  db: D1Database,
  id: string,
  updates: Partial<D1PostExtended>
): Promise<void> => {
  logger.info(LOG_MESSAGES.UPDATE_START(id));

  try {
    validatePostId(id);

    // Build the SET clause dynamically based on provided updates
    const setClauses: string[] = [];
    const values: (string | number | null)[] = [];

    // Validate and process each update field
    for (const [field, value] of Object.entries(updates)) {
      if (!isUpdatableField(field)) {
        logger.warn("Ignoring non-updatable field", { field });
        continue;
      }

      setClauses.push(`${field} = ?`);
      values.push(value);
    }

    if (setClauses.length === 0) {
      logger.warn("No valid fields to update", { id });
      return;
    }

    // Add updated_at timestamp
    setClauses.push("updated_at = ?");
    values.push(new Date().toISOString());

    // Add the id for the WHERE clause
    values.push(id);

    const statement = db.prepare(`
      UPDATE posts 
      SET ${setClauses.join(", ")}
      WHERE id = ?
    `);

    await statement.bind(...values).run();
    logger.info(LOG_MESSAGES.UPDATE_COMPLETE);
  } catch (error) {
    logger.error(ERROR_MESSAGES.DB_UPDATE, error);
    throw createDatabaseError(ERROR_MESSAGES.DB_UPDATE, error);
  }
};

/**
 * Gets all posts that have pending image generation tasks
 * @param db - D1 database instance
 * @returns Array of posts with pending tasks
 * @throws {DatabaseError} If query fails
 */
export const getPostsWithPendingImageTasks = async (
  db: D1Database
): Promise<D1Post[]> => {
  try {
    const { results } = await db
      .prepare("SELECT * FROM posts WHERE image_task_id IS NOT NULL")
      .all();
    return results.map(mapRowToPost);
  } catch (error) {
    logger.error("Failed to get posts with pending image tasks", error);
    throw createDatabaseError(
      "Failed to get posts with pending image tasks",
      error
    );
  }
};
