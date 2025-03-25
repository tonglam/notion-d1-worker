/// <reference types="bun-types" />

import type { D1Database } from "@cloudflare/workers-types";
import { resolve } from "node:path";
import { initializeDb } from "../src/services/db.service";
import { syncWorkflow } from "../src/workflows/sync.workflow";

// Set up environment variables from .dev.vars
const devVarsPath = resolve(process.cwd(), ".dev.vars");
const devVars = await Bun.file(devVarsPath).text();
const envVars = Object.fromEntries(
  devVars
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("="))
);

// Set up global variables
globalThis.NOTION_TOKEN = envVars.NOTION_TOKEN;
globalThis.NOTION_ROOT_PAGE_ID = envVars.NOTION_ROOT_PAGE_ID;

// Initialize local SQLite database
const db = new (await import("bun:sqlite")).Database(":memory:");

// Apply schema
db.run(`
  -- Create posts table with new schema
  CREATE TABLE posts (
    -- Core fields
    id TEXT PRIMARY KEY,           -- Notion page ID
    title TEXT NOT NULL,          -- Post title
    
    -- Timestamps
    created_at DATETIME NOT NULL, -- Creation time
    updated_at DATETIME NOT NULL, -- Last update time in D1
    notion_last_edited_at DATETIME NOT NULL, -- Last edit time in Notion
    
    -- Metadata
    category TEXT NOT NULL,       -- Post category
    author TEXT NOT NULL,         -- Post author name
    notion_url TEXT NOT NULL,     -- Original Notion page URL
    
    -- Extended data (nullable)
    excerpt TEXT,                 -- Short excerpt
    summary TEXT,                 -- Longer summary
    mins_read INTEGER,            -- Estimated reading time
    image_url TEXT,              -- Original image URL from Notion
    tags TEXT,                    -- Comma-separated tags
    r2_image_url TEXT,           -- Image URL after R2 upload
    image_task_id TEXT           -- DashScope image generation task ID
  );

  -- Create indexes for common queries
  CREATE INDEX idx_posts_updated_at ON posts(updated_at);
  CREATE INDEX idx_posts_notion_last_edited_at ON posts(notion_last_edited_at);
  CREATE INDEX idx_posts_category ON posts(category);
  CREATE INDEX idx_posts_author ON posts(author);
`);

// Create a D1-compatible database interface
const d1db = {
  prepare: (query: string) => {
    const stmt = db.prepare(query);
    return {
      bind: (...params: any[]) => {
        stmt.run(...params);
        return stmt;
      },
      all: async () => ({ results: stmt.all(), success: true, meta: {} }),
      run: async () => ({ success: true, meta: {} }),
      first: async () => stmt.get(),
      raw: async () => [Object.keys(stmt.get() || {}), ...stmt.values()],
    };
  },
  batch: async (_: any[]) => [],
  dump: () => Promise.resolve(new ArrayBuffer(0)),
  exec: async (query: string) => {
    db.run(query);
    return { count: 0, duration: 0 };
  },
} as unknown as D1Database;

// Initialize the database service
initializeDb(d1db);

// Run the sync workflow
console.log("Starting sync workflow...");
console.log("Using root page ID:", globalThis.NOTION_ROOT_PAGE_ID);

try {
  const result = await syncWorkflow();
  console.log("Sync workflow completed successfully");
  console.log("Result:", JSON.stringify(result, null, 2));
} catch (error) {
  console.error("Sync workflow failed:", error);
  process.exit(1);
}
