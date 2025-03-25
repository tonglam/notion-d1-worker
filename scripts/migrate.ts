#!/usr/bin/env bun
import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { execSync } from "child_process";
import { readFileSync } from "node:fs";

const NOTION_DATABASE_ID = "1ab7ef86a5ad81aba4cbf8b8f37ec491";

interface D1Post {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  notion_last_edited_at: string;
  notion_url: string;
  category: string;
  author: string;
  excerpt: string | null;
  summary: string | null;
  mins_read: number | null;
  image_url: string | null;
  tags: string | null;
  r2_image_url: string | null;
  image_task_id: string | null;
}

// Load environment variables from .dev.vars
function loadEnvVars() {
  const envFile = readFileSync(".dev.vars", "utf-8");
  envFile
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .forEach((line) => {
      const [key, value] = line.split("=");
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    });
}

async function fetchNotionDatabasePages(client: Client, databaseId: string) {
  const pages: PageObjectResponse[] = [];
  let hasMore = true;
  let startCursor: string | undefined = undefined;

  while (hasMore) {
    const response = await client.databases.query({
      database_id: databaseId,
      start_cursor: startCursor,
      page_size: 1,
    });

    pages.push(
      ...response.results.filter(
        (page): page is PageObjectResponse => "properties" in page
      )
    );
    hasMore = response.has_more;
    startCursor = response.next_cursor ?? undefined;
  }

  return pages;
}

async function main() {
  try {
    // Load environment variables
    loadEnvVars();

    // Initialize Notion client
    const notionToken = process.env.NOTION_TOKEN;
    if (!notionToken) {
      throw new Error("NOTION_TOKEN environment variable is required");
    }

    const notionClient = new Client({
      auth: notionToken,
      notionVersion: "2022-06-28",
    });

    // Fetch all pages from the Notion database
    console.log("Fetching pages from Notion database...");
    const pages = await fetchNotionDatabasePages(
      notionClient,
      NOTION_DATABASE_ID
    );
    console.log(`Found ${pages.length} pages in database`);

    // Transform and insert pages into D1
    console.log("Inserting pages into D1...");
    for (const page of pages) {
      const properties = page.properties;

      // Debug: Log all property names
      console.log("Available Notion Properties:", Object.keys(properties));

      // Extract properties with proper type checking
      const titleProp = properties.Title;
      const categoryProp = properties.Category;
      const excerptProp = properties.Excerpt;
      const summaryProp = properties.Summary;
      const minsReadProp = properties["Mins Read"];
      const imageUrlProp = properties.Image;
      const tagsProp = properties.Tags;
      const r2ImageUrlProp = properties.R2ImageUrl;
      const dateCreatedProp = properties["Date Created"];

      // Log the properties for verification
      console.log("Notion Properties:", {
        title: titleProp,
        category: categoryProp,
        excerpt: excerptProp,
        summary: summaryProp,
        minsRead: minsReadProp,
        imageUrl: imageUrlProp,
        r2ImageUrl: r2ImageUrlProp,
        tags: tagsProp,
        dateCreated: dateCreatedProp,
      });

      const post: D1Post = {
        id: page.id,
        title:
          titleProp?.type === "title"
            ? titleProp.title.map((t) => t.plain_text).join("") || "Untitled"
            : "Untitled",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notion_last_edited_at:
          dateCreatedProp?.type === "date" && dateCreatedProp.date?.start
            ? new Date(dateCreatedProp.date.start).toISOString()
            : page.created_time,
        notion_url: page.url,
        category:
          categoryProp?.type === "select" && categoryProp.select?.name
            ? categoryProp.select.name
            : "Uncategorized",
        author: "tong", // Hardcoded as per requirement
        excerpt:
          excerptProp?.type === "rich_text"
            ? excerptProp.rich_text.map((t) => t.plain_text).join("")
            : null,
        summary:
          summaryProp?.type === "rich_text"
            ? summaryProp.rich_text.map((t) => t.plain_text).join("")
            : null,
        mins_read: minsReadProp?.type === "number" ? minsReadProp.number : null,
        image_url: imageUrlProp?.type === "url" ? imageUrlProp.url : null,
        tags:
          tagsProp?.type === "multi_select"
            ? tagsProp.multi_select.map((t) => t.name).join(",")
            : null,
        r2_image_url:
          r2ImageUrlProp?.type === "url" ? r2ImageUrlProp.url : null,
        image_task_id: null,
      };

      // Log the mapped post for verification
      console.log("Mapped D1Post:", post);

      const values = [
        post.id,
        post.title,
        post.created_at,
        post.updated_at,
        post.notion_last_edited_at,
        post.category,
        post.author,
        post.notion_url,
        post.excerpt,
        post.summary,
        (post.mins_read ?? 1).toString(),
        post.image_url,
        post.tags,
        post.r2_image_url,
        post.image_task_id,
      ];

      const escapedValues = values.map((value) => {
        if (value === null) return "NULL";
        if (typeof value === "string") {
          return `'${value.replace(/'/g, "''")}'`;
        }
        return value;
      });

      const command = `wrangler d1 execute notion-posts --remote --command "INSERT INTO posts ( id, title, created_at, updated_at, notion_last_edited_at, category, author, notion_url, excerpt, summary, mins_read, image_url, tags, r2_image_url, image_task_id ) VALUES ( ${escapedValues.join(
        ", "
      )} ) ON CONFLICT(id) DO UPDATE SET title = EXCLUDED.title, updated_at = EXCLUDED.updated_at, notion_last_edited_at = EXCLUDED.notion_last_edited_at, category = EXCLUDED.category, author = EXCLUDED.author, notion_url = EXCLUDED.notion_url, excerpt = EXCLUDED.excerpt, summary = EXCLUDED.summary, mins_read = EXCLUDED.mins_read, image_url = EXCLUDED.image_url, tags = EXCLUDED.tags, r2_image_url = EXCLUDED.r2_image_url, image_task_id = EXCLUDED.image_task_id;"`;

      try {
        execSync(command, { stdio: "inherit" });
        console.log(`Inserted/Updated post ${post.id}`);
      } catch (error) {
        console.error(`Failed to insert/update post ${post.id}:`, error);
      }
    }

    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main();
