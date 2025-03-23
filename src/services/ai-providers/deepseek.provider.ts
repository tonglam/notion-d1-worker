import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText } from "ai";
import { DEEPSEEK_API_CONFIG } from "../../configs/api.config";
import type { DeepSeekResult } from "../../types";
import { createAIProviderError } from "../../utils/errors.util";
import { createLogger } from "../../utils/logger.util";
import { validateTokenLimits } from "../../utils/validation.util";

const logger = createLogger("DeepSeekProvider");

/** Singleton instance of the DeepSeek client */
let deepseekClient: ReturnType<typeof createDeepSeek> | null = null;

/**
 * Gets or creates a DeepSeek client using environment variables
 * @returns DeepSeek client instance
 * @throws Error If DEEPSEEK_API_KEY is not set
 */
const getDeepSeekClient = () => {
  if (deepseekClient) {
    return deepseekClient;
  }

  if (!DEEPSEEK_API_KEY) {
    throw createAIProviderError(
      "DEEPSEEK_API_KEY environment variable is required",
      "DeepSeek"
    );
  }

  deepseekClient = createDeepSeek({
    apiKey: DEEPSEEK_API_KEY,
  });

  return deepseekClient;
};

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
    validateTokenLimits(prompt);

    const deepseek = getDeepSeekClient();
    const { text, reasoning } = await generateText({
      model: deepseek(DEEPSEEK_API_CONFIG.MODELS.CHAT),
      prompt,
      maxTokens: DEEPSEEK_API_CONFIG.LIMITS.MAX_OUTPUT_TOKENS,
    });

    logger.info("Text generated successfully", {
      textLength: text.length,
      hasReasoning: !!reasoning,
    });

    return { text, reasoning };
  } catch (error) {
    logger.error("Failed to generate text with DeepSeek", { error });
    throw createAIProviderError("Failed to generate text", "DeepSeek", error);
  }
}
