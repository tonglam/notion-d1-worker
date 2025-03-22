import type { D1Database } from "@cloudflare/workers-types";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { clearPosts, getPosts } from "../src/services/d1.service";
import { fetchPublishedPosts } from "../src/services/notion.service";
import { syncPosts } from "../src/services/sync.service";
import type { D1Post, NotionPage } from "../src/types/types";

describe("Workflow Integration", () => {
  let notionToken: string;
  let notionDatabaseId: string;
  let db: D1Database;

  beforeAll(() => {
    notionToken = process.env.NOTION_TOKEN ?? "";
    notionDatabaseId = process.env.NOTION_DATABASE_ID ?? "";
    db = process.env.D1_DB as unknown as D1Database;

    if (!notionToken || !notionDatabaseId || !db) {
      throw new Error("Missing required environment variables");
    }
  });

  it("should sync posts from Notion to D1", async () => {
    // First get current count in Notion
    const notionPages = await fetchPublishedPosts(
      notionToken,
      notionDatabaseId
    );
    const notionCount = notionPages.length;

    // Run the sync
    await syncPosts(notionToken, notionDatabaseId, db);

    // Verify D1 has same number of posts
    const d1Posts = await getPosts(db);
    expect(d1Posts.length).toBe(notionCount);

    // Verify content matches for first post if any exists
    if (notionCount > 0) {
      const notionPage = notionPages[0] as NotionPage;
      const d1Post = d1Posts.find((p: D1Post) => p.id === notionPage.id);

      expect(d1Post).toBeDefined();
      if (d1Post) {
        // Verify required fields
        expect(d1Post.title).toBe(
          notionPage.properties.Title.title[0]?.plain_text ?? ""
        );
        expect(d1Post.category).toBe(
          notionPage.properties.Category.select?.name ?? ""
        );
        expect(d1Post.author).toBe(
          notionPage.properties.Author.people[0]?.name ?? ""
        );
        expect(d1Post.notion_url).toBe(notionPage.url);

        // Verify optional fields
        expect(d1Post.excerpt).toBe(
          notionPage.properties.Excerpt.rich_text[0]?.plain_text ?? null
        );
        expect(d1Post.summary).toBe(
          notionPage.properties.Summary.rich_text[0]?.plain_text ?? null
        );
        expect(d1Post.mins_read).toBe(
          notionPage.properties["Mins Read"].number ?? null
        );
        expect(d1Post.image_url).toBe(
          notionPage.properties["Image URL"].url ?? null
        );
        expect(d1Post.tags).toBe(
          notionPage.properties.Tags.multi_select
            .map((t) => t.name)
            .join(", ") || null
        );
        expect(d1Post.r2_image_url).toBeNull(); // Should be null initially
      }
    }
  });

  it("should handle incremental updates", async () => {
    // First sync
    await syncPosts(notionToken, notionDatabaseId, db);
    const initialPosts = await getPosts(db);

    // Run sync again
    await syncPosts(notionToken, notionDatabaseId, db);
    const updatedPosts = await getPosts(db);

    // Verify no duplicate posts
    const uniqueIds = new Set(updatedPosts.map((p: D1Post) => p.id));
    expect(uniqueIds.size).toBe(updatedPosts.length);

    // Verify post count matches Notion
    const notionPages = await fetchPublishedPosts(
      notionToken,
      notionDatabaseId
    );
    expect(updatedPosts.length).toBe(notionPages.length);
  });

  // Clean up after all tests
  afterAll(async () => {
    await clearPosts(db);
  });
});
