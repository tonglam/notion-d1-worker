import type {
  MultiSelectPropertyItemObjectResponse,
  NumberPropertyItemObjectResponse,
  PeoplePropertyItemObjectResponse,
  RelationPropertyItemObjectResponse,
  RichTextPropertyItemObjectResponse,
  SelectPropertyItemObjectResponse,
  TitlePropertyItemObjectResponse,
  UrlPropertyItemObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { createValidationError } from "./errors.util";

// Base type guard helper
const isNotionProperty = (
  prop: unknown,
  type: string
): prop is Record<string, unknown> => {
  return (
    typeof prop === "object" &&
    prop !== null &&
    "type" in prop &&
    prop.type === type
  );
};

// Property Type Guards
/**
 * Type guard for title property
 */
export const getTitle = (prop: unknown): TitlePropertyItemObjectResponse => {
  if (isNotionProperty(prop, "title")) {
    return prop as TitlePropertyItemObjectResponse;
  }
  throw createValidationError("Property must be a title");
};

/**
 * Type guard for select property
 */
export const getSelect = (prop: unknown): SelectPropertyItemObjectResponse => {
  if (isNotionProperty(prop, "select")) {
    return prop as SelectPropertyItemObjectResponse;
  }
  throw createValidationError("Property must be a select");
};

/**
 * Type guard for multi-select property
 */
export const getMultiSelect = (
  prop: unknown
): MultiSelectPropertyItemObjectResponse => {
  if (isNotionProperty(prop, "multi_select")) {
    return prop as MultiSelectPropertyItemObjectResponse;
  }
  throw createValidationError("Property must be a multi-select");
};

/**
 * Type guard for people property
 */
export const getPeople = (prop: unknown): PeoplePropertyItemObjectResponse => {
  if (isNotionProperty(prop, "people")) {
    return prop as PeoplePropertyItemObjectResponse;
  }
  throw createValidationError("Property must be a people");
};

/**
 * Type guard for rich text property
 */
export const getRichText = (
  prop: unknown
): RichTextPropertyItemObjectResponse => {
  if (isNotionProperty(prop, "rich_text")) {
    return prop as RichTextPropertyItemObjectResponse;
  }
  throw createValidationError("Property must be a rich text");
};

/**
 * Type guard for number property
 */
export const getNumber = (prop: unknown): NumberPropertyItemObjectResponse => {
  if (isNotionProperty(prop, "number")) {
    return prop as NumberPropertyItemObjectResponse;
  }
  throw createValidationError("Property must be a number");
};

/**
 * Type guard for URL property
 */
export const getUrl = (prop: unknown): UrlPropertyItemObjectResponse => {
  if (isNotionProperty(prop, "url")) {
    return prop as UrlPropertyItemObjectResponse;
  }
  throw createValidationError("Property must be a URL");
};

/**
 * Type guard for relation property
 */
export const getRelation = (
  prop: unknown
): RelationPropertyItemObjectResponse => {
  if (isNotionProperty(prop, "relation")) {
    return prop as RelationPropertyItemObjectResponse;
  }
  throw createValidationError("Property must be a relation");
};
