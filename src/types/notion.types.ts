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
/**
 * Simplified Notion page interface
 */
export interface NotionPage {
  id: string;
  created_time: string;
  last_edited_time: string;
  url: string;
  properties: {
    title: {
      type: "title";
      title: Array<{
        plain_text: string;
      }>;
    };
    category?: {
      type: "select";
      select: {
        name: string;
      } | null;
    };
    author?: {
      type: "people";
      people: Array<{
        name: string | null;
      }>;
    };
    parent?: {
      type: "relation";
      relation: Array<{
        id: string;
      }>;
    };
    mit_parent?: {
      type: "relation";
      relation: Array<{
        id: string;
      }>;
    };
    child_pages?: {
      type: "relation";
      relation: Array<{
        id: string;
      }>;
    };
  };
}

// Notion Property Types
export const PROPERTY_TYPE_MAP = {
  title: "title",
  category: "select",
  author: "people",
  parent: "relation",
  mit_parent: "relation",
  child_pages: "relation",
} as const;

export type NotionPropertyType =
  (typeof PROPERTY_TYPE_MAP)[keyof typeof PROPERTY_TYPE_MAP];
export type ValidPropertyKey = keyof typeof PROPERTY_TYPE_MAP;

// Notion Utility Types
export type UserMapper = (
  user: UserObjectResponse | PartialUserObjectResponse
) => NotionPerson;

export type RichTextMapper = (item: RichTextItemResponse) => NotionRichText;
