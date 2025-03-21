import type { D1Database } from "@cloudflare/workers-types";
import { clearPosts, insertPosts } from "./d1";
import { fetchPublishedPosts, transformToD1Posts } from "./notion";

export const syncPosts = async (
  notionToken: string,
  notionDatabaseId: string,
  db: D1Database
): Promise<void> => {
  const pages = await fetchPublishedPosts(notionToken, notionDatabaseId);
  const posts = transformToD1Posts(pages);
  await clearPosts(db);
  await insertPosts(db, posts);
};
