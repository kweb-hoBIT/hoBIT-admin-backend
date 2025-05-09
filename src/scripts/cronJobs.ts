import cron from "node-cron";
import { getUnmatchedQuestion_v2 } from "./getUnmatchedQuestion_v2";

export async function startCronJobs() {
  cron.schedule("0 0 * * *", async () => {
    console.log("Running getUnmatchedQuestion");
    try {
      await getUnmatchedQuestion_v2();
    } catch (err) {
      console.error("Error in getUnmatchedQuestion:", err);
    }
  });
}
