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
import { NOTION_API } from "../configs/api.config";
import { ERROR_MESSAGES } from "../configs/constants.config";
import type { D1Post, NotionPage } from "../types";
import { createNotionAPIError } from "../utils/errors.util";
import { createLogger } from "../utils/logger.util";
import { PropertyMappers } from "../utils/property-mappers.util";
import { withRateLimit } from "../utils/rate-limiter.util";
import { validateNotionPage } from "../utils/validation.util";

const logger = createLogger("NotionService");

// =========================================
// Client Configuration
// =========================================

const rateLimitedFetch = <T>(fn: () => Promise<T>): Promise<T> =>
  withRateLimit(fn, {
    maxRequestsPerSecond: NOTION_API.RATE_LIMITS.MAX_REQUESTS_PER_SECOND,
    maxRequestsPerMinute: NOTION_API.RATE_LIMITS.MAX_REQUESTS_PER_MINUTE,
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
    notionVersion: NOTION_API.VERSION,
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
    const props = page.properties;

    // Validate required properties
    if (!isTitle(props.Title)) throw new Error("Invalid title property");
    if (!isSelect(props.Category)) throw new Error("Invalid category property");
    if (!isPeople(props.Author)) throw new Error("Invalid author property");

    const post: D1Post = {
      id: page.id,
      title: PropertyMappers.title(props.Title),
      created_at: new Date(page.created_time).toISOString(),
      updated_at: new Date().toISOString(),
      notion_last_edited_at: new Date(page.last_edited_time).toISOString(),
      category: PropertyMappers.select(props.Category),
      author: PropertyMappers.people(props.Author),
      notion_url: page.url,
      excerpt: isRichText(props.Excerpt)
        ? PropertyMappers.text(props.Excerpt)
        : null,

      // Clear AI-generated fields to trigger regeneration
      summary: null,
      tags: null,
      mins_read: null,

      // Keep image-related fields as is
      image_url: isUrl(props.Image) ? PropertyMappers.url(props.Image) : null,
      r2_image_url: null,
      image_task_id: null,
    };

    return post;
  });
};

export const initNotionClient = (token: string): Client => {
  if (!token) {
    throw createNotionAPIError("Missing Notion API token");
  }

  return new Client({
    auth: token,
    notionVersion: NOTION_API.VERSION,
  });
};
