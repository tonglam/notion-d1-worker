import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  checkImageStatus,
  estimateReadingTime,
  generateImage,
  generatePostSummary,
  generatePostTags,
} from "../src/services/ai.service";
import type { D1Post } from "../src/types/db.types";
import { createTestPost, setupTestDatabase } from "./fixtures/db.fixture";

// Test data
const TEST_DASHSCOPE_KEY = process.env.DASHSCOPE_API_KEY;
const TEST_DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

if (!TEST_DASHSCOPE_KEY || !TEST_DEEPSEEK_KEY) {
  throw new Error(
    "DASHSCOPE_API_KEY and DEEPSEEK_API_KEY environment variables are required for testing"
  );
}

// Set up global variables required by the service
declare global {
  var DASHSCOPE_API_KEY: string;
  var DEEPSEEK_API_KEY: string;
  var TEST_DB: D1Database;
}
globalThis.DASHSCOPE_API_KEY = TEST_DASHSCOPE_KEY;
globalThis.DEEPSEEK_API_KEY = TEST_DEEPSEEK_KEY;

describe("AI Service Integration Tests", () => {
  let cleanup: () => void;

  beforeAll(async () => {
    cleanup = await setupTestDatabase();
  });

  afterAll(() => {
    cleanup();
  });

  // Increase test timeout for AI operations
  const TEST_TIMEOUT = 30000; // 30 seconds

  const testContent = `
    # Test Article
    This is a test article content that we'll use for AI service testing.
    It contains multiple paragraphs and some technical terms.
    
    ## Section 1
    We're testing AI capabilities including summarization, tag generation,
    and reading time estimation.
    
    ## Section 2
    The content should be substantial enough to generate meaningful results
    while being mindful of API rate limits.
  `;

  let testPost: D1Post;

  test(
    "should generate image for post",
    async () => {
      testPost = createTestPost({
        title: "Test Image Generation",
        content: testContent,
      });

      const result = await generateImage(testPost);
      expect(result.error).toBeUndefined();
      expect(result.data?.task_id).toBeDefined();
    },
    TEST_TIMEOUT
  );

  test(
    "should check image generation status",
    async () => {
      if (!testPost.image_task_id) {
        console.log("Skipping image status test - no task ID available");
        return;
      }

      const result = await checkImageStatus(testPost);
      expect(result.error).toBeUndefined();
      expect(result.data?.task_id).toBe(testPost.image_task_id);
      // Status could be pending or succeeded, both are valid
      expect(result.data?.image_url || result.data?.r2_image_url).toBeDefined();
    },
    TEST_TIMEOUT
  );

  test(
    "should generate post summary",
    async () => {
      const result = await generatePostSummary(testContent);
      expect(result.error).toBeUndefined();
      expect(result.data?.summary.length).toBeGreaterThan(0);
    },
    TEST_TIMEOUT
  );

  test(
    "should generate post tags",
    async () => {
      const result = await generatePostTags(testContent, 3);
      expect(result.error).toBeUndefined();
      expect(result.data?.tags.split(",").length).toBe(3);
    },
    TEST_TIMEOUT
  );

  test("should handle invalid input for tags generation", async () => {
    const result = await generatePostTags(testContent, 0);
    expect(result.error).toBeDefined();
  });

  test(
    "should estimate reading time",
    async () => {
      const result = await estimateReadingTime(testContent);
      expect(result.error).toBeUndefined();
      expect(result.data?.mins_read).toBeGreaterThan(0);
    },
    TEST_TIMEOUT
  );

  test(
    "should handle empty content for reading time",
    async () => {
      const result = await estimateReadingTime("");
      expect(result.error).toBeDefined();
    },
    TEST_TIMEOUT
  );
});
