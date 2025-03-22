import { R2_CONFIG, R2_ERROR_MESSAGES } from "../configs/r2.config";
import type { R2ImageMetadata, R2ImageUploadResult } from "../types/r2.types";
import { createLogger } from "../utils/logger.util";

const logger = createLogger("R2Service");

/** Singleton instance of the R2 bucket */
let bucketInstance: R2Bucket | null = null;

/**
 * Gets or initializes the R2 bucket instance
 * @returns R2 bucket instance
 * @throws Error if bucket is not initialized
 */
const getBucket = (): R2Bucket => {
  if (!bucketInstance) {
    throw new Error(R2_ERROR_MESSAGES.BUCKET_NOT_INITIALIZED);
  }
  return bucketInstance;
};

/**
 * Initializes the R2 bucket instance
 * @param bucket - R2 bucket instance
 */
export const initializeR2Bucket = (bucket: R2Bucket): void => {
  bucketInstance = bucket;
};

/**
 * Validates image metadata before upload
 * @param metadata - Image metadata to validate
 * @throws Error if validation fails
 */
const validateImageMetadata = (metadata: R2ImageMetadata): void => {
  if (!R2_CONFIG.allowedMimeTypes.includes(metadata.contentType)) {
    throw new Error(R2_ERROR_MESSAGES.INVALID_MIME_TYPE);
  }

  if (metadata.size > R2_CONFIG.maxSizeBytes) {
    throw new Error(R2_ERROR_MESSAGES.FILE_TOO_LARGE);
  }
};

/**
 * Uploads an image to R2 from a URL
 * @param imageUrl - URL of the image to upload
 * @param key - Key to store the image under in R2
 * @returns Upload result with success status and URL
 */
export const uploadImageFromUrl = async (
  imageUrl: string,
  key: string
): Promise<R2ImageUploadResult> => {
  try {
    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Get content type and size
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const contentLength = Number(response.headers.get("content-length") || "0");

    // Validate metadata
    const metadata: R2ImageMetadata = {
      contentType,
      size: contentLength,
      etag: "",
      uploaded: new Date().toISOString(),
    };
    validateImageMetadata(metadata);

    // Upload to R2
    const bucket = getBucket();
    const imageBlob = await response.blob();
    const uploadResult = await bucket.put(key, imageBlob, {
      httpMetadata: { contentType },
      customMetadata: { uploaded: metadata.uploaded },
    });

    if (!uploadResult) {
      throw new Error(R2_ERROR_MESSAGES.UPLOAD_FAILED);
    }

    // Construct the public URL
    const publicUrl = R2_CONFIG.publicUrl + key;

    return {
      success: true,
      url: publicUrl,
      metadata: {
        ...metadata,
        etag: uploadResult.etag,
      },
    };
  } catch (error) {
    logger.error("Failed to upload image to R2", error);
    return {
      success: false,
      url: null,
      error:
        error instanceof Error
          ? error.message
          : R2_ERROR_MESSAGES.UPLOAD_FAILED,
    };
  }
};
