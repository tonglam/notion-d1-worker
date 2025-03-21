import { beforeAll, describe, expect, it } from "bun:test";
import {
  fetchPublishedPosts,
  transformToD1Posts,
} from "../src/services/notion";
import type { D1Post, NotionPage } from "../src/types";

describe("Notion Integration", () => {
  let notionToken: string;
  let notionDatabaseId: string;

  beforeAll(() => {
    notionToken = process.env.NOTION_TOKEN ?? "";
    notionDatabaseId = process.env.NOTION_DATABASE_ID ?? "";

    if (!notionToken || !notionDatabaseId) {
      throw new Error("Missing required Notion credentials in environment");
    }
  });

  it("should fetch pages from Notion database", async () => {
    const pages = await fetchPublishedPosts(notionToken, notionDatabaseId);
    expect(Array.isArray(pages)).toBe(true);

    // Verify page structure if any pages exist
    if (pages.length > 0) {
      const page = pages[0] as NotionPage;
      expect(page.id).toBeDefined();
      expect(page.properties).toBeDefined();
      expect(page.properties.Title).toBeDefined();
      expect(page.properties.Slug).toBeDefined();

      // Verify required properties
      expect(page.properties.Title.title).toBeInstanceOf(Array);
      expect(page.properties.Slug.rich_text).toBeInstanceOf(Array);
      expect(typeof page.properties.Published.checkbox).toBe("boolean");
      expect(page.properties.Category.select).toBeDefined();
      expect(page.properties.Tags.multi_select).toBeInstanceOf(Array);
      expect(page.properties.Author.people).toBeInstanceOf(Array);
      expect(page.properties["Content Key"].rich_text).toBeInstanceOf(Array);
    }
  });

  it("should transform Notion pages to D1 format correctly", async () => {
    const pages = await fetchPublishedPosts(notionToken, notionDatabaseId);
    const d1Posts = transformToD1Posts(pages);

    // Verify transformation if any pages exist
    if (d1Posts.length > 0) {
      const post = d1Posts[0] as D1Post;

      // Required fields
      expect(post.id).toBeDefined();
      expect(post.title).toBeDefined();
      expect(post.slug).toBeDefined();
      expect(post.created_at).toBeDefined();
      expect(post.updated_at).toBeDefined();
      expect(typeof post.published).toBe("boolean");
      expect(post.category).toBeDefined();
      expect(post.tags).toBeDefined();
      expect(post.author).toBeDefined();
      expect(post.content_key).toBeDefined();

      // Verify JSON fields are properly stringified
      expect(() => JSON.parse(post.category)).not.toThrow();
      expect(() => JSON.parse(post.tags)).not.toThrow();
      expect(() => JSON.parse(post.author)).not.toThrow();

      // Optional fields should be either string/number or null
      expect(typeof post.excerpt === "string" || post.excerpt === null).toBe(
        true
      );
      expect(typeof post.summary === "string" || post.summary === null).toBe(
        true
      );
      expect(
        typeof post.mins_read === "number" || post.mins_read === null
      ).toBe(true);
      expect(
        typeof post.image_url === "string" || post.image_url === null
      ).toBe(true);
    }
  });
});
