export interface R2ImageMetadata {
  contentType: string;
  size: number;
  etag: string;
  uploaded: string;
}

export interface R2ImageUploadResult {
  success: boolean;
  url: string | null;
  error?: string;
  metadata?: R2ImageMetadata;
}

export interface R2Config {
  bucketName: string;
  publicUrl: string;
  allowedMimeTypes: readonly string[];
  maxSizeBytes: number;
}
