import { checkImageStatus } from "../services/ai.service";
import {
  getPostsWithPendingImageTasks,
  updatePost,
} from "../services/db.service";
import type { ImageCollectionResult } from "../types";
import { handleError } from "../utils/errors.util";
import { createLogger } from "../utils/logger.util";

const logger = createLogger("ImageCollectionWorkflow");

/**
 * Workflow that checks up to 50 pending image generation tasks.
 * This is limited by Cloudflare's free tier quota.
 */
export const imageCollectionWorkflow =
  async (): Promise<ImageCollectionResult> => {
    logger.info("Starting image collection workflow");

    try {
      // Get up to 50 pending tasks (free tier limit)
      const posts = await getPostsWithPendingImageTasks(50);

      if (posts.length === 0) {
        logger.info("No pending image tasks found");
        return { success: true, postsProcessed: 0, imagesCollected: 0 };
      }

      logger.info(`Processing ${posts.length} pending image tasks`);

      let imagesCollected = 0;

      // Check each task
      for (const post of posts) {
        if (!post.image_task_id) continue;

        const result = await checkImageStatus(post.image_task_id, post.id);

        if (result.data?.image_url) {
          // Success - update post with both URLs and clear task
          await updatePost(post.id, {
            image_task_id: null,
            image_url: result.data.image_url,
            r2_image_url: result.data.r2_image_url || null,
          });
          imagesCollected++;
        } else if (result.error) {
          // Failed - clear task to allow regeneration
          await updatePost(post.id, {
            image_task_id: null,
          });
        }
        // If pending, do nothing and check again next time
      }

      return {
        success: true,
        postsProcessed: posts.length,
        imagesCollected,
      };
    } catch (error) {
      const collectionError = handleError(error);
      logger.error("Image collection workflow failed", {
        error: collectionError.message,
        code: collectionError.code,
        cause: collectionError.cause,
      });
      return {
        success: false,
        postsProcessed: 0,
        imagesCollected: 0,
        error: collectionError.message,
      };
    }
  };
