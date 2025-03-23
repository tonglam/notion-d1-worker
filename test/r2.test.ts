import { Server } from "bun";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  initializeR2Bucket,
  uploadImageFromUrl,
} from "../src/services/r2.service";
import { createTestR2Bucket } from "./fixtures/r2.fixture";

describe("R2 Service Integration Tests", () => {
  let testServer: Server;

  beforeAll(async () => {
    // Initialize the test R2 bucket
    initializeR2Bucket(createTestR2Bucket());

    // Set up a test server to serve test images
    testServer = Bun.serve({
      port: 3000,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/test-image.jpg") {
          return new Response(
            new Blob([new Uint8Array(100)], { type: "image/jpeg" }),
            {
              headers: {
                "content-type": "image/jpeg",
                "content-length": "100",
              },
            }
          );
        }
        if (url.pathname === "/large-image.jpg") {
          // Create a 12MB image (exceeds 10MB limit)
          return new Response(
            new Blob([new Uint8Array(12 * 1024 * 1024)], {
              type: "image/jpeg",
            }),
            {
              headers: {
                "content-type": "image/jpeg",
                "content-length": (12 * 1024 * 1024).toString(),
              },
            }
          );
        }
        if (url.pathname === "/invalid-type.txt") {
          return new Response("Not an image", {
            headers: {
              "content-type": "text/plain",
              "content-length": "11",
            },
          });
        }
        return new Response("Not found", { status: 404 });
      },
    });
  });

  afterAll(() => {
    testServer.stop();
  });

  test("should upload image successfully", async () => {
    const result = await uploadImageFromUrl(
      "http://localhost:3000/test-image.jpg",
      "test_image.jpg"
    );

    expect(result.success).toBe(true);
    expect(result.url).toBeDefined();
    expect(result.metadata).toBeDefined();
    expect(result.metadata?.contentType).toBe("image/jpeg");
    expect(result.metadata?.size).toBe(100);
  });

  test("should fail for too large images", async () => {
    const result = await uploadImageFromUrl(
      "http://localhost:3000/large-image.jpg",
      "large_image.jpg"
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("File size exceeds maximum allowed size");
  });

  test("should fail for invalid mime types", async () => {
    const result = await uploadImageFromUrl(
      "http://localhost:3000/invalid-type.txt",
      "invalid.txt"
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid MIME type");
  });

  test("should fail for non-existent images", async () => {
    const result = await uploadImageFromUrl(
      "http://localhost:3000/not-found.jpg",
      "not_found.jpg"
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("HTTP error! status: 404");
  });
});
