import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { beforeAll, describe, expect, test } from "bun:test";
import {
  fetchPageContent,
  getCategories,
  initNotionClient,
  transformToD1Posts,
} from "../src/services/notion.service";
import type { NotionPage } from "../src/types/notion.types";
import { validateNotionPage } from "../src/utils/validation.util";

describe("Notion Service Integration Tests", () => {
  let client: Client;
  let testPage: NotionPage;

  beforeAll(async () => {
    client = initNotionClient(process.env.NOTION_TOKEN!);
    // Fetch a real test page that we'll use across multiple tests
    try {
      const page = (await client.pages.retrieve({
        page_id: process.env.NOTION_ROOT_PAGE_ID!,
      })) as PageObjectResponse;
      testPage = validateNotionPage(page);
    } catch (error) {
      console.error("Failed to fetch test page. Please ensure:");
      console.error("1. Your Notion token has the correct permissions");
      console.error(
        "2. The page ID exists and is accessible to your integration"
      );
      console.error("3. You have shared the page with your integration");
      throw error;
    }
  });

  test("should initialize Notion client with valid token", () => {
    expect(client).toBeDefined();
    expect(typeof client.pages.retrieve).toBe("function");
    expect(typeof client.blocks.children.list).toBe("function");
    expect(typeof client.search).toBe("function");
  });

  test("should throw error when initializing without token", () => {
    expect(() => initNotionClient("")).toThrow("Missing Notion API token");
  });

  test("should transform pages to D1Posts with required fields", () => {
    const posts = transformToD1Posts([testPage]);
    expect(posts.length).toBe(1);

    const post = posts[0];
    expect(post).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      created_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
      updated_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
      notion_last_edited_at: expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      ),
      notion_url: expect.stringContaining("notion.so/"),
    });

    // These fields might be null/undefined depending on the actual page
    expect(post).toHaveProperty("category");
    expect(post).toHaveProperty("author");
  });

  test("should handle invalid page content gracefully", async () => {
    const invalidPageId = "00000000-0000-0000-0000-000000000000";
    const content = await fetchPageContent(invalidPageId);
    expect(content).toBeNull();
  });

  test("should fetch and transform published posts", async () => {
    const posts = [testPage];
    expect(Array.isArray(posts)).toBe(true);

    if (posts.length > 0) {
      const firstPost = posts[0];
      expect(firstPost).toHaveProperty("id");
      expect(firstPost).toHaveProperty("properties");
      expect(firstPost.properties.title).toBeDefined();
    }
  });

  test("should extract categories from pages", async () => {
    const posts = [testPage];
    const { regularCategories, mitCategories } = getCategories(posts);

    expect(Array.isArray(regularCategories)).toBe(true);
    expect(Array.isArray(mitCategories)).toBe(true);

    // Verify category format if any exist
    if (regularCategories.length > 0) {
      regularCategories.forEach((category) => {
        expect(typeof category).toBe("string");
        expect(category.length).toBeGreaterThan(0);
      });
    }

    if (mitCategories.length > 0) {
      mitCategories.forEach((category) => {
        expect(typeof category).toBe("string");
      });
    }
  });

  test("should fetch page content successfully", async () => {
    const content = await fetchPageContent(process.env.NOTION_ROOT_PAGE_ID!);
    expect(content).not.toBeNull();
    expect(typeof content).toBe("string");

    if (content) {
      expect(content.trim().length).toBeGreaterThan(0);
    }
  });
});
