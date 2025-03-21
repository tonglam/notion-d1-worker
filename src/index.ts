import { ERROR_MESSAGES, LOG_MESSAGES } from "./constants";
import { clearPosts, getPostCount, insertPosts } from "./services/d1";
import { fetchPublishedPosts, transformToD1Posts } from "./services/notion";
import type { Env, SyncResult } from "./types";
import { createDatabaseError, handleError } from "./utils/errors";
import { createLogger } from "./utils/logger";

const logger = createLogger("NotionSync");

const validateEnv = (env: Env): void => {
  if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) {
    throw createDatabaseError(ERROR_MESSAGES.MISSING_ENV, "CONFIG_ERROR");
  }
};

const sync = async (env: Env): Promise<SyncResult> => {
  logger.info(LOG_MESSAGES.SYNC_START);

  try {
    validateEnv(env);

    // Get current post count for comparison
    const beforeCount = await getPostCount(env.DB);

    // Fetch posts from Notion
    const notionPages = await fetchPublishedPosts(
      env.NOTION_TOKEN,
      env.NOTION_DATABASE_ID
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
      error: syncError,
    };
  }
};

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const result = await sync(env);

    if (!result.success) {
      throw result.error;
    }
  },
};
