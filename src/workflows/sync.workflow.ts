import { getPostTimestamps, upsertPosts } from "@/services/db.service";
import {
  fetchPublishedPosts,
  fetchRawPages,
  transformToD1Posts,
} from "../services/notion.service";
import type { D1Post, SyncResult } from "../types";
import { handleError } from "../utils/errors.util";
import { createLogger } from "../utils/logger.util";

const logger = createLogger("SyncWorkflow");

/**
 * Main sync workflow that runs daily to sync posts from Notion to D1.
 */
export const syncWorkflow = async (): Promise<SyncResult> => {
  logger.info("Starting sync workflow");

  try {
    const pages = await fetchPublishedPosts();
    if (pages.length === 0) {
      logger.info("No published posts found in Notion");
      return { success: true, postsProcessed: 0 };
    }

    logger.info(`Fetched ${pages.length} published posts from Notion`);

    // Get existing posts timestamps from D1
    const existingPosts = await getPostTimestamps();

    // Create a map of existing posts for quick lookup
    const existingPostsMap = new Map(
      existingPosts.map((post) => [post.id, post.notion_last_edited_at])
    );

    // Get raw pages and transform them
    const rawPages = await fetchRawPages();
    const notionPosts = transformToD1Posts(rawPages);

    // Filter posts that need processing (new or updated)
    const postsToProcess = notionPosts.filter((post: D1Post) => {
      const existingLastEdited = existingPostsMap.get(post.id);
      return (
        !existingLastEdited || existingLastEdited !== post.notion_last_edited_at
      );
    });

    if (postsToProcess.length === 0) {
      logger.info("No posts need updating");
      return { success: true, postsProcessed: 0 };
    }

    logger.info(`Processing ${postsToProcess.length} new or updated posts`);

    // Pass existing IDs to upsertPosts to avoid redundant DB query
    const existingIds = new Set(existingPostsMap.keys());
    await upsertPosts(postsToProcess, existingIds);

    return {
      success: true,
      postsProcessed: postsToProcess.length,
    };
  } catch (error) {
    const syncError = handleError(error);
    logger.error("Sync workflow failed", {
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
