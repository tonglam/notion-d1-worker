import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  checkImageStatus,
  estimateReadingTime,
  generateImage,
  generatePostSummary,
  generatePostTags,
} from "../src/services/ai.service";
import { initializeDb } from "../src/services/db.service";
import type { D1Post } from "../src/types/db.types";
import { createTestPost, setupTestDatabase } from "./fixtures/db.fixture";
import "./setup";

describe("AI Service Integration Tests", () => {
  let db: D1Database;
  let cleanup: () => void;

  beforeAll(async () => {
    const result = await setupTestDatabase();
    cleanup = result.cleanup;
    db = result.db;
    // Initialize the database instance
    initializeDb(db);
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
        category: "AI Testing",
        author: "Test Runner",
      });

      const result = await generateImage(testPost);
      console.log("Image generation result:", JSON.stringify(result, null, 2));
      expect(result.error).toBeUndefined();
      expect(result.data?.task_id).toBeDefined();
    },
    TEST_TIMEOUT
  );

  test.skip(
    "should check image generation status",
    async () => {
      if (!testPost.image_task_id) {
        console.log("Skipping image status test - no task ID available");
        return;
      }

      const result = await checkImageStatus(testPost);
      expect(result.error).toBeUndefined();
      expect(result.data?.task_id).toBe(testPost.image_task_id);
      expect(result.data?.image_url || result.data?.r2_image_url).toBeDefined();
    },
    TEST_TIMEOUT
  );

  test.skip(
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
