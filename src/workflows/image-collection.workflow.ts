import { collectPendingImages } from "../services/image-collector.service";
import type {
  AIServiceConfig,
  Env,
  ImageCollectionResult,
} from "../types/types";
import { handleError } from "../utils/errors.util";
import { createLogger } from "../utils/logger.util";
import { validateEnv } from "../utils/validation.util";

const logger = createLogger("ImageCollectionWorkflow");

/**
 * Creates AI service configuration from environment variables
 * @param env - Environment variables
 * @returns AI service configuration
 */
const createAIConfig = (env: Env): AIServiceConfig => ({
  dashscopeApiKey: env.DASHSCOPE_API_KEY,
  maxAttempts: 1, // Only check once per task
  checkInterval: 0, // No need for interval in collection workflow
});

/**
 * Image collection workflow that runs daily to check and update pending image generation tasks.
 * This workflow:
 * 1. Finds all posts with pending image tasks
 * 2. Checks the status of each task
 * 3. Updates posts with completed images
 * 4. Cleans up failed tasks
 * @param env - Environment variables
 * @returns Collection result with status and stats
 */
export const imageCollectionWorkflow = async (
  env: Env
): Promise<ImageCollectionResult> => {
  logger.info("Starting image collection workflow");

  try {
    validateEnv(env);
    const config = createAIConfig(env);

    const result = await collectPendingImages(env.DB, config);

    if (result.success) {
      logger.info("Image collection completed", {
        postsProcessed: result.postsProcessed,
        imagesCollected: result.imagesCollected,
        stats: result.stats,
      });
    } else {
      logger.warn("Image collection completed with warnings", {
        postsProcessed: result.postsProcessed,
        imagesCollected: result.imagesCollected,
        error: result.error,
        stats: result.stats,
      });
    }

    return result;
  } catch (error) {
    const collectionError = handleError(error);
    logger.error("Image collection failed", {
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
