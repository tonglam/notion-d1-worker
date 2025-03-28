import type { D1Database } from "@cloudflare/workers-types";
import { ERROR_MESSAGES } from "../configs/constants.config";
import type { D1Post, D1PostExtended, UpdatableField } from "../types/db.types";
import {
  getChangedFields,
  mapRowToPost,
  withTimestamps,
} from "../utils/db.util";
import { createDatabaseError } from "../utils/errors.util";
import { createLogger } from "../utils/logger.util";

const logger = createLogger("D1Service");

/** Singleton instance of the D1 database */
let dbInstance: D1Database | null = null;

/**
 * Gets or initializes the D1 database instance
 * @returns D1 database instance
 * @throws {DatabaseError} If DB is not initialized
 */
const getDb = (): D1Database => {
  if (!dbInstance) {
    throw createDatabaseError("D1 database instance is not initialized");
  }
  return dbInstance;
};

/**
 * Initializes the D1 database instance
 * @param db - D1 database instance
 */
export const initializeDb = (db: D1Database): void => {
  dbInstance = db;
};

/**
 * Gets all posts from the database
 * @returns Array of posts
 * @throws {DatabaseError} If query fails
 */
export const getPosts = async (): Promise<D1Post[]> => {
  try {
    const { results } = await getDb().prepare("SELECT * FROM posts").all();
    return results.map(mapRowToPost);
  } catch (error) {
    logger.error("Failed to get posts", error);
    throw createDatabaseError("Failed to get posts", error);
  }
};

/**
 * Gets posts by category
 * @param category - Category to filter by
 * @returns Array of posts
 * @throws {DatabaseError} If query fails
 */
