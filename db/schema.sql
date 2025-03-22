-- Posts table schema for Notion D1 Worker
-- This schema defines the structure for storing Notion posts in D1

-- Drop existing table if exists
DROP TABLE IF EXISTS posts;

-- Create posts table with new schema
CREATE TABLE posts (
  -- Metadata fields (NOT NULL)
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  notion_last_edited_at TEXT NOT NULL,
  category TEXT NOT NULL,
  author TEXT NOT NULL,
  notion_url TEXT NOT NULL,

  -- Extended data fields (nullable)
  excerpt TEXT,
  summary TEXT,
  mins_read INTEGER,
  image_url TEXT,
  tags TEXT,
  r2_image_url TEXT
);

-- Create indexes for common queries
CREATE INDEX idx_posts_category ON posts(category);
CREATE INDEX idx_posts_author ON posts(author);
CREATE INDEX idx_posts_created_at ON posts(created_at);
-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
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
  excerpt TEXT,                 -- Short excerpt
  summary TEXT,                 -- Longer summary
  mins_read INTEGER,            -- Estimated reading time
  image_url TEXT,              -- Original image URL from Notion
  notion_url TEXT NOT NULL,     -- Original Notion page URL
  
  -- Extended data
  tags TEXT,                    -- Comma-separated tags
  r2_image_url TEXT            -- Image URL after R2 upload
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_posts_updated_at ON posts(updated_at);
CREATE INDEX IF NOT EXISTS idx_posts_notion_last_edited_at ON posts(notion_last_edited_at);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author);

-- Helpful queries for maintenance:

-- Count total posts
-- SELECT COUNT(*) FROM posts;

-- Get latest posts
-- SELECT title, updated_at FROM posts ORDER BY updated_at DESC LIMIT 5;

-- Get posts by category
-- SELECT * FROM posts WHERE category = 'Technology';

-- Get posts by author
-- SELECT * FROM posts WHERE author = 'John Doe';

-- Get posts with extended data
-- SELECT m.*, e.* 
-- FROM post_metadata m 
-- LEFT JOIN post_extended e ON m.id = e.post_id; 