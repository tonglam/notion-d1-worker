/// <reference types="@cloudflare/workers-types" />

declare global {
  // Required Variables
  var NOTION_TOKEN: string;
  var NOTION_ROOT_PAGE_ID: string;
  var DASHSCOPE_API_KEY: string;
  var DEEPSEEK_API_KEY: string;

  // Bindings from wrangler.toml
  var DB: D1Database;
  var IMAGE_BUCKET: R2Bucket;
}

export {};
