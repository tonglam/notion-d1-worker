import type {
  PageObjectResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { DEEPSEEK_API_CONFIG } from "../configs/api.config";
import { PROPERTY_VALIDATIONS } from "../configs/validation.config";
import type {
  NotionPage,
  NotionPageProperties,
  RichTextMapper,
  UserMapper,
} from "../types/notion.types";
import { createValidationError } from "./errors.util";
import {
  getMultiSelect,
  getNumber,
  getPeople,
  getRichText,
  getSelect,
  getTitle,
  getUrl,
} from "./type-guards.util";

// Data Mapping Functions
/**
 * Map a rich text item to our internal format
 */
const mapRichTextItem: RichTextMapper = (item) => ({
  plain_text: item.plain_text,
  href: item.href,
  annotations: item.annotations,
});

/**
 * Map a user to our internal format
 */
const mapUser: UserMapper = (user) => ({
  id: user.id,
  name: "name" in user ? user.name : null,
  avatar_url: "avatar_url" in user ? user.avatar_url : null,
  email: "email" in user && typeof user.email === "string" ? user.email : null,
});

// Property Validation Functions
/**
 * Validate required properties in a Notion page
 */
const validateRequiredProperties = (
  properties: PageObjectResponse["properties"]
): void => {
  const missingProps = PROPERTY_VALIDATIONS.filter(
    (validation) => validation.required
  )
    .filter((validation) => !(validation.property in properties))
    .map((validation) => validation.property);

  if (missingProps.length > 0) {
    throw createValidationError(
      `Missing required properties: ${missingProps.join(", ")}`
    );
  }
};

/**
 * Transform Notion properties to our internal format
 */
const transformProperties = (
  props: PageObjectResponse["properties"]
): NotionPageProperties => {
  // Validate property types
  for (const validation of PROPERTY_VALIDATIONS) {
    if (
      validation.property in props &&
      props[validation.property].type !== validation.type
    ) {
      throw createValidationError(
        `Property ${validation.property} must be of type ${validation.type}`
      );
    }
  }

  // Extract and validate properties
  const titleProp = getTitle(props.Title);
  const categoryProp = getSelect(props.Category);
  const tagsProp = getMultiSelect(props.Tags);
  const authorProp = getPeople(props.Author);
  const excerptProp = props.Excerpt ? getRichText(props.Excerpt) : undefined;
  const summaryProp = props.Summary ? getRichText(props.Summary) : undefined;
  const minsReadProp = props["Mins Read"]
    ? getNumber(props["Mins Read"])
    : undefined;
  const imageUrlProp = props["Image URL"]
    ? getUrl(props["Image URL"])
    : undefined;
  const contentKeyProp = getRichText(props["Content Key"]);

  // Transform to internal format
  return {
    Title: {
      title: Array.isArray(titleProp.title)
        ? titleProp.title.map((t) => ({ plain_text: t.plain_text }))
        : [
            {
              plain_text: (titleProp.title as unknown as { plain_text: string })
                .plain_text,
            },
          ],
    },
    Category: {
      select: categoryProp.select ? { name: categoryProp.select.name } : null,
    },
    Tags: {
      multi_select: tagsProp.multi_select.map((t: { name: string }) => ({
        name: t.name,
      })),
    },
    Author: {
      people: Array.isArray(authorProp.people)
        ? authorProp.people.map(mapUser)
        : [mapUser(authorProp.people)],
    },
    Excerpt: excerptProp
      ? {
          rich_text: Array.isArray(excerptProp.rich_text)
            ? excerptProp.rich_text.map(mapRichTextItem)
            : [mapRichTextItem(excerptProp.rich_text as RichTextItemResponse)],
        }
      : { rich_text: [] },
    Summary: summaryProp
      ? {
          rich_text: Array.isArray(summaryProp.rich_text)
            ? summaryProp.rich_text.map(mapRichTextItem)
            : [mapRichTextItem(summaryProp.rich_text as RichTextItemResponse)],
        }
      : { rich_text: [] },
    "Mins Read": minsReadProp
      ? { number: minsReadProp.number }
      : { number: null },
    "Image URL": imageUrlProp ? { url: imageUrlProp.url } : { url: null },
    "Content Key": {
      rich_text: Array.isArray(contentKeyProp.rich_text)
        ? contentKeyProp.rich_text.map(mapRichTextItem)
        : [mapRichTextItem(contentKeyProp.rich_text as RichTextItemResponse)],
    },
    Parent: {
      relation: (props.Parent?.type === "relation"
        ? props.Parent.relation
        : []) as Array<{ id: string }>,
    },
    "MIT Parent": {
      relation: (props["MIT Parent"]?.type === "relation"
        ? props["MIT Parent"].relation
        : []) as Array<{ id: string }>,
    },
    "Child Pages": {
      relation: (props["Child Pages"]?.type === "relation"
        ? props["Child Pages"].relation
        : []) as Array<{ id: string }>,
    },
  };
};

// Public Validation Functions
/**
 * Validate a Notion page
 */
export const validateNotionPage = (page: PageObjectResponse): NotionPage => {
  try {
    validateRequiredProperties(page.properties);

    return {
      id: page.id,
      created_time: page.created_time,
      last_edited_time: page.last_edited_time,
      url: page.url,
      properties: transformProperties(page.properties),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw createValidationError("Failed to validate Notion page", error);
  }
};

/**
 * Validate token limits for AI operations
 */
export const validateTokenLimits = (content: string): void => {
  // Rough estimate: 1 token ≈ 4 characters
  const estimatedTokens = Math.ceil(content.length / 4);

  if (estimatedTokens > DEEPSEEK_API_CONFIG.LIMITS.MAX_INPUT_TOKENS) {
    throw createValidationError(
      `Content exceeds maximum input token limit of ${DEEPSEEK_API_CONFIG.LIMITS.MAX_INPUT_TOKENS} tokens (estimated: ${estimatedTokens} tokens)`
    );
  }
};
