import type { D1Database } from "@cloudflare/workers-types";
import { BATCH_SIZE, ERROR_MESSAGES, LOG_MESSAGES } from "../constants";
import type { D1Post, D1PostExtended } from "../types";
import { createDatabaseError } from "../utils/errors";
import { createLogger } from "../utils/logger";

const logger = createLogger("D1Service");

export const getPosts = async (db: D1Database): Promise<D1Post[]> => {
  const { results } = await db.prepare("SELECT * FROM posts").all();
  return results.map(
    (row): D1Post => ({
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
    })
  );
};

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

export const insertPosts = async (
  db: D1Database,
  posts: D1Post[]
): Promise<void> => {
  logger.info(LOG_MESSAGES.INSERT_START(posts.length));

  try {
    const batches = [];
    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const batch = posts.slice(i, i + BATCH_SIZE);
      logger.debug(
        LOG_MESSAGES.BATCH_PROGRESS(
          Math.floor(i / BATCH_SIZE) + 1,
          posts.length
        )
      );

      const placeholders = batch
        .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
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
        post.summary,
        post.mins_read,
        post.image_url,
        post.notion_url,
        post.tags,
        post.r2_image_url,
      ]);

      const statement = db.prepare(`
        INSERT INTO posts (
          id, title, created_at, updated_at, notion_last_edited_at,
          category, author, excerpt, summary, mins_read,
          image_url, notion_url, tags, r2_image_url
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

export const getPostsByCategory = async (
  db: D1Database,
  category: string
): Promise<D1Post[]> => {
  try {
    const { results } = await db
      .prepare("SELECT * FROM posts WHERE category = ?")
      .bind(category)
      .all();
    return results.map(
      (row): D1Post => ({
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
      })
    );
  } catch (error) {
    logger.error("Failed to get posts by category", error);
    throw createDatabaseError("Failed to get posts by category", error);
  }
};

export const getPostsByAuthor = async (
  db: D1Database,
  author: string
): Promise<D1Post[]> => {
  try {
    const { results } = await db
      .prepare("SELECT * FROM posts WHERE author = ?")
      .bind(author)
      .all();
    return results.map(
      (row): D1Post => ({
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
      })
    );
  } catch (error) {
    logger.error("Failed to get posts by author", error);
    throw createDatabaseError("Failed to get posts by author", error);
  }
};

export const updatePost = async (
  db: D1Database,
  id: string,
  updates: Partial<D1PostExtended>
): Promise<void> => {
  logger.info(LOG_MESSAGES.UPDATE_START(id));

  try {
    // Build the SET clause dynamically based on provided updates
    const setClauses: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.excerpt !== undefined) {
      setClauses.push("excerpt = ?");
      values.push(updates.excerpt);
    }
    if (updates.summary !== undefined) {
      setClauses.push("summary = ?");
      values.push(updates.summary);
    }
    if (updates.mins_read !== undefined) {
      setClauses.push("mins_read = ?");
      values.push(updates.mins_read);
    }
    if (updates.image_url !== undefined) {
      setClauses.push("image_url = ?");
      values.push(updates.image_url);
    }
    if (updates.tags !== undefined) {
      setClauses.push("tags = ?");
      values.push(updates.tags);
    }
    if (updates.r2_image_url !== undefined) {
      setClauses.push("r2_image_url = ?");
      values.push(updates.r2_image_url);
    }

    if (setClauses.length === 0) {
      logger.warn("No fields to update");
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
