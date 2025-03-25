import { readFileSync } from "node:fs";

// Load environment variables from .dev.vars
const envFile = readFileSync(".dev.vars", "utf-8");
const envVars = envFile
  .split("\n")
  .filter((line) => line && !line.startsWith("#"))
  .reduce((acc, line) => {
    const [key, value] = line.split("=");
    if (key && value) {
      const trimmedKey = key.trim();
      const trimmedValue = value.trim();
      process.env[trimmedKey] = trimmedValue;
      console.log(`Loaded env var: ${trimmedKey}=${trimmedValue}`);
    }
    return acc;
  }, {});

// Required environment variables
const requiredVars = [
  "NOTION_TOKEN",
  "NOTION_ROOT_PAGE_ID",
  "DASHSCOPE_API_KEY",
  "DEEPSEEK_API_KEY",
] as const;

// Check all required variables are set
for (const varName of requiredVars) {
  if (!process.env[varName]) {
    throw new Error(`Required environment variable ${varName} is not set`);
  }
}

// Set up global variables required by services
declare global {
  var NOTION_TOKEN: string;
  var NOTION_ROOT_PAGE_ID: string;
  var DASHSCOPE_API_KEY: string;
  var DEEPSEEK_API_KEY: string;
  var TEST_DB: D1Database;
}

globalThis.NOTION_TOKEN = process.env.NOTION_TOKEN!;
globalThis.NOTION_ROOT_PAGE_ID = process.env.NOTION_ROOT_PAGE_ID!;
globalThis.DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY!;
globalThis.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY!;

console.log("Global variables set:", {
  NOTION_TOKEN: "***",
  NOTION_ROOT_PAGE_ID: "***",
  DASHSCOPE_API_KEY: "***",
  DEEPSEEK_API_KEY: "***",
});

export default envVars;
