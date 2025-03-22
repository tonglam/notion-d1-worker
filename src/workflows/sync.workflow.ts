import { LOG_MESSAGES } from "../configs/constants.config";
import { clearPosts, getPostCount, insertPosts } from "../services/d1.service";
import {
  fetchPublishedPosts,
  transformToD1Posts,
} from "../services/notion.service";
import type { Env, SyncResult } from "../types/types";
import { handleError } from "../utils/errors.util";
import { createLogger } from "../utils/logger.util";
import { validateEnv } from "../utils/validation.util";

const logger = createLogger("SyncWorkflow");

/**
 * Main sync workflow that runs daily to sync posts from Notion to D1.
 * This workflow:
 * 1. Fetches posts from Notion
 * 2. Transforms them to D1 format
 * 3. Updates the D1 database
 */
export const syncWorkflow = async (env: Env): Promise<SyncResult> => {
  logger.info(LOG_MESSAGES.SYNC_START);

  try {
    validateEnv(env);

    // Get current post count for comparison
    const beforeCount = await getPostCount(env.DB);

    // Fetch posts from Notion
    const notionPages = await fetchPublishedPosts(
      env.NOTION_TOKEN,
      env.NOTION_ROOT_PAGE_ID
    );

    // Transform to D1 format
    const posts = transformToD1Posts(notionPages);

    // Clear existing posts
    await clearPosts(env.DB);

    // Insert new posts
    await insertPosts(env.DB, posts);

    // Get new post count
    const afterCount = await getPostCount(env.DB);

    logger.info(
      `Sync completed. Before: ${beforeCount} posts, After: ${afterCount} posts`
    );

    return {
      success: true,
      postsProcessed: posts.length,
    };
  } catch (error) {
    const syncError = handleError(error);
    logger.error("Sync failed", syncError);

    return {
      success: false,
      postsProcessed: 0,
      error: String(syncError),
    };
  }
};
