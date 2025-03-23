import { Client } from "@notionhq/client";
import type {
  BlockObjectResponse,
  ListBlockChildrenResponse,
  PageObjectResponse,
  PeoplePropertyItemObjectResponse,
  RichTextItemResponse,
  SelectPropertyItemObjectResponse,
  TitlePropertyItemObjectResponse,
  UrlPropertyItemObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { NOTION_API_CONFIG } from "../configs/api.config";
import { ERROR_MESSAGES } from "../configs/constants.config";
import type { D1Post, NotionPage } from "../types";
import { createNotionAPIError } from "../utils/errors.util";
import { createLogger } from "../utils/logger.util";
import { withRateLimit } from "../utils/rate-limiter.util";
import { validateNotionPage } from "../utils/validation.util";

const logger = createLogger("NotionService");

// =========================================
// Client Configuration
// =========================================

const rateLimitedFetch = <T>(fn: () => Promise<T>): Promise<T> =>
  withRateLimit(fn, {
    maxRequestsPerSecond: NOTION_API_CONFIG.RATE_LIMITS.MAX_REQUESTS_PER_SECOND,
    maxRequestsPerMinute: NOTION_API_CONFIG.RATE_LIMITS.MAX_REQUESTS_PER_MINUTE,
  });

/** Singleton instance of the Notion client */
let notionClient: Client | null = null;

/**
 * Gets or creates a rate-limited Notion client using environment variables
 * @returns Notion client instance
 * @throws Error If NOTION_TOKEN is not set
 */
const getNotionClient = (): Client => {
  if (notionClient) {
    return notionClient;
  }

  const token = NOTION_TOKEN;
  if (!token) {
    throw createNotionAPIError("NOTION_TOKEN environment variable is required");
  }

  notionClient = new Client({
    auth: token,
    notionVersion: NOTION_API_CONFIG.VERSION,
  });

  return notionClient;
};

// =========================================
// Page Validation
// =========================================

/**
 * Checks if a page is a category page
 * @param page - Notion page to check
 * @returns true if page is a category page
 */
const isCategoryPage = (page: NotionPage): boolean => {
  // A category page has child pages
  return page.properties["Child Pages"]?.relation?.length > 0;
};

/**
 * Checks if a page is a valid content page (not a category page and has content)
 * @param page - Notion page to validate
 * @returns true if page is valid content page, false otherwise
 */
const isValidContentPage = (page: NotionPage): boolean => {
  // If it's a category page, it's not a content page
  if (isCategoryPage(page)) {
    return false;
  }

  // Check if page has actual content
  const hasTitle = page.properties.Title.title.length > 0;
  const hasContent = page.properties["Content Key"]?.rich_text?.length > 0;
  const hasExcerpt = page.properties.Excerpt?.rich_text?.length > 0;
  const hasParent = page.properties.Parent?.relation?.length > 0;
  const hasMITParent = page.properties["MIT Parent"]?.relation?.length > 0;

  // Content page must have a title, content/excerpt, and a parent relation
  return hasTitle && (hasContent || hasExcerpt) && (hasParent || hasMITParent);
};

/**
 * Process pages and separate valid from invalid ones
 * @param pages - Array of page objects
 * @returns Object containing valid and invalid pages
 */
export const processPages = (
  pages: PageObjectResponse[]
): {
  pages: NotionPage[];
} => {
  const validPages: NotionPage[] = [];

  for (const page of pages) {
    try {
      const validatedPage = validateNotionPage(page);

      // Additional validation for content pages
      if (!isValidContentPage(validatedPage)) {
        continue;
      }
    } catch (error) {
      logger.warn("Invalid page", {
        pageId: page.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { pages: validPages };
};

// =========================================
// Data Fetching
// =========================================

/**
 * Recursively fetches all child pages from a root page with rate limiting
 * @returns Array of page objects
 * @throws {createNotionAPIError} If API call fails
 */
export const fetchRawPages = async (): Promise<PageObjectResponse[]> => {
  const notion = getNotionClient();
  const rootPageId = NOTION_ROOT_PAGE_ID;

  const allPages: PageObjectResponse[] = [];
  const queue: string[] = [rootPageId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const pageId = queue.shift()!;
    if (visited.has(pageId)) continue;
    visited.add(pageId);

    try {
      // Get the page content
      const page = (await rateLimitedFetch(() =>
        notion.pages.retrieve({ page_id: pageId })
      )) as PageObjectResponse;

      // Get child blocks
      let hasMore = true;
      let startCursor: string | undefined = undefined;

      while (hasMore) {
        const response = await rateLimitedFetch(() =>
          notion.blocks.children.list({
            block_id: pageId,
            start_cursor: startCursor,
          })
        );

        // Add child page IDs to queue
        const childPageBlocks = response.results.filter(
          (
            block: ListBlockChildrenResponse["results"][number]
          ): block is BlockObjectResponse =>
            "type" in block && block.type === "child_page"
        );
        const childPageIds = childPageBlocks.map(
          (block: BlockObjectResponse) => block.id
        );
        queue.push(...childPageIds);

        hasMore = response.has_more;
        startCursor = response.next_cursor ?? undefined;
      }

      // Only add pages that have the required properties
      if ("properties" in page) {
        allPages.push(page);
      }
    } catch (error) {
      logger.warn("Failed to fetch page", {
        pageId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      continue;
    }
  }

  return allPages;
};

/**
 * Extracts text content from a block
 * @param block - Notion block object
 * @returns Extracted text content
 */
const extractBlockContent = (block: BlockObjectResponse): string => {
  if (!("type" in block)) return "";

  switch (block.type) {
    case "paragraph":
      return block.paragraph.rich_text.map((text) => text.plain_text).join(" ");
    case "heading_1":
      return block.heading_1.rich_text.map((text) => text.plain_text).join(" ");
    case "heading_2":
      return block.heading_2.rich_text.map((text) => text.plain_text).join(" ");
    case "heading_3":
      return block.heading_3.rich_text.map((text) => text.plain_text).join(" ");
    case "bulleted_list_item":
      return block.bulleted_list_item.rich_text
        .map((text) => text.plain_text)
        .join(" ");
    case "numbered_list_item":
      return block.numbered_list_item.rich_text
        .map((text) => text.plain_text)
        .join(" ");
    case "quote":
      return block.quote.rich_text.map((text) => text.plain_text).join(" ");
    case "code":
      return block.code.rich_text.map((text) => text.plain_text).join(" ");
    default:
      return "";
  }
};

/**
 * Fetches and extracts content from a Notion page
 * @param pageId - ID of the page to fetch
 * @returns Extracted text content or null if failed
 * @throws {NotionAPIError} If API call fails
 */
export const fetchPageContent = async (
  pageId: string
): Promise<string | null> => {
  try {
    const notion = getNotionClient();
    let content: string[] = [];
    let hasMore = true;
    let startCursor: string | undefined = undefined;

    // Get page title
    const page = (await rateLimitedFetch(() =>
      notion.pages.retrieve({ page_id: pageId })
    )) as PageObjectResponse;

    if ("properties" in page && "Title" in page.properties) {
      const titleProp = page.properties.Title;
      if ("title" in titleProp && titleProp.title.length > 0) {
        content.push(titleProp.title[0].plain_text);
      }
    }

    // Get page content blocks
    while (hasMore) {
      const response = await rateLimitedFetch(() =>
        notion.blocks.children.list({
          block_id: pageId,
          start_cursor: startCursor,
        })
      );

      const blockContents = response.results
        .filter((block): block is BlockObjectResponse => "type" in block)
        .map(extractBlockContent)
        .filter(Boolean);

      content.push(...blockContents);

      hasMore = response.has_more;
      startCursor = response.next_cursor ?? undefined;
    }

    return content.join("\n");
  } catch (error) {
    logger.error("Failed to fetch page content", {
      pageId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
};

// =========================================
// Public API
// =========================================

/**
 * Fetches published posts from the Notion root page with rate limiting
 * @returns Array of validated Notion pages
 * @throws {createNotionAPIError} If API call fails
 */
export const fetchPublishedPosts = async (): Promise<NotionPage[]> => {
  try {
    const pages = await fetchRawPages();
    const { pages: validPages } = processPages(pages);
    return validPages;
  } catch (error) {
    logger.error(ERROR_MESSAGES.NOTION_FETCH, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw createNotionAPIError(ERROR_MESSAGES.NOTION_FETCH, error);
  }
};

/**
 * Gets unique categories from Notion pages based on page hierarchy
 * @param pages - Array of Notion pages
 * @returns Object containing regular and MIT categories
 */
export const getCategories = (
  pages: NotionPage[]
): {
  regularCategories: string[];
  mitCategories: string[];
} => {
  const regularCategories = new Set<string>();
  const mitCategories = new Set<string>();

  for (const page of pages) {
    // Check if page has a parent relation
    const parentRelation = page.properties.Parent?.relation?.[0]?.id;
    const mitParentRelation = page.properties["MIT Parent"]?.relation?.[0]?.id;

    if (parentRelation) {
      regularCategories.add(parentRelation);
    }
    if (mitParentRelation) {
      mitCategories.add(mitParentRelation);
    }
  }

  const sortedRegularCategories = Array.from(regularCategories).sort();
  const sortedMitCategories = Array.from(mitCategories).sort();

  return {
    regularCategories: sortedRegularCategories,
    mitCategories: sortedMitCategories,
  };
};

/**
 * Type guards for Notion property types
 */
const isTitle = (prop: unknown): prop is TitlePropertyItemObjectResponse =>
  !!prop && typeof prop === "object" && "type" in prop && prop.type === "title";

const isSelect = (prop: unknown): prop is SelectPropertyItemObjectResponse =>
  !!prop &&
  typeof prop === "object" &&
  "type" in prop &&
  prop.type === "select";

const isPeople = (prop: unknown): prop is PeoplePropertyItemObjectResponse =>
  !!prop &&
  typeof prop === "object" &&
  "type" in prop &&
  prop.type === "people";

const isRichText = (
  prop: unknown
): prop is { rich_text: RichTextItemResponse[] } =>
  !!prop &&
  typeof prop === "object" &&
  "type" in prop &&
  prop.type === "rich_text";

const isUrl = (prop: unknown): prop is UrlPropertyItemObjectResponse =>
  !!prop && typeof prop === "object" && "type" in prop && prop.type === "url";

/**
 * Transforms Notion pages to D1Post format
 * If content has changed (detected by notion_last_edited_at),
 * clears AI-generated fields to trigger regeneration
 */
export const transformToD1Posts = (pages: PageObjectResponse[]): D1Post[] => {
  return pages.map((page) => {
    // Extract basic metadata that should always be present
    const id = page.id;
    const created_at = page.created_time;
    const updated_at = page.last_edited_time;
    const notion_last_edited_at = page.last_edited_time;
    const notion_url = page.url;

    // Extract title with fallback
    let title = "Untitled";
    if ("properties" in page && "title" in page.properties) {
      const titleProp = page.properties.title;
      if (isTitle(titleProp) && titleProp.title.length > 0) {
        title = titleProp.title[0].plain_text;
      }
    }

    // Extract optional properties with fallbacks
    let category = "Uncategorized";
    let author = "Unknown";
    let excerpt: string | null = null;

    if ("properties" in page) {
      // Try to extract category
      const categoryProp = page.properties.Category;
      if (isSelect(categoryProp) && categoryProp.select) {
        category = categoryProp.select.name;
      }

      // Try to extract author
      const authorProp = page.properties.Author;
      if (isPeople(authorProp) && authorProp.people.length > 0) {
        const user = authorProp.people[0];
        author = "name" in user ? user.name ?? "Unknown" : "Unknown";
      }

      // Try to extract excerpt
      const excerptProp = page.properties.Excerpt;
      if (isRichText(excerptProp) && excerptProp.rich_text.length > 0) {
        excerpt = excerptProp.rich_text[0].plain_text;
      }
    }

    // Return D1Post with all fields
    return {
      id,
      title,
      created_at,
      updated_at,
      notion_last_edited_at,
      category,
      author,
      notion_url,
      excerpt,
      // Extended fields with null defaults
      summary: null,
      mins_read: null,
      image_task_id: null,
      image_url: null,
      tags: null,
      r2_image_url: null,
    };
  });
};

export const initNotionClient = (token: string): Client => {
  if (!token) {
    throw createNotionAPIError("Missing Notion API token");
  }

  return new Client({
    auth: token,
    notionVersion: NOTION_API_CONFIG.VERSION,
  });
};
