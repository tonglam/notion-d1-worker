import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import {
  ERROR_MESSAGES,
  LOG_MESSAGES,
  NOTION_API_VERSION,
} from "../configs/constants.config";
import type { D1Post, NotionPage } from "../types/types";
import { createNotionAPIError } from "../utils/errors.util";
import { createLogger } from "../utils/logger.util";
import { RateLimiter } from "../utils/rate-limiter.util";
import { validateNotionPage } from "../utils/validation.util";

const logger = createLogger("NotionService");

// Notion API rate limits
const RATE_LIMITS = {
  MAX_REQUESTS_PER_SECOND: 3,
  MAX_REQUESTS_PER_MINUTE: 90,
} as const;

const rateLimiter = new RateLimiter({
  maxRequestsPerSecond: RATE_LIMITS.MAX_REQUESTS_PER_SECOND,
  maxRequestsPerMinute: RATE_LIMITS.MAX_REQUESTS_PER_MINUTE,
});

/**
 * Creates a rate-limited Notion client
 * @param token - Notion API token
 * @returns Notion client instance
 * @throws {NotionAPIError} If token is invalid
 */
const createNotionClient = (token: string): Client => {
  if (!token) {
    throw createNotionAPIError("Notion API token is required");
  }

  return new Client({
    auth: token,
    notionVersion: NOTION_API_VERSION,
  });
};

/**
 * Validates a Notion database ID
 * @param databaseId - Database ID to validate
 * @throws {NotionAPIError} If ID is invalid
 */
const validateDatabaseId = (databaseId: string): void => {
  if (!databaseId) {
    throw createNotionAPIError("Database ID is required");
  }

  if (!/^[a-f0-9-]+$/i.test(databaseId)) {
    throw createNotionAPIError("Invalid database ID format");
  }
};

/**
 * Fetches published posts from a Notion database with rate limiting
 * @param token - Notion API token
 * @param databaseId - Notion database ID
 * @returns Array of validated Notion pages
 * @throws {NotionAPIError} If API call fails
 */
export const fetchPublishedPosts = async (
  token: string,
  databaseId: string
): Promise<NotionPage[]> => {
  logger.info(LOG_MESSAGES.FETCH_START);

  try {
    validateDatabaseId(databaseId);
    const notion = createNotionClient(token);

    logger.debug("Querying Notion database", {
      databaseId,
      filter: "Published = true",
      sort: "created_time DESC",
    });

    const response = await rateLimiter.wrap(() =>
      notion.databases.query({
        database_id: databaseId,
        filter: {
          property: "Published",
          checkbox: {
            equals: true,
          },
        },
        sorts: [
          {
            property: "created_time",
            direction: "descending",
          },
        ],
      })
    );

    // Filter for page objects and validate them
    const pages = response.results.filter(
      (page): page is PageObjectResponse => "properties" in page
    );

    logger.debug("Processing Notion pages", {
      totalPages: response.results.length,
      validPageObjects: pages.length,
    });

    const validPages: NotionPage[] = [];
    const invalidPages: { id: string; error: string }[] = [];

    for (const page of pages) {
      try {
        validPages.push(validateNotionPage(page));
      } catch (error) {
        invalidPages.push({
          id: page.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        logger.warn("Invalid page", {
          pageId: page.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    logger.info(LOG_MESSAGES.FETCH_COMPLETE(validPages.length), {
      totalPages: response.results.length,
      validPages: validPages.length,
      invalidPages: invalidPages.length,
      invalidPageDetails: invalidPages,
    });

    return validPages;
  } catch (error) {
    logger.error(ERROR_MESSAGES.NOTION_FETCH, {
      error: error instanceof Error ? error.message : "Unknown error",
      databaseId,
    });
    throw createNotionAPIError(ERROR_MESSAGES.NOTION_FETCH, error);
  }
};

/**
 * Transforms Notion pages to D1 post format
 * @param pages - Array of Notion pages
 * @returns Array of D1 posts
 * @throws {NotionAPIError} If transformation fails
 */
export const transformToD1Posts = (pages: NotionPage[]): D1Post[] => {
  logger.info(LOG_MESSAGES.TRANSFORM_START);

  try {
    const posts = pages.map((page) => {
      const title = page.properties.Title.title[0]?.plain_text;
      if (!title) {
        throw createNotionAPIError(`Page ${page.id} has no title`);
      }

      const category = page.properties.Category.select?.name;
      if (!category) {
        throw createNotionAPIError(`Page ${page.id} has no category`);
      }

      const author = page.properties.Author.people[0]?.name;
      if (!author) {
        throw createNotionAPIError(`Page ${page.id} has no author`);
      }

      return {
        id: page.id,
        title,
        created_at: new Date(page.created_time).toISOString(),
        updated_at: new Date().toISOString(),
        notion_last_edited_at: new Date(page.last_edited_time).toISOString(),
        category,
        author,
        excerpt: page.properties.Excerpt?.rich_text[0]?.plain_text || null,
        summary: page.properties.Summary?.rich_text[0]?.plain_text || null,
        mins_read: page.properties["Mins Read"]?.number || null,
        image_url: page.properties["Image URL"]?.url || null,
        notion_url: page.url,
        tags:
          page.properties.Tags.multi_select.map((tag) => tag.name).join(", ") ||
          null,
        r2_image_url: null,
        image_task_id: null,
        error: null,
      };
    });

    logger.info(LOG_MESSAGES.TRANSFORM_COMPLETE(posts.length));
    return posts;
  } catch (error) {
    logger.error(ERROR_MESSAGES.TRANSFORM, {
      error: error instanceof Error ? error.message : "Unknown error",
      pageCount: pages.length,
    });
    throw createNotionAPIError(ERROR_MESSAGES.TRANSFORM, error);
  }
};
