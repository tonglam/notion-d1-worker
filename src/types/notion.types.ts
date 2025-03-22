import type {
  PartialUserObjectResponse,
  RichTextItemResponse,
  UserObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";

// Notion Base Types
export interface NotionRichText {
  plain_text: string;
  href: string | null;
  annotations: NotionAnnotations;
}

export interface NotionAnnotations {
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  underline: boolean;
  code: boolean;
  color: string;
}

export interface NotionTitle {
  title: Array<{
    plain_text: string;
    href: string | null;
  }>;
}

export interface NotionPerson {
  id: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
}

// Notion Page Types
export interface NotionPageProperties {
  Title: {
    title: Array<{
      plain_text: string;
    }>;
  };
  Category: {
    select: {
      name: string;
    } | null;
  };
  Tags: {
    multi_select: Array<{
      name: string;
    }>;
  };
  Author: {
    people: Array<NotionPerson>;
  };
  Excerpt: {
    rich_text: Array<NotionRichText>;
  };
  Summary: {
    rich_text: Array<NotionRichText>;
  };
  "Mins Read": {
    number: number | null;
  };
  "Image URL": {
    url: string | null;
  };
  "Content Key": {
    rich_text: Array<NotionRichText>;
  };
  Parent: {
    relation: Array<{ id: string }>;
  };
  "MIT Parent": {
    relation: Array<{ id: string }>;
  };
  "Child Pages": {
    relation: Array<{ id: string }>;
  };
}

export interface NotionPage {
  id: string;
  created_time: string;
  last_edited_time: string;
  url: string;
  properties: NotionPageProperties;
}

// Notion Property Types
export const PROPERTY_TYPE_MAP = {
  Title: "title",
  Category: "select",
  Tags: "multi_select",
  Author: "people",
  "Content Key": "rich_text",
  Excerpt: "rich_text",
  Summary: "rich_text",
  "Mins Read": "number",
  "Image URL": "url",
  Parent: "relation",
  "MIT Parent": "relation",
  "Child Pages": "relation",
} as const;

export type NotionPropertyType =
  (typeof PROPERTY_TYPE_MAP)[keyof typeof PROPERTY_TYPE_MAP];
export type ValidPropertyKey = keyof typeof PROPERTY_TYPE_MAP;

// Notion Utility Types
export type UserMapper = (
  user: UserObjectResponse | PartialUserObjectResponse
) => NotionPerson;

export type RichTextMapper = (item: RichTextItemResponse) => NotionRichText;
