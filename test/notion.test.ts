import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { beforeAll, describe, expect, test } from "bun:test";
import {
  fetchPageContent,
  initNotionClient,
  transformToD1Posts,
} from "../src/services/notion.service";
import type { D1PostMetadata } from "../src/types/db.types";

// Test data
const TEST_TOKEN = process.env.NOTION_TOKEN;
const TEST_ROOT_PAGE = process.env.NOTION_ROOT_PAGE_ID;

if (!TEST_TOKEN || !TEST_ROOT_PAGE) {
  throw new Error(
    "NOTION_TOKEN and NOTION_ROOT_PAGE_ID environment variables are required for testing"
  );
}

// Set up global variables required by the service
declare global {
  var NOTION_TOKEN: string;
  var NOTION_ROOT_PAGE_ID: string;
}
globalThis.NOTION_TOKEN = TEST_TOKEN;
globalThis.NOTION_ROOT_PAGE_ID = TEST_ROOT_PAGE;

describe("Notion Service Integration Tests", () => {
  let client: Client;

  beforeAll(() => {
    client = initNotionClient(TEST_TOKEN);
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

  test("should extract metadata from a page with missing properties", async () => {
    // Get a page to test
    const page = (await client.pages.retrieve({
      page_id: TEST_ROOT_PAGE,
    })) as PageObjectResponse;

    // Transform the page to D1Post format
    const posts = transformToD1Posts([page]);
    expect(posts.length).toBe(1);

    const metadata = posts[0] as D1PostMetadata;

    // Test required fields that should always be present
    expect(metadata).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      created_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
      updated_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
      notion_last_edited_at: expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      ),
      notion_url: expect.stringContaining("https://www.notion.so/"),
    });

    // Test optional fields
    expect(metadata).toHaveProperty("category");
    expect(metadata).toHaveProperty("author");
    expect(metadata).toHaveProperty("excerpt");

    // Log the extracted metadata for inspection
    console.log("\nExtracted D1PostMetadata:", {
      id: metadata.id,
      title: metadata.title,
      dates: {
        created_at: metadata.created_at,
        updated_at: metadata.updated_at,
        notion_last_edited_at: metadata.notion_last_edited_at,
      },
      properties: {
        category: metadata.category,
        author: metadata.author,
        excerpt: metadata.excerpt,
      },
      notion_url: metadata.notion_url,
    });
  });

  test("should handle invalid page content gracefully", async () => {
    const invalidPageId = "00000000-0000-0000-0000-000000000000";
    const content = await fetchPageContent(invalidPageId);
    expect(content).toBeNull();
  });
});
