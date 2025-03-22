import { beforeAll, describe, expect, it } from "bun:test";
import {
  fetchPublishedPosts,
  transformToD1Posts,
} from "../src/services/notion.service";
import type { D1Post, NotionPage } from "../src/types/types";

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

      // Verify required properties
      expect(page.properties.Title.title).toBeInstanceOf(Array);
      expect(page.properties.Category.select).toBeDefined();
      expect(page.properties.Tags.multi_select).toBeInstanceOf(Array);
      expect(page.properties.Author.people).toBeInstanceOf(Array);
      expect(page.properties.Excerpt.rich_text).toBeInstanceOf(Array);
      expect(page.properties.Summary.rich_text).toBeInstanceOf(Array);
      expect(typeof page.properties["Mins Read"].number).toBe("number");
      expect(page.properties["Image URL"].url).toBeDefined();
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
      expect(post.created_at).toBeDefined();
      expect(post.updated_at).toBeDefined();
      expect(post.notion_last_edited_at).toBeDefined();
      expect(post.category).toBeDefined();
      expect(post.author).toBeDefined();
      expect(post.notion_url).toBeDefined();

      // Verify timestamps are valid ISO strings
      expect(() => new Date(post.created_at).toISOString()).not.toThrow();
      expect(() => new Date(post.updated_at).toISOString()).not.toThrow();
      expect(() =>
        new Date(post.notion_last_edited_at).toISOString()
      ).not.toThrow();

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
      expect(typeof post.tags === "string" || post.tags === null).toBe(true);
      expect(
        typeof post.r2_image_url === "string" || post.r2_image_url === null
      ).toBe(true);
    }
  });
});
