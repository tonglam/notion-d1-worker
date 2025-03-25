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
  const startTime = new Date();
  logger.info("Starting sync workflow", {
    timestamp: startTime.toISOString(),
    timezoneOffset: startTime.getTimezoneOffset(),
  });

  try {
    // Step 1: Fetch published posts from Notion
    logger.info("Step 1: Fetching published posts from Notion");
    const pages = await fetchPublishedPosts();
    if (pages.length === 0) {
      logger.info("No published posts found in Notion", {
        timestamp: new Date().toISOString(),
      });
      return { success: true, postsProcessed: 0 };
    }
    logger.info("Fetched posts from Notion", {
      totalPosts: pages.length,
      firstPostId: pages[0]?.id,
      lastPostId: pages[pages.length - 1]?.id,
    });

    // Step 2: Get existing posts from D1
    logger.info("Step 2: Fetching existing posts from D1");
    const existingPosts = await getPostTimestamps();
    logger.info("Fetched existing posts from D1", {
      totalExistingPosts: existingPosts.length,
    });

    // Create a map of existing posts for quick lookup
    const existingPostsMap = new Map(
      existingPosts.map((post) => [post.id, post.notion_last_edited_at])
    );
    logger.info("Created existing posts map", {
      mapSize: existingPostsMap.size,
    });

    // Step 3: Get raw pages and transform them
    logger.info("Step 3: Fetching and transforming raw pages");
    const rawPages = await fetchRawPages();
    logger.info("Fetched raw pages", {
      totalRawPages: rawPages.length,
    });

    const notionPosts = transformToD1Posts(rawPages);
    logger.info("Transformed posts", {
      totalTransformedPosts: notionPosts.length,
    });

    // Step 4: Filter posts that need processing
    logger.info("Step 4: Filtering posts that need processing");
    const postsToProcess = notionPosts.filter((post: D1Post) => {
      const existingLastEdited = existingPostsMap.get(post.id);
      return (
        !existingLastEdited || existingLastEdited !== post.notion_last_edited_at
      );
    });

    if (postsToProcess.length === 0) {
      logger.info("No posts need updating", {
        timestamp: new Date().toISOString(),
      });
      return { success: true, postsProcessed: 0 };
    }

    logger.info("Found posts to process", {
      totalPostsToProcess: postsToProcess.length,
      postsToProcessIds: postsToProcess.map((p) => p.id),
    });

    // Step 5: Upsert posts to D1
    logger.info("Step 5: Upserting posts to D1");
    const existingIds = new Set(existingPostsMap.keys());
    await upsertPosts(postsToProcess, existingIds);

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    logger.info("Sync workflow completed successfully", {
      success: true,
      postsProcessed: postsToProcess.length,
      durationMs: duration,
      timestamp: endTime.toISOString(),
    });

    return {
      success: true,
      postsProcessed: postsToProcess.length,
      stats: {
        beforeCount: existingPosts.length,
        afterCount: existingPosts.length + postsToProcess.length,
        postsProcessed: postsToProcess.length,
        delta: postsToProcess.length,
        timestamp: endTime.toISOString(),
      },
    };
  } catch (error) {
    const syncError = handleError(error);
    logger.error("Sync workflow failed", {
      error: syncError.message,
      code: syncError.code,
      cause: syncError.cause,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      postsProcessed: 0,
      error: syncError.message,
    };
  }
};
