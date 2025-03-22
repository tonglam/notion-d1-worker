import { imageCollectionWorkflow, syncWorkflow } from "./workflows";

export default {
  async scheduled(): Promise<void> {
    // Determine which workflow to run based on the cron schedule
    const now = new Date();
    const minute = now.getUTCMinutes();

    // Run sync at minute 0 (5:00 AM UTC)
    // Run image collection at minute 30 (5:30 AM UTC)
    if (minute === 0) {
      await syncWorkflow();
    } else if (minute === 30) {
      await imageCollectionWorkflow();
    }
  },
};
