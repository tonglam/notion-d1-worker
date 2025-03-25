import type {
  D1Database,
  D1DatabaseSession,
  D1ExecResult,
  D1Meta,
  D1PreparedStatement,
  D1Result,
} from "@cloudflare/workers-types";
import { Database } from "bun:sqlite";
import type { D1Post } from "../../src/types/db.types";

// Helper type for D1 metadata
type ExtendedD1Meta = D1Meta & Record<string, unknown>;

/**
 * Creates a base D1 metadata object with additional properties
 */
const createD1Meta = (): ExtendedD1Meta => ({
  duration: 0,
  size_after: 0,
  rows_read: 0,
  rows_written: 0,
  last_row_id: 0,
  changed_db: false,
  changes: 0,
  additional_info: {},
});

/**
 * Sets up a test D1 database with the required schema
 * @returns A cleanup function to be called after tests and the database instance
 */
export const setupTestDatabase = async (): Promise<{
  cleanup: () => void;
  db: D1Database;
}> => {
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

  // Create D1Database wrapper
  const d1db: D1Database = {
    prepare: (query: string): D1PreparedStatement => {
      const stmt = db.prepare(query);
      const d1Meta = createD1Meta();

      return {
        first: async <T>(): Promise<D1Result<T>> => ({
          results: [stmt.get() as T],
          success: true,
          meta: d1Meta,
        }),
        run: async <T>(): Promise<D1Result<T>> => ({
          results: [],
          success: true,
          meta: d1Meta,
        }),
        all: async <T>(): Promise<D1Result<T>> => ({
          results: stmt.all() as T[],
          success: true,
          meta: d1Meta,
        }),
        raw: async (): Promise<[string[], ...unknown[]]> => {
          const result = stmt.get();
          return [Object.keys(result || {}), ...stmt.values()];
        },
        bind: (...params: unknown[]): D1PreparedStatement => {
          const boundStmt = db.prepare(query);

          return {
            first: async <T>(): Promise<D1Result<T>> => ({
              results: [boundStmt.get(...(params as any[])) as T],
              success: true,
              meta: d1Meta,
            }),
            run: async <T>(): Promise<D1Result<T>> => {
              boundStmt.run(...(params as any[]));
              return {
                results: [],
                success: true,
                meta: d1Meta,
              };
            },
            all: async <T>(): Promise<D1Result<T>> => ({
              results: boundStmt.all(...(params as any[])) as T[],
              success: true,
              meta: d1Meta,
            }),
            raw: async (): Promise<[string[], ...unknown[]]> => {
              const result = boundStmt.get(...(params as any[]));
              return [Object.keys(result || {}), ...boundStmt.values()];
            },
            bind: (...moreParams: unknown[]): D1PreparedStatement => {
              return d1db.prepare(query).bind(...moreParams);
            },
          };
        },
      };
    },
    batch: async <T>(
      statements: D1PreparedStatement[]
    ): Promise<D1Result<T>[]> => {
      const d1Meta = createD1Meta();
      return statements.map(() => ({
        results: [],
        success: true,
        meta: d1Meta,
      }));
    },
    dump: async () => {
      throw new Error("dump() not implemented in test fixture");
    },
    exec: async (query: string): Promise<D1ExecResult> => {
      db.run(query);
      return {
        count: 1,
        duration: 0,
      };
    },
    withSession: (constraintOrBookmark?: string): D1DatabaseSession => {
      throw new Error("withSession() not implemented in test fixture");
    },
  };

  return {
    cleanup: () => {
      db.close();
    },
    db: d1db,
  };
};

interface TestPostParams {
  title: string;
  category: string;
  author: string;
}

export function createTestPost(params: TestPostParams): D1Post {
  const now = new Date().toISOString();

  return {
    id: `test-post-${Date.now()}`,
    title: params.title,
    created_at: now,
    updated_at: now,
    notion_last_edited_at: now,
    category: params.category,
    author: params.author,
    notion_url: `https://notion.so/test-${Date.now()}`,
    excerpt: "Test excerpt",
    summary: "Test summary",
    mins_read: 5,
    image_url: "https://example.com/test.jpg",
    tags: JSON.stringify(["test", "integration"]),
    r2_image_url: null,
    image_task_id: null,
  };
}
