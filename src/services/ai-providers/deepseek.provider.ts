import { deepseek } from "@ai-sdk/deepseek";
import { generateText } from "ai";
import { DEEPSEEK_API } from "../../configs/constants.config";
import type { DeepSeekResult } from "../../types/types";
import { createAIProviderError } from "../../utils/errors.util";
import { createLogger } from "../../utils/logger.util";
import { validateTokenLimits } from "../../utils/validation.util";

const logger = createLogger("DeepSeekProvider");

/**
 * Calls DeepSeek API to generate text based on the provided prompt.
 * Uses deepseek-reasoner model with appropriate token limits.
 * @param prompt - Input prompt for text generation
 * @returns Generated text and reasoning
 * @throws {DeepSeekError} If API call fails
 * @throws {ValidationError} If prompt exceeds token limits
 */
export async function generate(prompt: string): Promise<DeepSeekResult> {
  try {
    logger.info("Generating text with DeepSeek", {
      promptLength: prompt.length,
    });
    validateTokenLimits(prompt);

    const { text, reasoning } = await generateText({
      model: deepseek("deepseek-reasoner"),
      prompt,
      maxTokens: DEEPSEEK_API.LIMITS.MAX_OUTPUT_TOKENS,
    });

    logger.info("Text generated successfully", {
      textLength: text.length,
      hasReasoning: !!reasoning,
    });

    return { text, reasoning };
  } catch (error) {
    logger.error("Failed to generate text with DeepSeek", { error });
    throw createAIProviderError("Failed to generate text with DeepSeek", error);
  }
}
