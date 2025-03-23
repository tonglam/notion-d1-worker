import {
  READING_TIME_PROMPT,
  SUMMARY_PROMPT,
  TAGS_PROMPT,
} from "../configs/prompts.config";
import type { GenerationResult, ImageResult } from "../types";
import type { D1Post } from "../types/db.types";
import { createAIProviderError } from "../utils/errors.util";
import { createLogger } from "../utils/logger.util";
import * as dashscope from "./ai-providers/dashscope.provider";
import * as deepseek from "./ai-providers/deepseek.provider";
import { updatePost } from "./db.service";
import { uploadImageFromUrl } from "./r2.service";

const logger = createLogger("AIService");

/**
 * Generates a featured image using DashScope.
 * Handles task creation and database updates.
 * @param post - Post to generate image for
 * @returns Generation result with task ID or error
 */
export const generateImage = async (
  post: D1Post
): Promise<GenerationResult<ImageResult>> => {
  try {
    const result = await dashscope.createImageTask(post);

    if (result.error || !result.taskId) {
      logger.warn("Failed to create image task", {
        postId: post.id,
        error: result.error,
      });
      return { error: result.error || "Failed to create task" };
    }

    // Store task ID in D1
    await updatePost(post.id, {
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
 * If complete, uploads the image to R2 and updates the post.
 * @param post - Post to check image status for
 * @returns Task status result or error
 */
export const checkImageStatus = async (
  post: D1Post
): Promise<GenerationResult<ImageResult>> => {
  try {
    if (!post.image_task_id) {
      return { error: "No image task ID found" };
    }

    const result = await dashscope.checkTaskStatus(post.image_task_id);

    if (result.error) {
      logger.warn("Failed to check image status", {
        postId: post.id,
        taskId: post.image_task_id,
        error: result.error,
      });
      return { error: result.error };
    }

    // If image is ready, upload to R2 and update post
    if (result.status === "SUCCEEDED" && result.imageUrl) {
      const r2Result = await uploadImageFromUrl(result.imageUrl, post.id);
      await updatePost(post.id, {
        r2_image_url: r2Result.url,
      });
    }

    return {
      data: {
        task_id: post.image_task_id,
        image_url: result.imageUrl,
        r2_image_url:
          result.status === "SUCCEEDED" ? result.imageUrl : undefined,
      },
    };
  } catch (error) {
    logger.error("Failed to check image status:", error);
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const generatePostSummary = async (
  content: string
): Promise<GenerationResult<{ summary: string }>> => {
  try {
    const response = await deepseek.generate(SUMMARY_PROMPT(content));
    return { data: { summary: response.text } };
  } catch (error) {
    logger.error("Failed to generate summary:", error);
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const generatePostTags = async (
  content: string,
  maxKeywords = 3
): Promise<GenerationResult<{ tags: string }>> => {
  try {
    if (maxKeywords <= 0 || maxKeywords > 5) {
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

export const estimateReadingTime = async (
  content: string
): Promise<GenerationResult<{ mins_read: number }>> => {
  try {
    if (!content.trim()) {
      throw createAIProviderError("Content cannot be empty");
    }

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
