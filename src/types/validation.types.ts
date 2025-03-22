import { REQUIRED_PROPERTIES } from "../configs/constants.config";
import type { NotionPropertyType, ValidPropertyKey } from "./notion.types";

// Validation Types
export type RequiredPropertyKey = (typeof REQUIRED_PROPERTIES)[number];

export interface PropertyTypeValidation {
  property: ValidPropertyKey;
  type: NotionPropertyType;
  required: boolean;
}

export interface PropertyValidationResult {
  isValid: boolean;
  errors: string[];
}
