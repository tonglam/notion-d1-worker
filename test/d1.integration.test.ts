import type { D1Database } from "@cloudflare/workers-types";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { clearPosts, getPosts, insertPosts } from "../src/services/d1";
import type { D1Post } from "../src/types";

describe("D1 Integration", () => {
  let db: D1Database;
  let testPost: D1Post;

  beforeAll(() => {
    db = process.env.D1_DB as unknown as D1Database;

    if (!db) {
      throw new Error("Missing required D1 database in environment");
    }

    // Initialize test post
    testPost = {
      id: `test-${Date.now()}`,
      title: "Test Post",
      slug: "test-post",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      published: true,
      category: JSON.stringify({ name: "Test" }),
      tags: JSON.stringify([{ name: "test" }]),
      author: JSON.stringify([{ id: "test-user", name: "Test User" }]),
      excerpt: "Test excerpt",
      summary: "Test summary",
      mins_read: 5,
      image_url: "https://example.com/test.jpg",
      notion_url: "https://notion.so/test",
      content_key: "test-key",
    };
  });

  it("should clear and insert posts", async () => {
    // Clear the database first
    await clearPosts(db);

    // Insert a test post
    await insertPosts(db, [testPost]);

    // Verify the post was inserted
    const posts = await getPosts(db);
    expect(posts).toHaveLength(1);

    const insertedPost = posts[0] as D1Post;
    expect(insertedPost.id).toBe(testPost.id);
    expect(insertedPost.title).toBe(testPost.title);
    expect(insertedPost.slug).toBe(testPost.slug);

    // Verify JSON fields
    expect(() => JSON.parse(insertedPost.category)).not.toThrow();
    expect(() => JSON.parse(insertedPost.tags)).not.toThrow();
    expect(() => JSON.parse(insertedPost.author)).not.toThrow();
  });

  it("should handle batch inserts correctly", async () => {
    // Create 150 test posts
    const testPosts: D1Post[] = Array(150)
      .fill(null)
      .map((_, i) => ({
        ...testPost,
        id: `test-${Date.now()}-${i}`,
        title: `Test Post ${i}`,
        slug: `test-post-${i}`,
      }));

    // Clear and insert batch
    await clearPosts(db);
    await insertPosts(db, testPosts);

    // Verify all posts were inserted
    const posts = await getPosts(db);
    expect(posts).toHaveLength(150);

    // Verify no duplicate IDs
    const uniqueIds = new Set(posts.map((p: D1Post) => p.id));
    expect(uniqueIds.size).toBe(150);
  });

  // Clean up after all tests
  afterAll(async () => {
    await clearPosts(db);
  });
});
