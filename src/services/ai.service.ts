import {
  READING_TIME_PROMPT,
  SUMMARY_PROMPT,
  TAGS_PROMPT,
} from "../configs/prompts.config";
import type { GenerationResult, ImageResult } from "../types/types";
import { createAIProviderError } from "../utils/errors.util";
import { createLogger } from "../utils/logger.util";
import { validateTokenLimits } from "../utils/validation.util";
import * as dashscope from "./ai-providers/dashscope.provider";
import * as deepseek from "./ai-providers/deepseek.provider";
import { updatePost } from "./d1.service";

const logger = createLogger("AIService");

/**
 * Generates a featured image using DashScope.
 * Handles task creation and database updates.
 * @param prompt - Input prompt for image generation
 * @param apiKey - DashScope API key
 * @param postId - ID of the post to update
 * @param db - D1 database instance
 * @returns Generation result with task ID or error
 */
export const generateImage = async (
  prompt: string,
  apiKey: string,
  postId: string,
  db: D1Database
): Promise<GenerationResult<ImageResult>> => {
  try {
    const result = await dashscope.createImageTask(prompt, apiKey);

    if (result.error || !result.taskId) {
      logger.warn("Failed to create image task", {
        postId,
        error: result.error,
      });
      return { error: result.error || "Failed to create task" };
    }

    // Store task ID in D1
    await updatePost(db, postId, {
      image_task_id: result.taskId,
    });

    return {
      data: { task_id: result.taskId },
    };
  } catch (error) {
    logger.error("Failed to generate image:", error);
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Checks the status of an image generation task.
 * Updates the post when the image is ready.
 * @param taskId - Task ID to check
 * @param apiKey - DashScope API key
 * @param postId - ID of the post to update
 * @param db - D1 database instance
 * @returns Generation result with status or error
 */
export const checkImageStatus = async (
  taskId: string,
  apiKey: string,
  postId: string,
  db: D1Database
): Promise<GenerationResult<ImageResult>> => {
  try {
    const result = await dashscope.getTaskStatus(taskId, apiKey);

    if (result.status === "SUCCEEDED" && result.imageUrl) {
      logger.info("Image generation completed", {
        postId,
        taskId,
        imageUrl: result.imageUrl,
      });

      await updatePost(db, postId, {
        image_url: result.imageUrl,
        image_task_id: null,
      });

      return {
        data: {
          image_url: result.imageUrl,
          task_id: taskId,
        },
      };
    }

    if (result.status === "FAILED") {
      logger.warn("Image generation failed", {
        postId,
        taskId,
        error: result.error,
      });

      return {
        error: result.error || "Task failed",
        data: { task_id: taskId },
      };
    }

    // Still pending
    return {
      data: { task_id: taskId },
    };
  } catch (error) {
    logger.error("Failed to check image status:", error);
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Generates a summary for a post using DeepSeek.
 * @param content - Post content to summarize
 * @returns Generated summary text or error
 */
export const generatePostSummary = async (
  content: string
): Promise<GenerationResult<{ summary: string }>> => {
  try {
    validateTokenLimits(content);

    logger.debug("Generating post summary", {
      contentLength: content.length,
    });

    const response = await deepseek.generate(SUMMARY_PROMPT(content));

    return { data: { summary: response.text } };
  } catch (error) {
    logger.error("Failed to generate summary:", error);
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Generates tags for a post using DeepSeek.
 * @param content - Post content to generate tags from
 * @param maxKeywords - Maximum number of tags to generate
 * @returns Comma-separated tags or error
 */
export const generatePostTags = async (
  content: string,
  maxKeywords = 5
): Promise<GenerationResult<{ tags: string }>> => {
  try {
    validateTokenLimits(content);

    if (maxKeywords <= 0 || maxKeywords > 10) {
      throw createAIProviderError("Max keywords must be between 1 and 10");
    }

    const response = await deepseek.generate(TAGS_PROMPT(content, maxKeywords));
    const tags = response.text
      .split(",")
      .map((tag: string) => tag.trim())
      .join(", ");

    return { data: { tags } };
  } catch (error) {
    logger.error("Failed to generate tags:", error);
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Estimates reading time for a post using DeepSeek.
 * @param content - Post content to analyze
 * @returns Estimated reading time in minutes or error
 */
export const estimateReadingTime = async (
  content: string
): Promise<GenerationResult<{ mins_read: number }>> => {
  try {
    validateTokenLimits(content);

    logger.debug("Estimating reading time", {
      contentLength: content.length,
    });

    const response = await deepseek.generate(READING_TIME_PROMPT(content));
    const mins = parseInt(response.text, 10);

    if (isNaN(mins)) {
      throw createAIProviderError("Failed to parse reading time");
    }

    const displayMins = Math.ceil(mins * 3);

    if (mins <= 0) {
      throw createAIProviderError("Reading time must be greater than 0");
    }

    return { data: { mins_read: displayMins } };
  } catch (error) {
    logger.error("Failed to estimate reading time:", error);
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
