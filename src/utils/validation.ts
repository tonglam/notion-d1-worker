import type {
  PageObjectResponse,
  PartialUserObjectResponse,
  RichTextItemResponse,
  UserObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { REQUIRED_PROPERTIES } from "../constants";
import type { NotionPage, NotionPerson, NotionRichText } from "../types";
import { createValidationError } from "./errors";

const validateRequiredProperties = (
  properties: Record<string, unknown>
): void => {
  const missingProps = REQUIRED_PROPERTIES.filter(
    (prop) => !(prop in properties)
  );
  if (missingProps.length > 0) {
    throw createValidationError(
      `Missing required properties: ${missingProps.join(", ")}`
    );
  }
};

const mapRichText = (richText: RichTextItemResponse[]): NotionRichText[] =>
  richText.map((t) => ({
    plain_text: t.plain_text,
    href: t.href,
    annotations: t.annotations,
  }));

const mapUser = (
  user: UserObjectResponse | PartialUserObjectResponse
): NotionPerson => ({
  id: user.id,
  name: "name" in user ? user.name : null,
  avatar_url: "avatar_url" in user ? user.avatar_url : null,
  email: "email" in user && typeof user.email === "string" ? user.email : null,
});

const transformProperties = (
  props: PageObjectResponse["properties"]
): NotionPage["properties"] => {
  // Type guards to ensure properties exist and are of correct type
  if (!("Title" in props && props.Title.type === "title")) {
    throw createValidationError("Invalid Title property type");
  }
  if (!("Slug" in props && props.Slug.type === "rich_text")) {
    throw createValidationError("Invalid Slug property type");
  }
  if (!("Published" in props && props.Published.type === "checkbox")) {
    throw createValidationError("Invalid Published property type");
  }
  if (!("Category" in props && props.Category.type === "select")) {
    throw createValidationError("Invalid Category property type");
  }
  if (!("Tags" in props && props.Tags.type === "multi_select")) {
    throw createValidationError("Invalid Tags property type");
  }
  if (!("Author" in props && props.Author.type === "people")) {
    throw createValidationError("Invalid Author property type");
  }
  if (!("Content Key" in props && props["Content Key"].type === "rich_text")) {
    throw createValidationError("Invalid Content Key property type");
  }

  return {
    Title: {
      title: props.Title.title.map((t) => ({
        plain_text: t.plain_text,
      })),
    },
    Slug: {
      rich_text: props.Slug.rich_text.map((t) => ({
        plain_text: t.plain_text,
      })),
    },
    Published: {
      checkbox: props.Published.checkbox,
    },
    Category: {
      select: props.Category.select
        ? { name: props.Category.select.name }
        : null,
    },
    Tags: {
      multi_select: props.Tags.multi_select.map((t) => ({
        name: t.name,
      })),
    },
    Author: {
      people: props.Author.people.map(mapUser),
    },
    Excerpt:
      props.Excerpt?.type === "rich_text"
        ? { rich_text: mapRichText(props.Excerpt.rich_text) }
        : { rich_text: [] },
    Summary:
      props.Summary?.type === "rich_text"
        ? { rich_text: mapRichText(props.Summary.rich_text) }
        : { rich_text: [] },
    "Mins Read":
      props["Mins Read"]?.type === "number"
        ? { number: props["Mins Read"].number }
        : { number: null },
    "Image URL":
      props["Image URL"]?.type === "url"
        ? { url: props["Image URL"].url }
        : { url: null },
    "Content Key": {
      rich_text: mapRichText(props["Content Key"].rich_text),
    },
  };
};

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
