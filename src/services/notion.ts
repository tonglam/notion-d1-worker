import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { ERROR_MESSAGES, LOG_MESSAGES, NOTION_API_VERSION } from "../constants";
import type { D1Post, NotionPage } from "../types";
import { createNotionAPIError } from "../utils/errors";
import { createLogger } from "../utils/logger";
import { validateNotionPage } from "../utils/validation";

const logger = createLogger("NotionService");

const createNotionClient = (token: string): Client => {
  return new Client({
    auth: token,
    notionVersion: NOTION_API_VERSION,
  });
};

export const fetchPublishedPosts = async (
  token: string,
  databaseId: string
): Promise<NotionPage[]> => {
  logger.info(LOG_MESSAGES.FETCH_START);
  const notion = createNotionClient(token);

  try {
    const response = await notion.databases.query({
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
    });

    // Filter for page objects and validate them
    const pages = response.results.filter(
      (page): page is PageObjectResponse => "properties" in page
    );

    const validPages: NotionPage[] = [];
    for (const page of pages) {
      try {
        validPages.push(validateNotionPage(page));
      } catch (error) {
        logger.warn(
          `Skipping invalid page ${page.id}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    logger.info(LOG_MESSAGES.FETCH_COMPLETE(validPages.length));
    if (validPages.length < pages.length) {
      logger.warn(
        `Filtered out ${pages.length - validPages.length} invalid pages`
      );
    }

    return validPages;
  } catch (error) {
    logger.error(ERROR_MESSAGES.NOTION_FETCH, error);
    throw createNotionAPIError(ERROR_MESSAGES.NOTION_FETCH, error);
  }
};

export const transformToD1Posts = (pages: NotionPage[]): D1Post[] => {
  try {
    return pages.map((page) => ({
      id: page.id,
      title: page.properties.Title.title[0]?.plain_text || "",
      slug: page.properties.Slug.rich_text[0]?.plain_text || "",
      created_at: new Date(page.created_time).toISOString(),
      updated_at: new Date(page.last_edited_time).toISOString(),
      published: page.properties.Published.checkbox,
      category: JSON.stringify(page.properties.Category.select || {}),
      tags: JSON.stringify(page.properties.Tags.multi_select || []),
      author: JSON.stringify(page.properties.Author.people || []),
      excerpt: page.properties.Excerpt?.rich_text[0]?.plain_text || null,
      summary: page.properties.Summary?.rich_text[0]?.plain_text || null,
      mins_read: page.properties["Mins Read"]?.number || null,
      image_url: page.properties["Image URL"]?.url || null,
      notion_url: page.url,
      content_key:
        page.properties["Content Key"].rich_text[0]?.plain_text || "",
    }));
  } catch (error) {
    logger.error(ERROR_MESSAGES.TRANSFORM, error);
    throw createNotionAPIError(ERROR_MESSAGES.TRANSFORM, error);
  }
};
