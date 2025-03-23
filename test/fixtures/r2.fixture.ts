import {
  R2Bucket,
  R2Checksums,
  R2MultipartUpload,
  R2Object,
  R2ObjectBody,
  R2PutOptions,
} from "@cloudflare/workers-types";

// Create a Map to store our mock R2 objects
const storage = new Map<string, Blob>();

// Helper function to create an R2Object
function createR2Object(key: string, value: Blob): R2Object {
  return {
    key,
    version: "test-version",
    size: value.size,
    etag: "test-etag",
    httpEtag: "test-http-etag",
    checksums: {
      toJSON: () => ({ md5: "test-md5" }),
    } as R2Checksums,
    uploaded: new Date(),
    writeHttpMetadata: (headers: Headers) => {
      headers.set("etag", "test-etag");
    },
    storageClass: "STANDARD",
  };
}

// Helper function to create an R2ObjectBody
function createR2ObjectBody(key: string, value: Blob): R2ObjectBody {
  const obj = createR2Object(key, value);
  return {
    ...obj,
    body: value.stream(),
    bodyUsed: false,
    arrayBuffer: async () => await value.arrayBuffer(),
    text: async () => await value.text(),
    json: async () => JSON.parse(await value.text()),
    blob: async () => value,
    writeHttpMetadata: obj.writeHttpMetadata,
  };
}

// Helper function to create a mock multipart upload
function createMultipartUpload(
  key: string,
  uploadId: string
): R2MultipartUpload {
  return {
    key,
    uploadId,
    async uploadPart() {
      throw new Error("Multipart upload not implemented in test fixture");
    },
    async complete() {
      throw new Error("Multipart upload not implemented in test fixture");
    },
    async abort() {
      throw new Error("Multipart upload not implemented in test fixture");
    },
  };
}

// Create and export the test R2 bucket implementation
export function createTestR2Bucket(): R2Bucket {
  const bucket: R2Bucket = {
    head: async (key: string) => {
      const value = storage.get(key);
      return value ? createR2Object(key, value) : null;
    },
    get: async (key: string) => {
      const value = storage.get(key);
      if (!value) return null;
      return createR2ObjectBody(key, value);
    },
    put: async (
      key: string,
      value:
        | string
        | ArrayBuffer
        | ReadableStream
        | ArrayBufferView
        | Blob
        | null,
      options?: R2PutOptions
    ): Promise<R2Object> => {
      if (value === null) {
        throw new Error("Cannot put null value");
      }

      let storedValue: Blob;
      if (typeof value === "string") {
        storedValue = new Blob([value]);
      } else if (value instanceof ReadableStream) {
        const reader = value.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          chunks.push(chunk);
        }
        storedValue = new Blob(chunks);
      } else if (ArrayBuffer.isView(value)) {
        storedValue = new Blob([value]);
      } else if (value instanceof ArrayBuffer) {
        storedValue = new Blob([value]);
      } else {
        storedValue = value;
      }

      storage.set(key, storedValue);
      return createR2Object(key, storedValue);
    },
    delete: async (keys: string | string[]) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      keysArray.forEach((key) => storage.delete(key));
    },
    list: async () => ({
      objects: Array.from(storage.entries()).map(([key, value]) =>
        createR2Object(key, value)
      ),
      truncated: false,
      cursor: "",
      delimitedPrefixes: [],
    }),
    createMultipartUpload: async (key: string) => {
      return createMultipartUpload(key, "test-upload-id");
    },
    resumeMultipartUpload: (key: string, uploadId: string) => {
      return createMultipartUpload(key, uploadId);
    },
  };
  return bucket;
}
