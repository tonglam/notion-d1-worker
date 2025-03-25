import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { DEEPSEEK_API_CONFIG } from "../configs/api.config";
import type { NotionPage } from "../types/notion.types";
import { createValidationError } from "./errors.util";

/**
 * Basic validation and transformation of a Notion page
 */
export const validateNotionPage = (page: PageObjectResponse): NotionPage => {
  try {
    // Only validate what we absolutely need - a title
    if (!page.properties.title || page.properties.title.type !== "title") {
      throw createValidationError("Page must have a title property");
    }

    return {
      id: page.id,
      created_time: page.created_time,
      last_edited_time: page.last_edited_time,
      url: page.url,
      properties: {
        title: {
          type: "title",
          title: page.properties.title.title.map((t) => ({
            plain_text: t.plain_text || "",
          })),
        },
        // Only include other properties if they exist and match expected type
        ...(page.properties.category?.type === "select" && {
          category: {
            type: "select",
            select: { name: page.properties.category.select?.name || "" },
          },
        }),
        ...(page.properties.author?.type === "people" && {
          author: {
            type: "people",
            people:
              page.properties.author.people?.map((p) => ({
                // Handle both UserObjectResponse and PartialUserObjectResponse
                name: "name" in p ? p.name : null,
              })) || [],
          },
        }),
        ...(page.properties.parent?.type === "relation" && {
          parent: {
            type: "relation",
            relation:
              page.properties.parent.relation?.map((r) => ({
                id: r.id || "",
              })) || [],
          },
        }),
        ...(page.properties.mit_parent?.type === "relation" && {
          mit_parent: {
            type: "relation",
            relation:
              page.properties.mit_parent.relation?.map((r) => ({
                id: r.id || "",
              })) || [],
          },
        }),
        ...(page.properties.child_pages?.type === "relation" && {
          child_pages: {
            type: "relation",
            relation:
              page.properties.child_pages.relation?.map((r) => ({
                id: r.id || "",
              })) || [],
          },
        }),
      },
    };
  } catch (error) {
    throw createValidationError(
      "Failed to validate Notion page",
      error instanceof Error ? error : undefined
    );
  }
};

/**
 * Check if a page has valid content (has a title)
 */
export const hasValidContent = (page: NotionPage): boolean => {
  return page.properties.title?.title?.some((t) => t.plain_text) || false;
};

/**
 * Check if a page is a category page (has child pages)
 */
export const isCategoryPage = (page: NotionPage): boolean => {
  const childPages = page.properties.child_pages?.relation;
  return Array.isArray(childPages) && childPages.length > 0;
};

/**
 * Validate token limits for AI operations
 */
export const validateTokenLimits = (content: string): void => {
  const estimatedTokens = Math.ceil(content.length / 4);
  if (estimatedTokens > DEEPSEEK_API_CONFIG.LIMITS.MAX_INPUT_TOKENS) {
    throw createValidationError(
      `Content exceeds maximum input token limit of ${DEEPSEEK_API_CONFIG.LIMITS.MAX_INPUT_TOKENS} tokens (estimated: ${estimatedTokens} tokens)`
    );
  }
};
