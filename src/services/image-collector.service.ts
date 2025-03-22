import type { D1Database } from "@cloudflare/workers-types";
import { BATCH_SIZE } from "../configs/constants.config";
import type {
  AIServiceConfig,
  D1Post,
  ImageCollectionResult,
  ImageCollectionStats,
} from "../types/types";
import { createAIProviderError } from "../utils/errors.util";
import { createLogger } from "../utils/logger.util";
import { RateLimiter } from "../utils/rate-limiter.util";
import { checkImageStatus } from "./ai.service";
import { getPostsWithPendingImageTasks, updatePost } from "./d1.service";

const logger = createLogger("ImageCollectorService");

// Rate limits for image collection
const RATE_LIMITS = {
  MAX_REQUESTS_PER_SECOND: 5,
  MAX_REQUESTS_PER_MINUTE: 100,
} as const;

const rateLimiter = new RateLimiter({
  maxRequestsPerSecond: RATE_LIMITS.MAX_REQUESTS_PER_SECOND,
  maxRequestsPerMinute: RATE_LIMITS.MAX_REQUESTS_PER_MINUTE,
});

/**
 * Validates the maximum number of concurrent tasks
 * @param count - Number of pending tasks
 * @throws {AIProviderError} If too many concurrent tasks
 */
const validateConcurrentTasks = (count: number): void => {
  const MAX_CONCURRENT_TASKS = 50; // Free tier limit
  if (count > MAX_CONCURRENT_TASKS) {
    throw createAIProviderError(
      `Too many concurrent tasks (${count}). Maximum allowed is ${MAX_CONCURRENT_TASKS}.`
    );
  }
};

/**
 * Collects statistics about image collection
 * @param postsProcessed - Number of posts processed
 * @param imagesCollected - Number of images collected
 * @param failedTasks - Number of failed tasks
 * @returns Collection statistics
 */
const collectStats = (
  postsProcessed: number,
  imagesCollected: number,
  failedTasks: number
): ImageCollectionStats => ({
  postsProcessed,
  imagesCollected,
  failedTasks,
  remainingTasks: postsProcessed - imagesCollected - failedTasks,
  timestamp: new Date().toISOString(),
});

/**
 * Processes a batch of posts with pending image tasks
 * @param posts - Array of posts to process
 * @param config - AI service configuration
 * @param db - D1 database instance
 * @returns Processing results for the batch
 */
const processBatch = async (
  posts: D1Post[],
  config: AIServiceConfig,
  db: D1Database
): Promise<{
  imagesCollected: number;
  failedTasks: number;
}> => {
  let imagesCollected = 0;
  let failedTasks = 0;

  for (const post of posts) {
    if (!post.image_task_id) continue;

    try {
      logger.debug("Processing task", {
        postId: post.id,
        taskId: post.image_task_id,
      });

      const result = await rateLimiter.wrap(() =>
        checkImageStatus(post.image_task_id!, config, post.id, db)
      );

      if (result.data?.image_url) {
        imagesCollected++;
        logger.info("Image collected successfully", {
          postId: post.id,
          taskId: post.image_task_id,
          imageUrl: result.data.image_url,
        });

        // Clear task ID after successful collection
        await updatePost(db, post.id, { image_task_id: null });
      } else if (result.error) {
        failedTasks++;
        logger.error("Task failed", {
          postId: post.id,
          taskId: post.image_task_id,
          error: result.error,
        });

        // Clear failed task ID and update error message
        await updatePost(db, post.id, {
          image_task_id: null,
          error: result.error,
        });
      } else {
        logger.debug("Task still pending", {
          postId: post.id,
          taskId: post.image_task_id,
        });
      }
    } catch (error) {
      failedTasks++;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to process task", {
        postId: post.id,
        taskId: post.image_task_id,
        error: errorMessage,
      });

      // Update post with error message
      await updatePost(db, post.id, {
        image_task_id: null,
        error: errorMessage,
      });
    }
  }

  return { imagesCollected, failedTasks };
};

/**
 * Collects results from pending image generation tasks.
 * This is designed to run as a separate workflow from the main sync.
 * @param db - D1 database instance
 * @param config - AI service configuration
 * @returns Collection result with status and counts
 */
export const collectPendingImages = async (
  db: D1Database,
  config: AIServiceConfig
): Promise<ImageCollectionResult> => {
  try {
    // Get all posts with pending image tasks
    const posts = await getPostsWithPendingImageTasks(db);

    logger.info("Starting image collection", {
      pendingTasks: posts.length,
    });

    // Validate concurrent tasks
    validateConcurrentTasks(posts.length);

    let totalImagesCollected = 0;
    let totalFailedTasks = 0;

    // Process posts in batches
    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const batch = posts.slice(i, i + BATCH_SIZE);
      logger.debug("Processing batch", {
        batchNumber: Math.floor(i / BATCH_SIZE) + 1,
        batchSize: batch.length,
      });

      const { imagesCollected, failedTasks } = await processBatch(
        batch,
        config,
        db
      );

      totalImagesCollected += imagesCollected;
      totalFailedTasks += failedTasks;
    }

    // Collect and log statistics
    const stats = collectStats(
      posts.length,
      totalImagesCollected,
      totalFailedTasks
    );
    logger.info("Image collection completed", { ...stats });

    return {
      success: true,
      postsProcessed: posts.length,
      imagesCollected: totalImagesCollected,
      stats,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Image collection failed", { error: errorMessage });

    return {
      success: false,
      postsProcessed: 0,
      imagesCollected: 0,
      error: errorMessage,
    };
  }
};
