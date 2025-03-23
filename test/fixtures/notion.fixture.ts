import type {
  BlockObjectResponse,
  ListBlockChildrenResponse,
  PageObjectResponse,
  ParagraphBlockObjectResponse,
  SearchResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { NOTION_API_CONFIG } from "../../src/configs/api.config";

/**
 * Creates a mock Notion page for testing
 */
export const createMockPage = (
  id: string,
  title: string,
  category: string,
  author: string
): PageObjectResponse => ({
  id,
  created_time: new Date().toISOString(),
  last_edited_time: new Date().toISOString(),
  url: `https://notion.so/${id}`,
  archived: false,
  icon: null,
  cover: null,
  created_by: {
    id: "user-1",
    object: "user",
  },
  last_edited_by: {
    id: "user-1",
    object: "user",
  },
  parent: {
    type: "workspace",
    workspace: true,
  },
  object: "page",
  properties: {
    Title: {
      id: "title",
      type: "title",
      title: [
        {
          type: "text",
          text: { content: title, link: null },
          annotations: {
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: false,
            color: "default",
          },
          plain_text: title,
          href: null,
        },
      ],
    },
    Category: {
      id: "category",
      type: "select",
      select: {
        id: "cat-1",
        name: category,
        color: "blue",
      },
    },
    Author: {
      id: "author",
      type: "people",
      people: [
        {
          id: "user-1",
          name: author,
          avatar_url: null,
          type: "person",
          person: {},
          object: "user",
        },
      ],
    },
    "Content Key": {
      id: "content",
      type: "rich_text",
      rich_text: [
        {
          type: "text",
          text: { content: "test-content", link: null },
          annotations: {
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: false,
            color: "default",
          },
          plain_text: "test-content",
          href: null,
        },
      ],
    },
    Parent: {
      id: "parent",
      type: "relation",
      relation: [{ id: "parent-1" }],
    },
  },
  in_trash: false,
  public_url: null,
});

/**
 * Creates a mock block response for testing
 */
export const createMockBlock = (
  id: string,
  content: string
): ParagraphBlockObjectResponse => ({
  id,
  created_time: new Date().toISOString(),
  last_edited_time: new Date().toISOString(),
  has_children: false,
  archived: false,
  type: "paragraph",
  paragraph: {
    rich_text: [
      {
        type: "text",
        text: { content, link: null },
        annotations: {
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: "default",
        },
        plain_text: content,
        href: null,
      },
    ],
    color: "default",
  },
  object: "block",
  parent: {
    type: "page_id",
    page_id: "page-1",
  },
  created_by: {
    id: "user-1",
    object: "user",
  },
  last_edited_by: {
    id: "user-1",
    object: "user",
  },
  in_trash: false,
});

/**
 * Creates a mock Notion client for testing
 */
export const createMockNotionClient = () => {
  const pages = new Map<string, PageObjectResponse>();
  const blocks = new Map<string, BlockObjectResponse[]>();

  // Add some test data
  const testPage = createMockPage(
    "test-page",
    "Test Page",
    "Test Category",
    "Test Author"
  );
  pages.set(testPage.id, testPage);
  blocks.set(testPage.id, [
    createMockBlock("block-1", "Test content paragraph 1"),
    createMockBlock("block-2", "Test content paragraph 2"),
  ]);

  return {
    pages: {
      retrieve: async ({ page_id }: { page_id: string }) => {
        const page = pages.get(page_id);
        if (!page) {
          throw new Error(`Page not found: ${page_id}`);
        }
        return page;
      },
    },
    blocks: {
      children: {
        list: async ({
          block_id,
          start_cursor,
        }: {
          block_id: string;
          start_cursor?: string;
        }): Promise<ListBlockChildrenResponse> => {
          const pageBlocks = blocks.get(block_id) || [];
          const startIndex = start_cursor ? parseInt(start_cursor) : 0;
          const results = pageBlocks.slice(startIndex, startIndex + 10);

          return {
            type: "block",
            object: "list",
            results,
            next_cursor: results.length === 10 ? `${startIndex + 10}` : null,
            has_more: results.length === 10,
            block: {},
          };
        },
      },
    },
    search: async (): Promise<SearchResponse> => {
      return {
        type: "page_or_database",
        object: "list",
        results: Array.from(pages.values()),
        next_cursor: null,
        has_more: false,
        page_or_database: {},
      };
    },
    getVersion: () => NOTION_API_CONFIG.VERSION,
  };
};
