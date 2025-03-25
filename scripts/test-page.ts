import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { config } from "dotenv";
import { resolve } from "node:path";
import type { NotionPage } from "../src/types/notion.types";

// Load environment variables
config({ path: resolve(process.cwd(), ".dev.vars") });

const { NOTION_TOKEN } = process.env;

if (!NOTION_TOKEN) {
  throw new Error("NOTION_TOKEN is required");
}

// Initialize Notion client
const notion = new Client({
  auth: NOTION_TOKEN,
  notionVersion: "2022-06-28",
});

// Test page ID - using one from our logs
const TEST_PAGE_ID = "edcd59d0-d8a7-4903-860b-fe2879f1367e";

function transformToNotionPage(page: PageObjectResponse): NotionPage {
  return {
    id: page.id,
    created_time: page.created_time,
    last_edited_time: page.last_edited_time,
    url: page.url,
    properties: page.properties as any, // Type assertion needed due to Notion API types
  };
}

async function testPage() {
  try {
    console.log("Fetching test page...");
    const page = (await notion.pages.retrieve({
      page_id: TEST_PAGE_ID,
    })) as PageObjectResponse;

    const notionPage = transformToNotionPage(page);

    console.log("\nPage metadata:");
    console.log("ID:", notionPage.id);
    console.log("Created time:", notionPage.created_time);
    console.log("Last edited time:", notionPage.last_edited_time);

    console.log("\nRaw properties:");
    console.log(JSON.stringify(notionPage.properties, null, 2));

    console.log("\nTitle property:");
    const titleProp = notionPage.properties.title;
    console.log("Title type:", titleProp.type);
    console.log("Title content:", titleProp.title);
  } catch (error) {
    console.error("Error fetching page:", error);
  }
}

testPage();
