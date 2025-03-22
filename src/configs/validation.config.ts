export const REQUIRED_PROPERTIES = [
  "Title",
  "Category",
  "Tags",
  "Author",
  "Content Key",
] as const;

export type RequiredProperty = (typeof REQUIRED_PROPERTIES)[number];

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
} as const;

export type PropertyType =
  (typeof PROPERTY_TYPE_MAP)[keyof typeof PROPERTY_TYPE_MAP];

export interface PropertyTypeValidation {
  property: keyof typeof PROPERTY_TYPE_MAP;
  type: PropertyType;
  required: boolean;
}

export const PROPERTY_VALIDATIONS: PropertyTypeValidation[] = [
  { property: "Title", type: "title", required: true },
  { property: "Category", type: "select", required: true },
  { property: "Tags", type: "multi_select", required: true },
  { property: "Author", type: "people", required: true },
  { property: "Content Key", type: "rich_text", required: true },
  { property: "Excerpt", type: "rich_text", required: false },
  { property: "Summary", type: "rich_text", required: false },
  { property: "Mins Read", type: "number", required: false },
  { property: "Image URL", type: "url", required: false },
];
