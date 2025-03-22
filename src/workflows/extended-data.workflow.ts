import {
  estimateReadingTime,
  generateImage,
  generatePostSummary,
  generatePostTags,
} from "../services/ai.service";
import {
  getPostsWithMissingExtendedData,
  updatePost,
} from "../services/db.service";
import { fetchPageContent } from "../services/notion.service";
import type { D1PostExtended, ExtendedDataResult } from "../types";
import { createLogger } from "../utils/logger.util";

const logger = createLogger("ExtendedDataWorkflow");

/**
 * Workflow that processes posts with missing extended data.
 * Runs daily to fill in missing summaries, tags, reading times, and images.
 * Limited to 50 posts per run due to Cloudflare's free tier quota.
 */
export const extendedDataWorkflow = async (): Promise<ExtendedDataResult> => {
  logger.info("Starting extended data workflow");

  try {
    // Get posts with missing data (limited to 50)
    const posts = await getPostsWithMissingExtendedData();

    if (posts.length === 0) {
      logger.info("No posts with missing extended data found");
      return { success: true, postsProcessed: 0 };
    }

    logger.info(`Processing ${posts.length} posts with missing data`);

    // Process each post
    for (const post of posts) {
      const updates: Partial<D1PostExtended> = {};

      // Fetch content from Notion first
      const content = await fetchPageContent(post.id);
      if (!content) {
        logger.warn(`Failed to fetch content for post ${post.id}`);
        continue;
      }

      // Generate missing summary
      if (!post.summary) {
        const summaryResult = await generatePostSummary(content);
        if (summaryResult.data?.summary) {
          updates.summary = summaryResult.data.summary;
        }
      }

      // Generate missing tags
      if (!post.tags) {
        const tagsResult = await generatePostTags(content);
        if (tagsResult.data?.tags) {
          updates.tags = tagsResult.data.tags;
        }
      }

      // Generate missing reading time
      if (!post.mins_read) {
        const readingTimeResult = await estimateReadingTime(content);
        if (readingTimeResult.data?.mins_read) {
          updates.mins_read = readingTimeResult.data.mins_read;
        }
      }

      // Generate missing image if no task is in progress
      if (!post.image_url && !post.image_task_id) {
        const imageResult = await generateImage(post);
        if (imageResult.data?.task_id) {
          updates.image_task_id = imageResult.data.task_id;
        }
      }

      // Update post if we have any changes
      if (Object.keys(updates).length > 0) {
        await updatePost(post.id, updates);
        logger.info(`Updated extended data for post ${post.id}`, { updates });
      }
    }

    return {
      success: true,
      postsProcessed: posts.length,
    };
  } catch (error) {
    logger.error("Extended data workflow failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      postsProcessed: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
