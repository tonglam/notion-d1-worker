import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  getPosts,
  getPostsByIds,
  insertPosts,
  updatePosts,
  upsertPosts,
} from "../src/services/db.service";
import type { D1Post } from "../src/types/db.types";
import { setupTestDatabase } from "./fixtures/db.fixture";

describe("D1 Database Integration Tests", () => {
  // Test data with test_ prefix for clear identification
  const testPosts: D1Post[] = [
    {
      id: "test_post_1",
      title: "Test Post 1",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notion_last_edited_at: new Date().toISOString(),
      category: "test_category",
      author: "test_author",
      notion_url: "https://notion.so/test_post_1",
      excerpt: "Test excerpt 1",
      summary: "Test summary 1",
      mins_read: 5,
      image_url: "https://example.com/test1.jpg",
      tags: "test,integration",
      r2_image_url: null,
      image_task_id: null,
    },
    {
      id: "test_post_2",
      title: "Test Post 2",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notion_last_edited_at: new Date().toISOString(),
      category: "test_category",
      author: "test_author",
      notion_url: "https://notion.so/test_post_2",
      excerpt: "Test excerpt 2",
      summary: "Test summary 2",
      mins_read: 3,
      image_url: "https://example.com/test2.jpg",
      tags: "test,d1",
      r2_image_url: null,
      image_task_id: null,
    },
  ];

  let cleanup: () => void;

  beforeAll(async () => {
    try {
      cleanup = await setupTestDatabase();
    } catch (error) {
      console.error("Failed to initialize test database:", error);
      throw error;
    }
  });

  afterAll(() => {
    cleanup();
  });

  test("should insert posts successfully", async () => {
    await insertPosts(testPosts);
    const posts = await getPosts();
    const testPostsInDb = posts.filter((p) => p.id.startsWith("test_"));
    expect(testPostsInDb).toHaveLength(2);
  });

  test("should get posts by IDs", async () => {
    const posts = await getPostsByIds([testPosts[0].id]);
    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe(testPosts[0].id);
    expect(posts[0].title).toBe(testPosts[0].title);
  });

  test("should update posts", async () => {
    const updates = [
      {
        id: testPosts[0].id,
        data: {
          title: "Updated Test Post 1",
          summary: "Updated summary",
          mins_read: 6,
        },
      },
    ];

    await updatePosts(updates);
    const updatedPosts = await getPostsByIds([testPosts[0].id]);
    expect(updatedPosts[0].title).toBe("Updated Test Post 1");
    expect(updatedPosts[0].summary).toBe("Updated summary");
    expect(updatedPosts[0].mins_read).toBe(6);
  });

  test("should upsert posts - update existing and insert new", async () => {
    const existingIds = new Set([testPosts[0].id]);
    const newPost: D1Post = {
      id: "test_post_3",
      title: "Test Post 3",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notion_last_edited_at: new Date().toISOString(),
      category: "test_category",
      author: "test_author",
      notion_url: "https://notion.so/test_post_3",
      excerpt: "Test excerpt 3",
      summary: "Test summary 3",
      mins_read: 4,
      image_url: "https://example.com/test3.jpg",
      tags: "test,upsert",
      r2_image_url: null,
      image_task_id: null,
    };

    const postsToUpsert = [
      {
        ...testPosts[0],
        title: "Upserted Test Post 1",
      },
      newPost,
    ];

    await upsertPosts(postsToUpsert, existingIds);

    const upsertedPosts = await getPostsByIds([testPosts[0].id, newPost.id]);
    expect(upsertedPosts).toHaveLength(2);
    expect(upsertedPosts.find((p) => p.id === testPosts[0].id)?.title).toBe(
      "Upserted Test Post 1"
    );
    expect(upsertedPosts.find((p) => p.id === newPost.id)?.title).toBe(
      "Test Post 3"
    );
  });
});
