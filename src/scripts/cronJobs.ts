import cron from "node-cron";
import { runFaqCandidates } from "./faqCandidates";

export async function startCronJobs() {
  // 답을 못 찾은 질문 → FAQ 후보 (예전 getUnmatchedQuestion_v2는 user_feedbacks에 한 줄씩 넣던 방식이라 바꿈)
  cron.schedule("0 0 * * *", async () => {
    console.log("Running faqCandidates");
    try {
      await runFaqCandidates();
    } catch (err) {
      console.error("Error in faqCandidates:", err);
    }
  });
}
