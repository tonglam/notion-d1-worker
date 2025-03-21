-- Posts table schema for Notion D1 Worker
-- This schema defines the structure for storing Notion posts in D1

-- Drop existing table if needed (commented out for safety)
-- DROP TABLE IF EXISTS posts;

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
  -- Core fields
  id TEXT PRIMARY KEY,           -- Notion page ID
  title TEXT NOT NULL,          -- Post title
  slug TEXT UNIQUE NOT NULL,    -- URL-friendly identifier
  
  -- Timestamps
  created_at DATETIME NOT NULL, -- Creation time
  updated_at DATETIME NOT NULL, -- Last update time
  
  -- Status
  published BOOLEAN NOT NULL DEFAULT 0, -- Publication status
  
  -- Metadata (stored as JSON)
  category JSON NOT NULL,       -- Single category
  tags JSON NOT NULL,           -- Array of tags
  author JSON NOT NULL,         -- Array of authors
  
  -- Optional content fields
  excerpt TEXT,                 -- Short excerpt
  summary TEXT,                 -- Longer summary
  mins_read INTEGER,            -- Estimated reading time
  image_url TEXT,              -- Featured image URL
  
  -- References
  notion_url TEXT NOT NULL,     -- Original Notion page URL
  content_key TEXT NOT NULL     -- Cache key for content
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published);
CREATE INDEX IF NOT EXISTS idx_posts_updated_at ON posts(updated_at);

-- Helpful queries for maintenance:

-- Count total posts
-- SELECT COUNT(*) FROM posts;

-- Count published posts
-- SELECT COUNT(*) FROM posts WHERE published = 1;

-- Get latest posts
-- SELECT title, updated_at FROM posts ORDER BY updated_at DESC LIMIT 5;

-- Find duplicate slugs (should be none due to UNIQUE constraint)
-- SELECT slug, COUNT(*) as count FROM posts GROUP BY slug HAVING count > 1; 