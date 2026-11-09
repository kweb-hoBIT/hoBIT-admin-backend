import cron from "node-cron";
import { RowDataPacket } from "mysql2/promise";
import { Pool } from "../../config/connectDB";
import { runFaqCandidates } from "./faqCandidates";

/**
 * 서버가 켜질 때 주제가 빈 후보가 있으면 한 번 정리 — 주제 칸이 생기기 전에 만든 후보(예전 자동 피드백에서 옮긴 것)나
 * 정리 중 RAG가 꺼져 있어 주제를 못 정한 후보가 다음 밤 12시까지 모두 '기타'로 보이지 않게 (2026-11-09: 111개가 전부 기타)
 */
async function fillMissingTopics() {
  try {
    const [rows] = await Pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS n FROM faq_candidates WHERE topic_name IS NULL AND status IN ('open', 'dismissed')`
    );
    const n = Number(rows[0]?.n ?? 0);
    if (!n) return;
    console.log(`[faq_candidates] 주제가 빈 후보 ${n}개 — 지금 한 번 정리`);
    const summary = await runFaqCandidates();
    console.log("[faq_candidates] 켤 때 정리 결과", summary);
  } catch (err) {
    console.error("Error in faqCandidates (startup):", err);
  }
}

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
  // DB 준비·RAG 재시작이 끝난 뒤에 (배포 직후엔 RAG도 다시 켜지는 중일 수 있음)
  setTimeout(fillMissingTopics, 60_000).unref();
}
