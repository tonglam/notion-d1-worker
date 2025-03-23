/// <reference types="@cloudflare/workers-types" />

import { DASHSCOPE_API_CONFIG } from "../../configs/api.config";
import {
  IMAGE_NEGATIVE_PROMPT,
  generateImagePrompt,
} from "../../configs/prompts.config";
import type {
  CreateTaskResult,
  DashScopeResponse,
  DashScopeTaskStatusResponse,
  TaskStatusResult,
} from "../../types/ai.types";
import type { D1Post } from "../../types/db.types";
import { createAIProviderError } from "../../utils/errors.util";
import { createLogger } from "../../utils/logger.util";
import { withRateLimit } from "../../utils/rate-limiter.util";

const logger = createLogger("DashScopeProvider");

const rateLimitedFetch = <T>(fn: () => Promise<T>): Promise<T> =>
  withRateLimit(fn, {
    maxRequestsPerSecond: DASHSCOPE_API_CONFIG.LIMITS.MAX_REQUESTS_PER_SECOND,
    maxRequestsPerMinute: DASHSCOPE_API_CONFIG.LIMITS.MAX_REQUESTS_PER_MINUTE,
  });

/**
 * Creates an image generation task using DashScope's API.
 * Returns the task ID for status tracking.
 * @param post - D1Post object containing post data
 * @returns Task creation result
 * @throws {DashScopeError} If API call fails
 */
export const createImageTask = async (
  post: D1Post
): Promise<CreateTaskResult> => {
  try {
    await rateLimitedFetch(() => Promise.resolve());

    const response = await fetch(
      `${DASHSCOPE_API_CONFIG.BASE_URL}${DASHSCOPE_API_CONFIG.ENDPOINTS.IMAGE_SYNTHESIS}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-DashScope-Async": "enable",
          Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        },
        body: JSON.stringify({
          model: DASHSCOPE_API_CONFIG.MODELS.IMAGE,
          input: {
            prompt: generateImagePrompt(post),
            negative_prompt: IMAGE_NEGATIVE_PROMPT,
          },
          parameters: {
            size: DASHSCOPE_API_CONFIG.DEFAULT_CONFIG.IMAGE.SIZE,
            n: DASHSCOPE_API_CONFIG.DEFAULT_CONFIG.IMAGE.COUNT,
          },
          task: "text-to-image",
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error("DashScope API error response:", {
        status: response.status,
        body: errorBody,
      });
      throw createAIProviderError(
        `Failed to create task: ${response.status} ${response.statusText}`,
        "DashScope"
      );
    }

    const data = (await response.json()) as DashScopeResponse;

    if ("code" in data) {
      throw createAIProviderError(`${data.code}: ${data.message}`, "DashScope");
    }

    if (!("output" in data) || !data.output.task_id) {
      throw createAIProviderError(
        "Unexpected task status in creation response",
        "DashScope"
      );
    }

    return { taskId: data.output.task_id };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    logger.error("Failed to create image task", { error: errorMessage });
    return { error: errorMessage };
  }
};

/**
 * Checks the status of an image generation task.
 * @param taskId - Task ID to check
 * @returns Task status and image URL if successful
 * @throws {DashScopeError} If API call fails
 */
export const checkTaskStatus = async (
  taskId: string
): Promise<TaskStatusResult> => {
  try {
    if (!taskId) {
      throw createAIProviderError("Invalid task ID", "DashScope");
    }

    await rateLimitedFetch(() => Promise.resolve());

    const response = await fetch(
      `${
        DASHSCOPE_API_CONFIG.BASE_URL
      }${DASHSCOPE_API_CONFIG.ENDPOINTS.TASK_STATUS(taskId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw createAIProviderError(
        `Failed to check task status: ${response.status} ${response.statusText}`,
        "DashScope"
      );
    }

    const data = (await response.json()) as DashScopeResponse;

    if ("code" in data) {
      throw createAIProviderError(`${data.code}: ${data.message}`, "DashScope");
    }

    if (!("output" in data)) {
      throw createAIProviderError("Invalid response format", "DashScope");
    }

    const taskStatusResponse = data as DashScopeTaskStatusResponse;
    const { task_status, results } = taskStatusResponse.output;

    switch (task_status) {
      case "SUCCEEDED":
        if (!results || !results[0]?.url) {
          return {
            status: "FAILED",
            error: "No image URL in successful response",
          };
        }
        return {
          status: "SUCCEEDED",
          imageUrl: results[0].url,
        };
      case "FAILED":
        return {
          status: "FAILED",
          error:
            taskStatusResponse.output.error ||
            "Task failed without error message",
        };
      case "PENDING":
        return { status: "PENDING" };
      default:
        return {
          status: "FAILED",
          error: `Unknown task status: ${task_status}`,
        };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      status: "FAILED",
      error: errorMessage,
    };
  }
};
