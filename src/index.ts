import type { Env } from "./types/types";
import { createLogger } from "./utils/logger.util";
import { imageCollectionWorkflow, syncWorkflow } from "./workflows";

const logger = createLogger("Worker");

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    // Determine which workflow to run based on the cron schedule
    const now = new Date();
    const minute = now.getUTCMinutes();

    // Run sync at minute 0 (5:00 AM UTC)
    // Run image collection at minute 30 (5:30 AM UTC)
    if (minute === 0) {
      await syncWorkflow(env);
    } else if (minute === 30) {
      await imageCollectionWorkflow(env);
    }
  },
};
