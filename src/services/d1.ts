import type { D1Database } from "@cloudflare/workers-types";
import { BATCH_SIZE, ERROR_MESSAGES, LOG_MESSAGES } from "../constants";
import type { D1Post } from "../types";
import { createDatabaseError } from "../utils/errors";
import { createLogger } from "../utils/logger";

const logger = createLogger("D1Service");

export const getPosts = async (db: D1Database): Promise<D1Post[]> => {
  const { results } = await db.prepare("SELECT * FROM posts").all();
  return results.map(
    (row): D1Post => ({
      id: row.id as string,
      title: row.title as string,
      slug: row.slug as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      published: Boolean(row.published),
      category: row.category as string,
      tags: row.tags as string,
      author: row.author as string,
      excerpt: row.excerpt as string | null,
      summary: row.summary as string | null,
      mins_read: row.mins_read as number | null,
      image_url: row.image_url as string | null,
      notion_url: row.notion_url as string,
      content_key: row.content_key as string,
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
        .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .join(",");

      const values = batch.flatMap((post) => [
        post.id,
        post.title,
        post.slug,
        post.created_at,
        post.updated_at,
        post.published ? 1 : 0,
        post.category,
        post.tags,
        post.author,
        post.excerpt,
        post.summary,
        post.mins_read,
        post.image_url,
        post.notion_url,
        post.content_key,
      ]);

      const statement = db.prepare(`
        INSERT INTO posts (
          id, title, slug, created_at, updated_at, published,
          category, tags, author, excerpt, summary, mins_read,
          image_url, notion_url, content_key
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

export const getPostsBySlug = async (
  db: D1Database,
  slugs: string[]
): Promise<D1Post[]> => {
  try {
    if (slugs.length === 0) return [];

    const placeholders = slugs.map(() => "?").join(",");
    const statement = db.prepare(
      `SELECT * FROM posts WHERE slug IN (${placeholders})`
    );

    const results = await statement.bind(...slugs).all<D1Post>();
    return results.results;
  } catch (error) {
    logger.error("Failed to get posts by slug", error);
    throw createDatabaseError("Failed to get posts by slug", error);
  }
};
