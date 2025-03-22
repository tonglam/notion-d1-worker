import type { R2Config } from "../types/r2.types";

export const R2_CONFIG: R2Config = {
  bucketName: "image-bucket",
  publicUrl: "https://pub-d8dffa084afd41feb7c476a46103017d.r2.dev/",
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] as const,
  maxSizeBytes: 10 * 1024 * 1024, // 10MB - Cloudflare R2 free tier limit per object
} as const;

export const R2_ERROR_MESSAGES = {
  BUCKET_NOT_INITIALIZED: "R2 bucket is not initialized",
  INVALID_MIME_TYPE: "Invalid MIME type for image upload",
  FILE_TOO_LARGE: "File size exceeds maximum allowed size",
  FETCH_FAILED: "Failed to fetch image from URL",
  UPLOAD_FAILED: "Failed to upload image to R2",
} as const;
