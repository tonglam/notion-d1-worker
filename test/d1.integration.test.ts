import type { D1Database } from "@cloudflare/workers-types";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
  clearPosts,
  getPostCount,
  getPosts,
  getPostsByAuthor,
  getPostsByCategory,
  insertPosts,
  updatePost,
} from "../src/services/d1.service";
import type {
  D1Post,
  D1PostExtended,
  D1PostMetadata,
} from "../src/types/types";

describe("D1 Integration", () => {
  let db: D1Database;
  let testPost: D1Post;

  beforeAll(() => {
    db = process.env.D1_DB as unknown as D1Database;

    if (!db) {
      throw new Error("Missing required D1 database in environment");
    }

    // Initialize test post
    const metadata: D1PostMetadata = {
      id: `test-${Date.now()}`,
      title: "Test Post",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notion_last_edited_at: new Date().toISOString(),
      category: "Technology",
      author: "Test User",
      notion_url: "https://notion.so/test",
      excerpt: "Test excerpt",
    };

    const extended: D1PostExtended = {
      summary: "Test summary",
      mins_read: 5,
      image_url: "https://example.com/test.jpg",
      tags: "test, technology",
      r2_image_url: null,
    };

    testPost = { ...metadata, ...extended };
  });

  it("should clear and insert posts", async () => {
    // Clear the database first
    await clearPosts(db);

    // Insert a test post
    await insertPosts(db, [testPost]);

    // Verify the post was inserted
    const posts = await getPosts(db);
    expect(posts).toHaveLength(1);

    const insertedPost = posts[0];
    expect(insertedPost).toBeDefined();

    // Test metadata fields (required)
    expect(insertedPost.id).toBe(testPost.id);
    expect(insertedPost.title).toBe(testPost.title);
    expect(insertedPost.created_at).toBe(testPost.created_at);
    expect(insertedPost.updated_at).toBe(testPost.updated_at);
    expect(insertedPost.notion_last_edited_at).toBe(
      testPost.notion_last_edited_at
    );
    expect(insertedPost.category).toBe(testPost.category);
    expect(insertedPost.author).toBe(testPost.author);
    expect(insertedPost.notion_url).toBe(testPost.notion_url);

    // Test extended fields
    expect(insertedPost.excerpt).toBe(testPost.excerpt);
    expect(insertedPost.summary).toBe(testPost.summary);
    expect(insertedPost.mins_read).toBe(testPost.mins_read);
    expect(insertedPost.image_url).toBe(testPost.image_url);
    expect(insertedPost.tags).toBe(testPost.tags);
    expect(insertedPost.r2_image_url).toBe(testPost.r2_image_url);
  });

  it("should handle batch inserts correctly", async () => {
    // Create 150 test posts
    const testPosts: D1Post[] = Array(150)
      .fill(null)
      .map((_, i) => ({
        ...testPost,
        id: `test-${Date.now()}-${i}`,
        title: `Test Post ${i}`,
      }));

    // Clear and insert batch
    await clearPosts(db);
    await insertPosts(db, testPosts);

    // Verify all posts were inserted
    const posts = await getPosts(db);
    expect(posts).toHaveLength(150);

    // Verify no duplicate IDs
    const uniqueIds = new Set(posts.map((p) => p.id));
    expect(uniqueIds.size).toBe(150);
  });

  it("should get correct post count", async () => {
    await clearPosts(db);
    await insertPosts(db, [testPost]);

    const count = await getPostCount(db);
    expect(count).toBe(1);
  });

  it("should get posts by category", async () => {
    await clearPosts(db);
    await insertPosts(db, [testPost]);

    const posts = await getPostsByCategory(db, "Technology");
    expect(posts).toHaveLength(1);
    expect(posts[0].category).toBe("Technology");
  });

  it("should get posts by author", async () => {
    await clearPosts(db);
    await insertPosts(db, [testPost]);

    const posts = await getPostsByAuthor(db, "Test User");
    expect(posts).toHaveLength(1);
    expect(posts[0].author).toBe("Test User");
  });

  it("should handle optional fields correctly", async () => {
    const metadata: D1PostMetadata = {
      id: `test-optional-${Date.now()}`,
      title: "Test Post",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notion_last_edited_at: new Date().toISOString(),
      category: "Technology",
      author: "Test User",
      notion_url: "https://notion.so/test",
      excerpt: null,
    };

    const extended: D1PostExtended = {
      summary: null,
      mins_read: null,
      image_url: null,
      tags: null,
      r2_image_url: null,
    };

    const postWithOptionalFields: D1Post = { ...metadata, ...extended };

    await clearPosts(db);
    await insertPosts(db, [postWithOptionalFields]);

    const posts = await getPosts(db);
    expect(posts).toHaveLength(1);
    const insertedPost = posts[0];
    expect(insertedPost).toBeDefined();

    // Test metadata fields (required)
    expect(insertedPost.id).toBe(postWithOptionalFields.id);
    expect(insertedPost.title).toBe(postWithOptionalFields.title);
    expect(insertedPost.created_at).toBe(postWithOptionalFields.created_at);
    expect(insertedPost.updated_at).toBe(postWithOptionalFields.updated_at);
    expect(insertedPost.notion_last_edited_at).toBe(
      postWithOptionalFields.notion_last_edited_at
    );
    expect(insertedPost.category).toBe(postWithOptionalFields.category);
    expect(insertedPost.author).toBe(postWithOptionalFields.author);
    expect(insertedPost.notion_url).toBe(postWithOptionalFields.notion_url);

    // Test extended fields (all null)
    expect(insertedPost.excerpt).toBeNull();
    expect(insertedPost.summary).toBeNull();
    expect(insertedPost.mins_read).toBeNull();
    expect(insertedPost.image_url).toBeNull();
    expect(insertedPost.tags).toBeNull();
    expect(insertedPost.r2_image_url).toBeNull();
  });

  it("should update post extended fields", async () => {
    // Clear and insert initial post
    await clearPosts(db);
    await insertPosts(db, [testPost]);

    // Update extended fields
    const updates: Required<D1PostExtended> = {
      summary: "Updated summary",
      mins_read: 10,
      image_url: "https://example.com/updated.jpg",
      tags: "updated, test",
      r2_image_url: "https://r2.example.com/updated.jpg",
    };

    await updatePost(db, testPost.id, updates);

    // Verify the updates
    const posts = await getPosts(db);
    expect(posts).toHaveLength(1);
    const updatedPost = posts[0];

    // Metadata fields should remain unchanged
    expect(updatedPost.id).toBe(testPost.id);
    expect(updatedPost.title).toBe(testPost.title);
    expect(updatedPost.category).toBe(testPost.category);
    expect(updatedPost.author).toBe(testPost.author);
    expect(updatedPost.notion_url).toBe(testPost.notion_url);
    expect(updatedPost.excerpt).toBe(testPost.excerpt);

    // Extended fields should be updated
    expect(updatedPost.summary).toBe(updates.summary);
    expect(updatedPost.mins_read).toBe(updates.mins_read);
    expect(updatedPost.image_url).toBe(updates.image_url);
    expect(updatedPost.tags).toBe(updates.tags);
    expect(updatedPost.r2_image_url).toBe(updates.r2_image_url);

    // updated_at should be newer than the original
    expect(new Date(updatedPost.updated_at).getTime()).toBeGreaterThan(
      new Date(testPost.updated_at).getTime()
    );
  });

  it("should handle partial updates", async () => {
    // Clear and insert initial post
    await clearPosts(db);
    await insertPosts(db, [testPost]);

    // Update only some fields
    const updates: Partial<D1PostExtended> = {
      r2_image_url: "https://r2.example.com/updated.jpg",
    };

    await updatePost(db, testPost.id, updates);

    // Verify the updates
    const posts = await getPosts(db);
    expect(posts).toHaveLength(1);
    const updatedPost = posts[0];

    // Only specified fields should be updated
    expect(updatedPost.r2_image_url).toBe(updates.r2_image_url ?? null);

    // Other fields should remain unchanged
    expect(updatedPost.summary).toBe(testPost.summary);
    expect(updatedPost.mins_read).toBe(testPost.mins_read);
    expect(updatedPost.image_url).toBe(testPost.image_url);
    expect(updatedPost.tags).toBe(testPost.tags);
    expect(updatedPost.excerpt).toBe(testPost.excerpt);
  });

  // Clean up after all tests
  afterAll(async () => {
    await clearPosts(db);
  });
});
