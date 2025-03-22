# Notion D1 Worker

A high-performance content sync system that automatically synchronizes content from Notion to Cloudflare D1, enabling you to use Notion as a CMS while leveraging Cloudflare's edge database for content delivery. Features AI-powered content enhancement including automatic summarization, tag generation, and technical illustrations.

## What This Project Does

This project creates a bridge between Notion and Cloudflare D1, allowing you to:

1. Use Notion as your Content Management System (CMS)
2. Automatically sync content to Cloudflare's edge database (D1)
3. Serve content globally with ultra-low latency
4. Stay within Cloudflare's free tier limits
5. Generate AI-powered content enhancements:

   - Automatic content summarization
   - SEO-optimized tag generation
   - Reading time estimation
   - Technical illustrations (stored in Cloudflare R2)

6. Maintain content integrity through:
   - Automated schema validation of Notion properties
   - Batch processing (100 posts/day) within free tier limits
   - Atomic updates to prevent partial sync failures

## Tech Stack

- **Runtime**: [Bun](https://bun.sh) - A fast all-in-one JavaScript runtime
- **Infrastructure**:
  - [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless edge computing
  - [Cloudflare D1](https://developers.cloudflare.com/d1/) - SQLite at the edge
  - [Cloudflare R2](https://developers.cloudflare.com/r2/) - Object storage for generated images
- **API Integration**:
  - [Notion API](https://developers.notion.com/) - Content management
  - [Deepseek](https://deepseek.com) - AI text generation
  - [DashScope](https://dashscope.aliyun.com) - AI image generation
- **Language & Type Safety**:
  - [TypeScript](https://www.typescriptlang.org/) - Type-safe development
- **Testing**:
  - Integration tests using Bun's test runner

## How It Works

1. **Content Creation**: Authors create and manage content in Notion
2. **Automated Sync**: The worker runs daily (configurable) to:
   - Fetch published content from Notion
   - Transform content to D1-compatible format
   - Sync to Cloudflare D1 database
   - Generate AI-powered enhancements:
     - Summaries
     - SEO tags
     - Reading time estimates
     - Technical illustrations (stored in R2)
3. **Content Delivery**: Content is served from Cloudflare's edge network

## Workflow & Architecture

The system follows a straightforward sync workflow:

```mermaid
sequenceDiagram
    participant Author
    participant Notion
    participant Worker
    participant D1
    participant R2
    participant Client

    %% Content Creation
    Author->>Notion: Create/Update Content

    %% Sync Process
    rect rgb(200, 220, 240)
        Worker->>Notion: Fetch Pages
        Notion-->>Worker: Return Pages
        Worker->>Worker: Transform + AI Processing
        Worker->>D1: Upsert Posts
        Worker->>R2: Store Generated Images
    end

    %% Content Delivery
    Client->>Worker: Request
    Worker->>D1: Query
    D1-->>Worker: Data
    Worker->>R2: Images
    R2-->>Worker: Files
    Worker-->>Client: Response
```

## Prerequisites

Before you begin, ensure you have:

1. A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is sufficient)
2. A [Notion account](https://www.notion.so/) with a root page for content
3. [Bun](https://bun.sh) installed on your machine
4. API keys for AI services:
   - [Deepseek API](https://deepseek.com) for text generation
   - [DashScope API](https://dashscope.aliyun.com) for image generation

## Get Start

1. **Clone and Install**

   ```bash
   git clone https://github.com/tonglam/notion-d1-worker.git
   cd notion-d1-worker
   bun install
   ```

2. **Set Up Notion Integration**

   - Go to [Notion Integrations](https://www.notion.so/my-integrations)
   - Create a new integration
   - Copy the integration token
   - Share your root page with the integration
   - Copy your root page ID from the page URL

3. **Configure Environment**

   ```bash
   cp .env.example .env
   cp .dev.vars.example .dev.vars
   ```

   Required Keys:

   ```env
   # In .dev.vars (local development)
   NOTION_TOKEN=your_notion_integration_token
   NOTION_ROOT_PAGE_ID=your_notion_root_page_id
   DASHSCOPE_API_KEY=your_dashscope_api_key
   DEEPSEEK_API_KEY=your_deepseek_api_key

   # In .env (deployment)
   CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
   CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
   ```

4. **Set Up Cloudflare**

   ```bash
   # Configure production secrets
   wrangler secret put NOTION_TOKEN
   wrangler secret put NOTION_ROOT_PAGE_ID
   wrangler secret put DASHSCOPE_API_KEY
   wrangler secret put DEEPSEEK_API_KEY

   # Create D1 database
   wrangler d1 create notion-posts

   # Initialize database schema
   wrangler d1 execute notion-posts --file=./db/schema.sql
   ```

5. **Development & Deployment**

   ```bash
   # Run locally
   bun run dev

   # Deploy to Cloudflare
   bun run deploy

   # Run tests
   bun test
   ```

## Project Structure

```
notion-d1-worker/
├── src/               # Source code
│   ├── index.ts      # Entry point
│   ├── services/     # Core services
│   │   ├── notion.ts # Notion integration
│   │   ├── d1.ts     # D1 database operations
│   │   ├── r2.ts     # R2 image storage operations
│   │   ├── sync.ts   # Sync orchestration
│   │   ├── ai.ts    # AI service integration
│   │   └── ai/      # AI-specific modules
│   ├── types.ts      # Type definitions
│   └── utils/        # Utility functions
├── db/               # Database files
│   └── schema.sql    # D1 schema
├── test/             # Integration tests
└── documentation/    # Project documentation
```

## AI Features

The project includes several AI-powered enhancements:

1. **Content Summarization**

   - Automatically generates concise summaries of articles
   - Uses Deepseek's advanced language model
   - Optimized for technical content

2. **Tag Generation**

   - Extracts relevant keywords and keyphrases
   - SEO-optimized tag suggestions
   - Configurable number of tags

3. **Technical Illustrations**
   - Generates professional technical diagrams
   - Clean, minimalist style
   - Text-free visual representations

## Image Handling

- Generated illustrations stored in Cloudflare R2
- Two image URLs preserved:
  1. Original image URL from Notion
  2. R2-optimized version (webp format)
- Image generation workflow:
  1. Create task via DashScope
  2. Check status daily at 6:00 AM UTC
  3. Store successful results in R2
  4. Retry failed tasks automatically

## License

MIT
