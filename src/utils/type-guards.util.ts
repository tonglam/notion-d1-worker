import type {
  MultiSelectPropertyItemObjectResponse,
  NumberPropertyItemObjectResponse,
  PeoplePropertyItemObjectResponse,
  RichTextPropertyItemObjectResponse,
  SelectPropertyItemObjectResponse,
  TitlePropertyItemObjectResponse,
  UrlPropertyItemObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { createValidationError } from "./errors.util";

/**
 * Type guard for title property
 * @param prop - Property to check
 * @returns Title property
 * @throws {ValidationError} If property is not a title
 */
export const getTitle = (prop: unknown): TitlePropertyItemObjectResponse => {
  if (
    typeof prop === "object" &&
    prop &&
    "type" in prop &&
    prop.type === "title"
  ) {
    return prop as TitlePropertyItemObjectResponse;
  }
  throw createValidationError("Property must be a title");
};

/**
 * Type guard for select property
 * @param prop - Property to check
 * @returns Select property
 * @throws {ValidationError} If property is not a select
 */
export const getSelect = (prop: unknown): SelectPropertyItemObjectResponse => {
  if (
    typeof prop === "object" &&
    prop &&
    "type" in prop &&
    prop.type === "select"
  ) {
    return prop as SelectPropertyItemObjectResponse;
  }
  throw createValidationError("Property must be a select");
};

/**
 * Type guard for multi-select property
 * @param prop - Property to check
 * @returns Multi-select property
 * @throws {ValidationError} If property is not a multi-select
 */
export const getMultiSelect = (
  prop: unknown
): MultiSelectPropertyItemObjectResponse => {
  if (
    typeof prop === "object" &&
    prop &&
    "type" in prop &&
    prop.type === "multi_select"
  ) {
    return prop as MultiSelectPropertyItemObjectResponse;
  }
  throw createValidationError("Property must be a multi-select");
};

/**
 * Type guard for people property
 * @param prop - Property to check
 * @returns People property
 * @throws {ValidationError} If property is not a people
 */
export const getPeople = (prop: unknown): PeoplePropertyItemObjectResponse => {
  if (
    typeof prop === "object" &&
    prop &&
    "type" in prop &&
    prop.type === "people"
  ) {
    return prop as PeoplePropertyItemObjectResponse;
  }
  throw createValidationError("Property must be a people");
};

/**
 * Type guard for rich text property
 * @param prop - Property to check
 * @returns Rich text property
 * @throws {ValidationError} If property is not a rich text
 */
export const getRichText = (
  prop: unknown
): RichTextPropertyItemObjectResponse => {
  if (
    typeof prop === "object" &&
    prop &&
    "type" in prop &&
    prop.type === "rich_text"
  ) {
    return prop as RichTextPropertyItemObjectResponse;
  }
  throw createValidationError("Property must be a rich text");
};

/**
 * Type guard for number property
 * @param prop - Property to check
 * @returns Number property
 * @throws {ValidationError} If property is not a number
 */
export const getNumber = (prop: unknown): NumberPropertyItemObjectResponse => {
  if (
    typeof prop === "object" &&
    prop &&
    "type" in prop &&
    prop.type === "number"
  ) {
    return prop as NumberPropertyItemObjectResponse;
  }
  throw createValidationError("Property must be a number");
};

/**
 * Type guard for URL property
 * @param prop - Property to check
 * @returns URL property
 * @throws {ValidationError} If property is not a URL
 */
export const getUrl = (prop: unknown): UrlPropertyItemObjectResponse => {
  if (
    typeof prop === "object" &&
    prop &&
    "type" in prop &&
    prop.type === "url"
  ) {
    return prop as UrlPropertyItemObjectResponse;
  }
  throw createValidationError("Property must be a URL");
};
