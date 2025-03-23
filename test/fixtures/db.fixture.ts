import {
  D1Database,
  D1ExecResult,
  D1PreparedStatement,
} from "@cloudflare/workers-types";
import { Database, SQLQueryBindings } from "bun:sqlite";
import { initializeDb } from "../../src/services/db.service";
import type { D1Post } from "../../src/types/db.types";

/**
 * Sets up a test D1 database with the required schema
 * @returns A cleanup function to be called after tests
 */
export const setupTestDatabase = async (): Promise<() => void> => {
  // Create SQLite database in memory
  const db = new Database(":memory:");

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
      const preparedStatement = {
        bind: (...params: SQLQueryBindings[]) => {
          stmt.run(...params);
          return preparedStatement;
        },
        all: async () => ({ results: stmt.all(), success: true, meta: {} }),
        run: async () => ({ success: true, meta: {} }),
        first: async () => stmt.get(),
        raw: async () => [Object.keys(stmt.get() || {}), ...stmt.values()],
      };
      return preparedStatement;
    },
    batch: async (_: D1PreparedStatement[]) => [],
    dump: () => Promise.resolve(new ArrayBuffer(0)),
    exec: async (query: string): Promise<D1ExecResult> => {
      db.run(query);
      return { count: 0, duration: 0 };
    },
  } as unknown as D1Database;

  // Set up global TEST_DB binding and initialize
  globalThis.TEST_DB = d1db;
  initializeDb(d1db);

  // Return cleanup function
  return () => {
    try {
      db.run("DELETE FROM posts WHERE id LIKE 'test_%'");
    } catch (error) {
      console.error("Failed to clean up test database:", error);
    }
  };
};

/**
 * Creates a test post with default values
 * @param overrides - Optional values to override defaults
 * @returns A test post object
 */
export const createTestPost = (
  overrides: Partial<{
    title: string;
    content: string;
    category: string;
    author: string;
    image_task_id?: string;
  }> = {}
): D1Post => {
  const now = new Date().toISOString();
  const id = `test_${Date.now()}`;

  return {
    id,
    title: overrides.title || "Test Post",
    created_at: now,
    updated_at: now,
    notion_last_edited_at: now,
    category: overrides.category || "test",
    author: overrides.author || "Test Author",
    notion_url: `https://notion.so/${id}`,
    excerpt: null,
    summary: null,
    mins_read: null,
    image_url: null,
    tags: null,
    r2_image_url: null,
    image_task_id: overrides.image_task_id || null,
  };
};
