import type {
  PageObjectResponse,
  PeoplePropertyItemObjectResponse,
  RichTextPropertyItemObjectResponse,
  SelectPropertyItemObjectResponse,
  TitlePropertyItemObjectResponse,
  UrlPropertyItemObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import {
  estimateReadingTime,
  generateImage,
  generatePostSummary,
  generatePostTags,
} from "../services/ai.service";
import { fetchPageContent } from "../services/notion.service";
import { createValidationError } from "./errors.util";
import { createLogger } from "./logger.util";

const logger = createLogger("NotionMapper");

/**
 * Generates an excerpt from content with proper sentence/word boundaries
 */
const generateExcerpt = (content: string, maxLength = 200): string => {
  if (!content) return "";

  // Remove extra whitespace and normalize spaces
  const cleanContent = content.replace(/\s+/g, " ").trim();

  // Return as is if content is already shorter than max length
  if (cleanContent.length <= maxLength) {
    return cleanContent;
  }

  // Try to find a sentence break near the max length
  const sentenceBreak = cleanContent.slice(0, maxLength).lastIndexOf(".");
  if (sentenceBreak !== -1 && sentenceBreak > maxLength / 2) {
    return cleanContent.slice(0, sentenceBreak + 1);
  }

  // Fall back to word boundary
  const wordBreak = cleanContent.slice(0, maxLength).lastIndexOf(" ");
  if (wordBreak !== -1) {
    return cleanContent.slice(0, wordBreak) + "...";
  }

  // Last resort: just cut at maxLength
  return cleanContent.slice(0, maxLength) + "...";
};

/**
 * Property mapping rules for different Notion property types
 */
const PropertyMappers = {
  /**
   * Maps a title property to a string
   */
  title: (prop: PageObjectResponse["properties"][string]): string => {
    if (prop.type !== "title") {
      throw createValidationError("Invalid property type, expected title");
    }
    const titleProp = prop as unknown as TitlePropertyItemObjectResponse;
    const titleItems = Array.isArray(titleProp.title) ? titleProp.title : [];
    const firstItem = titleItems[0];
    if (!firstItem?.plain_text) {
      throw createValidationError("Title cannot be empty");
    }
    return firstItem.plain_text;
  },

  /**
   * Maps a rich text property to a string or null
   */
  richText: (prop: PageObjectResponse["properties"][string]): string | null => {
    if (prop.type !== "rich_text") {
      throw createValidationError("Invalid property type, expected rich_text");
    }
    const richTextProp = prop as unknown as RichTextPropertyItemObjectResponse;
    const richTextItems = Array.isArray(richTextProp.rich_text)
      ? richTextProp.rich_text
      : [];
    const firstItem = richTextItems[0];
    return firstItem?.plain_text || null;
  },

  /**
   * Maps a select property to a string
   */
  select: (prop: PageObjectResponse["properties"][string]): string => {
    if (prop.type !== "select") {
      throw createValidationError("Invalid property type, expected select");
    }
    const selectProp = prop as unknown as SelectPropertyItemObjectResponse;
    if (!selectProp.select?.name) {
      throw createValidationError("Select value cannot be empty");
    }
    return selectProp.select.name;
  },

  /**
   * Maps a people property to a string (first person's name)
   */
  people: (prop: PageObjectResponse["properties"][string]): string => {
    if (prop.type !== "people") {
      throw createValidationError("Invalid property type, expected people");
    }
    const peopleProp = prop as unknown as PeoplePropertyItemObjectResponse;
    const people = Array.isArray(peopleProp.people) ? peopleProp.people : [];
    const firstPerson = people[0];
    if (!firstPerson?.name) {
      throw createValidationError(
        "People property must have at least one person"
      );
    }
    return firstPerson.name;
  },

  /**
   * Maps a URL property to a string or null
   */
  url: (prop: PageObjectResponse["properties"][string]): string | null => {
    if (prop.type !== "url") {
      throw createValidationError("Invalid property type, expected url");
    }
    const urlProp = prop as unknown as UrlPropertyItemObjectResponse;
    return urlProp.url;
  },
};

/**
 * Maps Notion properties to their corresponding D1 record values
 * with proper type checking and error handling.
 */
export const mapNotionProperties = async (page: PageObjectResponse) => {
  try {
    const props = page.properties;

    // Validate required fields first
    const title = PropertyMappers.title(props.Title);
    const category = PropertyMappers.select(props.Category);
    const author = PropertyMappers.people(props.Author);

    // Fetch full content for excerpt and AI processing
    const content = await fetchPageContent(page.id);
    if (!content) {
      throw createValidationError("Failed to fetch page content");
    }

    // Generate excerpt from full content
    const excerpt = generateExcerpt(content);

    // Process text-based AI fields first
    const [summaryResult, tagsResult, readingTimeResult] = await Promise.all([
      generatePostSummary(content),
      generatePostTags(content),
      estimateReadingTime(content),
    ]);

    // === D1PostMetadata === (Direct from Notion)
    const metadata = {
      id: page.id,
      title,
      created_at: new Date(page.created_time).toISOString(),
      updated_at: new Date().toISOString(),
      notion_last_edited_at: new Date(page.last_edited_time).toISOString(),
      category,
      author,
      notion_url: page.url,
      excerpt,
    };

    // === D1PostExtended === (AI-processed fields)
    const extended = {
      summary: summaryResult.data?.summary || null,
      mins_read: readingTimeResult.data?.mins_read || null,
      tags: tagsResult.data?.tags || null,
      image_url: null,
      r2_image_url: null,
      image_task_id: null,
    };

    // Create initial post without image
    const post = {
      ...metadata,
      ...extended,
    };

    // Now that we have the summary and other text content, generate the image
    const imageResult = await generateImage(post);

    // Return the final post with image task ID if successful
    return {
      ...post,
      image_task_id: imageResult.data?.task_id || null,
    };
  } catch (error) {
    logger.error("Failed to map Notion properties", {
      pageId: page.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
};