export const getPostsByCategory = async (
  category: string
): Promise<D1Post[]> => {
  try {
    if (!category) {
      throw createDatabaseError("Category is required");
    }

    const { results } = await getDb()
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
 * Gets all posts that have pending image generation tasks
 * @param limit - Maximum number of posts to return (optional)
 * @returns Array of posts with pending tasks
 * @throws {DatabaseError} If query fails
 */
export const getPostsWithPendingImageTasks = async (
  limit?: number
): Promise<D1Post[]> => {
  try {
    const query =
      "SELECT * FROM posts WHERE image_task_id IS NOT NULL" +
      (limit ? " LIMIT ?" : "");

    const stmt = getDb().prepare(query);
    const { results } = limit ? await stmt.bind(limit).all() : await stmt.all();
    return results.map(mapRowToPost);
  } catch (error) {
    logger.error("Failed to get posts with pending image tasks", error);
    throw createDatabaseError(
      "Failed to get posts with pending image tasks",
      error
    );
  }
};

/**
 * Gets posts with missing extended data (summary, reading time, tags, images, etc.)
 * @param limit - Maximum number of posts to return
 * @returns Array of posts with missing data
 * @throws {DatabaseError} If query fails
 */
export const getPostsWithMissingExtendedData = async (
  limit = 50
): Promise<D1Post[]> => {
  try {
    const { results } = await getDb()
      .prepare(
        `SELECT * FROM posts 
         WHERE summary IS NULL 
         OR mins_read IS NULL 
         OR image_task_id IS NULL 
         OR image_url IS NULL 
         OR tags IS NULL 
         OR r2_image_url IS NULL 
         LIMIT ?`
      )
      .bind(limit)
      .all();
    return results.map(mapRowToPost);
  } catch (error) {
    logger.error("Failed to get posts with missing extended data", error);
    throw createDatabaseError(
      "Failed to get posts with missing extended data",
      error
    );
  }
};

// Database Operations - Write
/**
 * Inserts posts into the database in batches
 * @param posts - Array of posts to insert
 * @throws {DatabaseError} If insertion fails
 */
export const insertPosts = async (posts: D1Post[]): Promise<void> => {
  logger.info(`Inserting ${posts.length} posts...`);

  try {
    // Log the first post for debugging
    if (posts.length > 0) {
      logger.info("First post to insert", { post: posts[0] });
    }

    // Validate posts before inserting
    for (const post of posts) {
      if (!post.id) {
        throw createDatabaseError("Post ID is required");
      }
      if (!post.title) {
        throw createDatabaseError(`Title is required for post ${post.id}`);
      }
      if (!post.category) {
        throw createDatabaseError(`Category is required for post ${post.id}`);
      }
      if (!post.author) {
        throw createDatabaseError(`Author is required for post ${post.id}`);
      }
      if (!post.notion_url) {
        throw createDatabaseError(`Notion URL is required for post ${post.id}`);
      }
      if (!post.notion_last_edited_at) {
        throw createDatabaseError(
          `Last edited time is required for post ${post.id}`
        );
      }
    }

    const db = getDb();
    const stmt = db.prepare("BEGIN");
    await stmt.run();

    try {
      for (const post of posts) {
        const timestampedPost = withTimestamps(
          post as unknown as Record<string, unknown>,
          true
        );
        const fields = Object.keys(timestampedPost);
        const values = fields.map((key) => timestampedPost[key]);
        const placeholders = fields.map(() => "?").join(", ");

        const query = `INSERT INTO posts (${fields.join(
          ", "
        )}) VALUES (${placeholders})`;
        await db
          .prepare(query)
          .bind(...values)
          .run();
      }

      await db.prepare("COMMIT").run();
      logger.info("Posts inserted successfully");
    } catch (error) {
      await db.prepare("ROLLBACK").run();
      throw error;
    }
  } catch (err: unknown) {
    const error = err as Error;
    logger.error("Failed to insert posts", error);
    throw createDatabaseError(ERROR_MESSAGES.DB_INSERT, error);
  }
};

/**
 * Updates multiple posts in the database
 * @param updates - Array of post updates
 * @throws {DatabaseError} If update fails
 */
export const updatePosts = async (
  updates: { id: string; data: Partial<D1PostExtended> }[]
): Promise<void> => {
  logger.info(`Updating ${updates.length} posts...`);

  try {
    const db = getDb();
    const stmt = db.prepare("BEGIN");
    await stmt.run();

    try {
      for (const { id, data } of updates) {
        const timestampedData = withTimestamps(
          data as Record<string, unknown>,
          false
        );
        const fields = Object.keys(timestampedData);
        const values = fields.map((key) => timestampedData[key]);
        const setClause = fields.map((field) => `${field} = ?`).join(", ");

        const query = `UPDATE posts SET ${setClause} WHERE id = ?`;
        await db
          .prepare(query)
          .bind(...values, id)
          .run();
      }

      await db.prepare("COMMIT").run();
      logger.info("Posts updated successfully");
    } catch (error) {
      await db.prepare("ROLLBACK").run();
      throw error;
    }
  } catch (error) {
    logger.error("Failed to update posts", error);
    throw createDatabaseError("Failed to update posts", error);
  }
};

/**
 * Updates a single post in the database
 * @param id - Post ID to update
 * @param updates - Fields to update
 * @throws {DatabaseError} If update fails or invalid fields are provided
 */
export const updatePost = async (
  id: string,
  updates: Partial<D1PostExtended>
): Promise<void> => {
  return updatePosts([{ id, data: updates }]);
};

/**
 * Gets post IDs and their last edited timestamps
 * @returns Array of post IDs and their last edited timestamps
 * @throws {DatabaseError} If query fails
 */
export const getPostTimestamps = async (): Promise<
  Array<{ id: string; notion_last_edited_at: string }>
> => {
  try {
    const { results } = await getDb()
      .prepare("SELECT id, notion_last_edited_at FROM posts")
      .all();
    return results as Array<{ id: string; notion_last_edited_at: string }>;
  } catch (error) {
    logger.error("Failed to get post timestamps", error);
    throw createDatabaseError("Failed to get post timestamps", error);
  }
};

/**
 * Gets posts by IDs
 * @param ids - Array of post IDs to fetch
 * @returns Array of posts
 * @throws {DatabaseError} If query fails
 */
export const getPostsByIds = async (ids: string[]): Promise<D1Post[]> => {
  if (ids.length === 0) return [];

  try {
    const placeholders = ids.map(() => "?").join(",");
    const { results } = await getDb()
      .prepare(`SELECT * FROM posts WHERE id IN (${placeholders})`)
      .bind(...ids)
      .all();
    return results.map(mapRowToPost);
  } catch (error) {
    logger.error("Failed to get posts by IDs", error);
    throw createDatabaseError("Failed to get posts by IDs", error);
  }
};

/**
 * Upserts multiple posts into the database
 * @param posts - Array of posts to upsert
 * @param existingIds - Set of existing post IDs
 * @throws {DatabaseError} If upsert fails
 */
export const upsertPosts = async (
  posts: D1Post[],
  existingIds: Set<string>
): Promise<void> => {
  if (posts.length === 0) return;

  logger.info(`Upserting ${posts.length} posts...`);

  try {
    // Split posts into inserts and updates
    const postsToInsert = posts.filter((p) => !existingIds.has(p.id));
    const postsToUpdate = posts.filter((p) => existingIds.has(p.id));

    // Process inserts
    if (postsToInsert.length > 0) {
      logger.info(`Inserting ${postsToInsert.length} new posts`);
      await insertPosts(postsToInsert);
    }

    // Process updates - but only update fields that changed
    if (postsToUpdate.length > 0) {
      logger.info(
        `Checking ${postsToUpdate.length} existing posts for updates`
      );

      // Get existing posts data
      const existingPosts = await getPostsByIds(postsToUpdate.map((p) => p.id));
      const existingPostsMap = new Map(existingPosts.map((p) => [p.id, p]));

      // Prepare updates for posts with actual changes
      const updates = postsToUpdate
        .map((newPost) => {
          const existingPost = existingPostsMap.get(newPost.id);
          if (!existingPost) return null; // Should never happen due to existingIds check

          const changes = getChangedFields(newPost, existingPost);
          return Object.keys(changes).length > 0
            ? { id: newPost.id, data: changes }
            : null;
        })
        .filter(
          (
            update
          ): update is { id: string; data: Pick<D1Post, UpdatableField> } =>
            update !== null
        );

      if (updates.length > 0) {
        logger.info(`Updating ${updates.length} posts with changes`);
        await updatePosts(updates);
      } else {
        logger.info("No posts require updates");
      }
    }

    logger.info("Posts upserted successfully");
  } catch (error) {
    logger.error("Failed to upsert posts", error);
    throw createDatabaseError("Failed to upsert posts", error);
  }
};

/**
 * Updates posts with a custom SQL query in batches
 * @param sql - SQL query with placeholders
 * @param batchData - Array of data to bind to placeholders
 * @throws {DatabaseError} If update fails
 */
export const updatePostsWithSQL = async (
  sql: string,
  batchData: unknown[][]
): Promise<void> => {
  logger.info(`Updating posts with custom SQL, ${batchData.length} batches...`);

  try {
    const db = getDb();
    const stmt = db.prepare("BEGIN");
    await stmt.run();

    try {
      for (const data of batchData) {
        await db
          .prepare(sql)
          .bind(...data)
          .run();
      }

      await db.prepare("COMMIT").run();
      logger.info("Posts updated successfully");
    } catch (error) {
      await db.prepare("ROLLBACK").run();
      throw error;
    }
  } catch (error) {
    logger.error("Failed to update posts with custom SQL", error);
    throw createDatabaseError("Failed to update posts with custom SQL", error);
  }
};
