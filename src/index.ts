import { createLogger } from "./utils/logger.util";
import { imageCollectionWorkflow, syncWorkflow } from "./workflows";

const logger = createLogger("Worker");

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle scheduled tasks via HTTP request
    if (url.pathname === "/__scheduled") {
      const cron = url.searchParams.get("cron");
      if (!cron) {
        return new Response("Missing cron parameter", { status: 400 });
      }

      try {
        logger.info("Scheduled task triggered", { cron });

        // Match cron patterns to determine which workflow to run
        if (cron === "0 5 * * *") {
          logger.info("Running sync workflow");
          await syncWorkflow();
        } else if (cron === "30 5 * * *") {
          logger.info("Running image collection workflow");
          await imageCollectionWorkflow();
        } else {
          logger.warn("Unknown cron pattern", { cron });
        }

        return new Response("Scheduled task completed successfully");
      } catch (error) {
        logger.error("Scheduled task failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        return new Response("Scheduled task failed", { status: 500 });
      }
    }

    return new Response("Not found", { status: 404 });
  },

  // This is called by Cloudflare's cron trigger
  async scheduled(event: { cron: string }): Promise<void> {
    const cron = event.cron;
    logger.info("Scheduled task triggered", { cron });

    try {
      // Match cron patterns to determine which workflow to run
      if (cron === "0 5 * * *") {
        logger.info("Running sync workflow");
        await syncWorkflow();
      } else if (cron === "30 5 * * *") {
        logger.info("Running image collection workflow");
        await imageCollectionWorkflow();
      } else {
        logger.warn("Unknown cron pattern", { cron });
      }
    } catch (error) {
      logger.error("Workflow execution failed", {
        error: error instanceof Error ? error.message : String(error),
        cron,
      });
      throw error; // Re-throw to ensure Cloudflare sees the failure
    }
  },
};
