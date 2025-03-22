import { DASHSCOPE_API } from "../../configs/constants.config";
import {
  IMAGE_NEGATIVE_PROMPT,
  IMAGE_PROMPT,
} from "../../configs/prompts.config";
import type {
  CreateTaskResult,
  DashScopeResponse,
  TaskStatusResult,
} from "../../types/types";
import {
  createDashScopeError,
  createValidationError,
} from "../../utils/errors.util";
import { createLogger } from "../../utils/logger.util";
import { RateLimiter } from "../../utils/rate-limiter.util";

const logger = createLogger("DashScopeProvider");

// Rate limits for DashScope API
const RATE_LIMITS = {
  MAX_REQUESTS_PER_SECOND: 5,
  MAX_REQUESTS_PER_MINUTE: 100,
} as const;

const rateLimiter = new RateLimiter({
  maxRequestsPerSecond: RATE_LIMITS.MAX_REQUESTS_PER_SECOND,
  maxRequestsPerMinute: RATE_LIMITS.MAX_REQUESTS_PER_MINUTE,
});

/**
 * Validates task ID for status checks
 * @param taskId - Task ID to validate
 * @throws {ValidationError} If task ID is invalid
 */
const validateTaskId = (taskId: string): void => {
  if (!taskId) {
    throw createValidationError("Task ID is required");
  }

  if (!/^[a-zA-Z0-9-]+$/.test(taskId)) {
    throw createValidationError("Invalid task ID format");
  }
};

/**
 * Processes API response and extracts task ID
 * @param response - API response
 * @returns Task ID
 * @throws {DashScopeError} If response is invalid
 */
const processTaskResponse = async (response: Response): Promise<string> => {
  if (!response.ok) {
    const errorText = await response.text();
    throw createDashScopeError(
      `API request failed with status ${response.status}: ${errorText}`
    );
  }

  const data = (await response.json()) as DashScopeResponse;
  const taskId = data?.output?.task_id;

  if (!taskId) {
    throw createDashScopeError("No task ID returned from API");
  }

  return taskId;
};

/**
 * Creates an image generation task using DashScope's API.
 * Returns the task ID for status tracking.
 * @param prompt - Input prompt for image generation
 * @param size - Optional image size (default from config)
 * @returns Task creation result
 * @throws {DashScopeError} If API call fails
 */
export const createImageTask = async (
  prompt: string,
  apiKey: string,
  size = DASHSCOPE_API.DEFAULT_CONFIG.IMAGE.SIZE
): Promise<CreateTaskResult> => {
  try {
    const enhancedPrompt = IMAGE_PROMPT(prompt.replace(/['"]/g, "").trim());

    logger.debug("Creating image task", {
      size,
      promptLength: enhancedPrompt.length,
    });

    const response = await rateLimiter.wrap(() =>
      fetch(
        `${DASHSCOPE_API.BASE_URL}${DASHSCOPE_API.ENDPOINTS.IMAGE_SYNTHESIS}`,
        {
          method: "POST",
          headers: {
            [DASHSCOPE_API.HEADERS.ASYNC]: "enable",
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": DASHSCOPE_API.HEADERS.CONTENT_TYPE,
          },
          body: JSON.stringify({
            model: DASHSCOPE_API.MODELS.IMAGE,
            input: {
              prompt: enhancedPrompt,
              negative_prompt: IMAGE_NEGATIVE_PROMPT,
            },
            parameters: {
              size,
              n: DASHSCOPE_API.DEFAULT_CONFIG.IMAGE.COUNT,
            },
          }),
        }
      )
    );

    const taskId = await processTaskResponse(response);
    logger.debug("Image task created", { taskId });

    return { taskId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to create image task", { error: errorMessage });
    return { error: errorMessage };
  }
};

/**
 * Checks the status of an image generation task.
 * Returns the task status and image URL if ready.
 * @param taskId - Task ID to check
 * @param apiKey - DashScope API key
 * @returns Task status result
 * @throws {DashScopeError} If API call fails
 */
export const getTaskStatus = async (
  taskId: string,
  apiKey: string
): Promise<TaskStatusResult> => {
  try {
    validateTaskId(taskId);
    logger.debug("Checking task status", { taskId });

    const response = await rateLimiter.wrap(() =>
      fetch(
        `${DASHSCOPE_API.BASE_URL}${DASHSCOPE_API.ENDPOINTS.TASK_STATUS(
          taskId
        )}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      )
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw createDashScopeError(
        `API request failed with status ${response.status}: ${errorText}`
      );
    }

    const data = (await response.json()) as DashScopeResponse;

    if (data?.output?.results?.[0]?.url) {
      const imageUrl = data.output.results[0].url;
      logger.debug("Task completed successfully", { taskId, imageUrl });
      return {
        status: "SUCCEEDED",
        imageUrl,
      };
    }

    if (data?.output?.task_status === "FAILED") {
      const errorMessage = data.output.error || "Task failed";
      logger.warn("Task failed", { taskId, error: errorMessage });
      return {
        status: "FAILED",
        error: errorMessage,
      };
    }

    logger.debug("Task still pending", { taskId });
    return {
      status: "PENDING",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to check task status", {
      taskId,
      error: errorMessage,
    });
    return {
      status: "FAILED",
      error: errorMessage,
    };
  }
};
