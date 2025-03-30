import cron from "node-cron";
import { getUnmatchedQuestion } from "./getUnmatchedQuestion";

export function startCronJobs() {
  cron.schedule("0 0 * * *", async () => {
    console.log("Running getUnmatchedQuestion");
    try {
      await getUnmatchedQuestion();
    } catch (err) {
      console.error("Error in getUnmatchedQuestion:", err);
    }
  });
}
