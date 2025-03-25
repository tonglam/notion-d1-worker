import { Client } from "@notionhq/client";
import type {
  BlockObjectResponse,
  ListBlockChildrenResponse,
  PageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { NOTION_API_CONFIG } from "../configs/api.config";
import { ERROR_MESSAGES } from "../configs/constants.config";
import type { D1Post } from "../types/db.types";
import type { NotionPage } from "../types/notion.types";
import { createNotionAPIError } from "../utils/errors.util";
import { createLogger } from "../utils/logger.util";
import { withRateLimit } from "../utils/rate-limiter.util";
import { hasValidContent, validateNotionPage } from "../utils/validation.util";

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
    logger.info("Returning existing Notion client");
    return notionClient;
  }

  logger.info("Creating new Notion client");

  if (!NOTION_TOKEN) {
    logger.error("NOTION_TOKEN environment variable is missing");
    throw createNotionAPIError("NOTION_TOKEN environment variable is required");
  }

  logger.info("Initializing Notion client", {
    notionVersion: NOTION_API_CONFIG.VERSION,
    tokenLength: NOTION_TOKEN.length,
    tokenPrefix: NOTION_TOKEN.substring(0, 4) + "...", // Log first 4 chars for debugging
  });

  try {
    notionClient = new Client({
      auth: NOTION_TOKEN,
      notionVersion: NOTION_API_CONFIG.VERSION,
    });

    logger.info("Successfully created Notion client");
    return notionClient;
  } catch (error) {
    logger.error("Failed to create Notion client", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw createNotionAPIError("Failed to create Notion client", error);
  }
};

// =========================================
// Page Validation
// =========================================

/**
 * Checks if a page is a valid content page
 */
function isValidContentPage(page: NotionPage): boolean {
  if (!hasValidContent(page)) {
    logger.warn("[NotionService] Failed to validate page", {
      pageId: page.id,
      url: page.url,
      error: "Invalid or missing title property",
    });
    return false;
  }
  return true;
}

/**
 * Process pages and filter valid ones
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
      if (!isValidContentPage(validatedPage)) {
        logger.warn("Page failed content validation", {
          pageId: page.id,
          url: page.url,
        });
        continue;
      }
      validPages.push(validatedPage);
    } catch (error) {
      logger.warn("Failed to validate page", {
        pageId: page.id,
        url: page.url,
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
  logger.info("Starting to fetch raw pages");
  const notion = getNotionClient();

  if (!NOTION_ROOT_PAGE_ID) {
    logger.error("NOTION_ROOT_PAGE_ID environment variable is missing");
    throw createNotionAPIError(
      "NOTION_ROOT_PAGE_ID environment variable is required"
    );
  }

  logger.info("Fetching pages with root page ID", {
    rootPageId: NOTION_ROOT_PAGE_ID,
  });

  const allPages: PageObjectResponse[] = [];
  const queue: string[] = [NOTION_ROOT_PAGE_ID];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const pageId = queue.shift()!;
    if (visited.has(pageId)) continue;
    visited.add(pageId);

    try {
      logger.info("Fetching page content", { pageId });
      // Get the page content
      const page = (await rateLimitedFetch(() =>
        notion.pages.retrieve({ page_id: pageId })
      )) as PageObjectResponse;

      logger.info("Successfully fetched page", {
        pageId,
        hasProperties: "properties" in page,
        propertyTypes:
          "properties" in page
            ? Object.entries(page.properties).map(([key, value]) => ({
                name: key,
                type: value.type,
              }))
            : [],
        url: page.url,
      });

      // Get child blocks
      let hasMore = true;
      let startCursor: string | undefined = undefined;

      while (hasMore) {
        logger.info("Fetching child blocks", {
          pageId,
          startCursor,
        });

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

        logger.info("Found child pages", {
          pageId,
          childCount: childPageIds.length,
          childPageTitles: childPageBlocks.map((block) =>
            "child_page" in block ? block.child_page.title : null
          ),
        });

        queue.push(...childPageIds);

        hasMore = response.has_more;
        startCursor = response.next_cursor ?? undefined;
      }

      // Only add pages that have the required properties
      if ("properties" in page) {
        allPages.push(page);
        logger.info("Added page to results", {
          pageId,
          title:
            page.properties.title?.type === "title"
              ? page.properties.title.title.map((t) => t.plain_text).join("")
              : "No title property",
        });
      } else {
        logger.warn("Skipping page without properties", {
          pageId,
          object_type: (page as { object: string }).object,
          url: (page as { url: string }).url,
        });
      }
    } catch (error) {
      logger.error("Failed to fetch page", {
        pageId,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      continue;
    }
  }

  logger.info("Completed fetching raw pages", {
    totalPages: allPages.length,
    visitedPages: visited.size,
  });

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

    if ("properties" in page && "title" in page.properties) {
      const titleProp = page.properties.title;
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
 * Gets unique categories from pages
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
    const parentId = page.properties.parent?.relation?.[0]?.id;
    const mitParentId = page.properties.mit_parent?.relation?.[0]?.id;

    if (parentId) regularCategories.add(parentId);
    if (mitParentId) mitCategories.add(mitParentId);
  }

  return {
    regularCategories: Array.from(regularCategories).sort(),
    mitCategories: Array.from(mitCategories).sort(),
  };
};

/**
 * Transforms Notion pages to D1Post format
 */
export const transformToD1Posts = (pages: NotionPage[]): D1Post[] => {
  return pages.map((page) => ({
    id: page.id,
    title: page.properties.title.title.map((item) => item.plain_text).join(""),
    created_at: page.created_time,
    updated_at: page.last_edited_time,
    notion_url: page.url,
    notion_last_edited_at: page.last_edited_time,
    category: page.properties.category?.select?.name || "Uncategorized",
    author: page.properties.author?.people?.[0]?.name || "Unknown",
    excerpt: null,
    summary: null,
    mins_read: null,
    image_task_id: null,
    image_url: null,
    tags: null,
    r2_image_url: null,
  }));
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
