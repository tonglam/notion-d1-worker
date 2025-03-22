import type { D1Database } from "@cloudflare/workers-types";
import { LOG_MESSAGES } from "../configs/constants.config";
import type { D1Post, SyncResult, SyncStats } from "../types/types";
import { createValidationError, handleError } from "../utils/errors.util";
import { createLogger } from "../utils/logger.util";
import { clearPosts, getPostCount, insertPosts } from "./d1.service";
import { fetchPublishedPosts, transformToD1Posts } from "./notion.service";

const logger = createLogger("SyncService");

/**
 * Validates sync parameters
 * @param notionToken - Notion API token
 * @param notionDatabaseId - Notion database ID
 * @throws {ValidationError} If parameters are invalid
 */
const validateSyncParams = (
  notionToken: string,
  notionDatabaseId: string
): void => {
  if (!notionToken) {
    throw createValidationError("Notion API token is required");
  }

  if (!notionDatabaseId) {
    throw createValidationError("Notion database ID is required");
  }

  if (!/^[a-f0-9-]+$/i.test(notionDatabaseId)) {
    throw createValidationError("Invalid Notion database ID format");
  }
};

/**
 * Collects sync statistics
 * @param beforeCount - Post count before sync
 * @param afterCount - Post count after sync
 * @param postsProcessed - Number of posts processed
 * @returns Sync statistics
 */
const collectSyncStats = (
  beforeCount: number,
  afterCount: number,
  postsProcessed: number
): SyncStats => ({
  beforeCount,
  afterCount,
  postsProcessed,
  delta: afterCount - beforeCount,
  timestamp: new Date().toISOString(),
});

/**
 * Syncs posts from Notion to D1 within a transaction
 * @param db - D1 database instance
 * @param posts - Posts to sync
 * @returns Post count after sync
 * @throws {DatabaseError} If database operations fail
 */
const syncPostsTransaction = async (
  db: D1Database,
  posts: D1Post[]
): Promise<number> => {
  // Start transaction
  await db.prepare("BEGIN TRANSACTION").run();

  try {
    // Clear existing posts
    logger.info(LOG_MESSAGES.CLEAR_START);
    await clearPosts(db);
    logger.info(LOG_MESSAGES.CLEAR_COMPLETE);

    // Insert new posts
    logger.info(LOG_MESSAGES.INSERT_START(posts.length));
    await insertPosts(db, posts);
    logger.info(LOG_MESSAGES.INSERT_COMPLETE);

    // Get new post count
    const afterCount = await getPostCount(db);

    // Commit transaction
    await db.prepare("COMMIT").run();
    return afterCount;
  } catch (error) {
    // Rollback on error
    logger.error("Rolling back transaction", error);
    await db.prepare("ROLLBACK").run();
    throw error;
  }
};

/**
 * Syncs posts from Notion to D1.
 * This is a lower-level service function used by the sync workflow.
 * @param notionToken - Notion API token
 * @param notionDatabaseId - Notion database ID
 * @param db - D1 database instance
 * @returns Sync result with status and counts
 */
export const syncPosts = async (
  notionToken: string,
  notionDatabaseId: string,
  db: D1Database
): Promise<SyncResult> => {
  try {
    validateSyncParams(notionToken, notionDatabaseId);
    logger.info(LOG_MESSAGES.SYNC_START);

    // Get current post count for comparison
    const beforeCount = await getPostCount(db);
    logger.debug("Current post count", { count: beforeCount });

    // Fetch and transform posts
    logger.info(LOG_MESSAGES.FETCH_START);
    const pages = await fetchPublishedPosts(notionToken, notionDatabaseId);
    if (pages.length === 0) {
      logger.warn("No published posts found in Notion");
      return {
        success: true,
        postsProcessed: 0,
        stats: collectSyncStats(beforeCount, beforeCount, 0),
      };
    }
    logger.info(LOG_MESSAGES.FETCH_COMPLETE(pages.length));

    logger.info(LOG_MESSAGES.TRANSFORM_START);
    const posts = transformToD1Posts(pages);
    logger.info(LOG_MESSAGES.TRANSFORM_COMPLETE(posts.length));

    // Sync posts within transaction
    const afterCount = await syncPostsTransaction(db, posts);

    // Collect and log statistics
    const stats = collectSyncStats(beforeCount, afterCount, posts.length);
    logger.info("Sync statistics", { ...stats });

    return {
      success: true,
      postsProcessed: posts.length,
      stats,
    };
  } catch (error) {
    const syncError = handleError(error);
    logger.error("Sync failed", {
      error: syncError.message,
      code: syncError.code,
      cause: syncError.cause,
    });

    return {
      success: false,
      postsProcessed: 0,
      error: syncError.message,
    };
  }
};
