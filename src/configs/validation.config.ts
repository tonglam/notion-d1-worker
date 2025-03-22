import type { PropertyTypeValidation } from "../types";

/** Required properties for Notion pages */
export const REQUIRED_PROPERTIES = [
  "Title",
  "Category",
  "Tags",
  "Author",
  "Content Key",
] as const;

/** Validation rules for each property */
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
