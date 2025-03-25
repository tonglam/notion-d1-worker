import { Client } from "@notionhq/client";
import type {
  BlockObjectResponse,
  PageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";

async function main() {
  const notion = new Client({
    auth: process.env.NOTION_TOKEN,
  });

  const rootPageId = process.env.NOTION_ROOT_PAGE_ID;
  if (!rootPageId) {
    throw new Error("NOTION_ROOT_PAGE_ID is required");
  }

  console.log("\nFetching root page:", rootPageId);
  const rootPage = (await notion.pages.retrieve({
    page_id: rootPageId,
  })) as PageObjectResponse;
  const rootTitle =
    rootPage.properties.title?.type === "title"
      ? rootPage.properties.title.title[0]?.plain_text
      : "No title found";
  console.log("Root page title:", rootTitle);

  // Get all child pages recursively using a queue
  const queue: string[] = [rootPageId];
  const processedPages = new Set<string>();
  const childPages: Array<{
    id: string;
    title: string;
    properties: PageObjectResponse["properties"];
  }> = [];

  while (queue.length > 0) {
    const currentPageId = queue.shift()!;
    if (processedPages.has(currentPageId)) continue;
    processedPages.add(currentPageId);

    console.log(`\nFetching children of page: ${currentPageId}`);
    const children = await notion.blocks.children.list({
      block_id: currentPageId,
    });

    for (const block of children.results) {
      if ("type" in block && block.type === "child_page") {
        console.log(
          `Found child page: ${
            (block as BlockObjectResponse & { type: "child_page" }).child_page
              .title
          }`
        );
        queue.push(block.id);

        // Fetch the page properties
        const pageDetails = (await notion.pages.retrieve({
          page_id: block.id,
        })) as PageObjectResponse;
        const pageTitle =
          pageDetails.properties.title?.type === "title"
            ? pageDetails.properties.title.title[0]?.plain_text
            : "No title found";
        childPages.push({
          id: block.id,
          title: pageTitle,
          properties: pageDetails.properties,
        });
      }
    }
  }

  console.log("\nAll child pages found:");
  childPages.forEach((page) => {
    console.log(`- ${page.title} (${page.id})`);
    console.log("  Properties:", Object.keys(page.properties));
  });
}

main().catch(console.error);
