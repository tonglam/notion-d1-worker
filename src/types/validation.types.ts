import type { NotionPropertyType, ValidPropertyKey } from "./notion.types";

// Validation Types
export interface PropertyTypeValidation {
  property: ValidPropertyKey;
  type: NotionPropertyType;
  required: boolean;
}

export interface PropertyValidationResult {
  isValid: boolean;
  errors: string[];
}
