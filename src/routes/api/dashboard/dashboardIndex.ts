import express, { Response } from "express";
import { RowDataPacket } from "mysql2/promise";
import { Pool } from "../../../../config/connectDB";
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";
import { AUTO_FEEDBACK_REASON } from "../../../scripts/getUnmatchedQuestion_v2";
import env from "../../../../config/env";

/**
 * 관리자 홈 대시보드 — 이용 통계와 최근 피드백을 한 번에 (질문 기록·피드백 테이블만 읽음)
 *  - 피드백: 학생이 남긴 것만 (밤 12시 작업이 만든 "FAQ 후보" 기록은 피드백 화면에서 따로 봄)
 *  - 많이 쓰인 FAQ: FAQ를 직접 연 횟수 + AI 답변이 근거로 인용한 횟수
 *  - 답을 못 찾은 질문: AI가 자료에서 답을 찾지 못한 질문을 비슷한 문장끼리 묶어서
 *  - 데이터 수집: 홈페이지·FAQ 정기 수집의 마지막 결과 (RAG /pipeline/status, 실패해도 대시보드는 그대로)
 *  - 답변 품질(주별): 못 찾음·👎·숫자를 뺀 답변 비율, 규칙 분류 비율, 응답 시간 — 리뉴얼 AI 답변만 (answer가 있는 기록)
 *  - 배포 후 테스트: 마지막 시나리오 테스트 결과 (RAG /tests/latest)
 */
const router = express.Router();

const DAYS = 14;

async function pipelineStatus() {
  try {
    const r = await fetch(`${env.RAG_URL}/pipeline/status`, { signal: AbortSignal.timeout(1500) });
    const j: any = await r.json();
    if (!j?.available) return null;
    return {
      finished_at: String(j.finished_at),
      scope: String(j.scope ?? ""),
      ok: Boolean(j.ok),
      problems: Array.isArray(j.problems) ? j.problems.map(String) : [],
      last_ok_at: j.last_ok_at ? String(j.last_ok_at) : null,
    };
  } catch {
    return null; // RAG가 꺼져 있거나 주소가 다르면 표시만 생략
  }
}

async function latestTests() {
  try {
    const r = await fetch(`${env.RAG_URL}/tests/latest`, { signal: AbortSignal.timeout(1500) });
    const j: any = await r.json();
    if (!j?.available) return null;
    return {
      finished_at: String(j.finished_at), total: Number(j.total ?? 0), passed: Number(j.passed ?? 0),
      flaky: Array.isArray(j.flaky) ? j.flaky.map(String) : [],
      failed: Array.isArray(j.failed) ? j.failed.map((f: any) => String(f.name)) : [],
    };
  } catch {
    return null;
  }
}

const QUALITY_WEEKS = 8;
const pctile = (xs: number[], p: number) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
};

/** 주별 답변 품질 — 월요일 시작 주 (칸이 아직 없는 DB면 빈 목록) */
async function qualityWeeks() {
  try {
    const [rows] = await Pool.query<RowDataPacket[]>(
      `SELECT YEARWEEK(created_at, 3) AS wk, DATE_FORMAT(MIN(DATE(created_at)), '%Y-%m-%d') AS first_day,
              COUNT(*) AS total, SUM(answer_status = 'not_found') AS not_found, SUM(feedback_score = -1) AS down,
              SUM(feedback_score = 1) AS up, SUM(grounding_issues IS NOT NULL) AS grounding,
              SUM(classified_by = 'rule') AS rule_classified, SUM(classified_by IS NOT NULL) AS classified
         FROM question_logs
        WHERE answer IS NOT NULL AND created_at >= CURDATE() - INTERVAL ${QUALITY_WEEKS * 7} DAY
        GROUP BY wk ORDER BY wk`
    );
    const [lat] = await Pool.query<RowDataPacket[]>(
      `SELECT YEARWEEK(created_at, 3) AS wk, latency_ms FROM question_logs
        WHERE answer IS NOT NULL AND latency_ms IS NOT NULL AND created_at >= CURDATE() - INTERVAL ${QUALITY_WEEKS * 7} DAY`
    );
    const byWeek = new Map<number, number[]>();
    lat.forEach((r) => byWeek.set(Number(r.wk), [...(byWeek.get(Number(r.wk)) ?? []), Number(r.latency_ms)]));
    const rate = (a: unknown, b: unknown) => (Number(b) > 0 ? Math.round((Number(a) / Number(b)) * 1000) / 10 : null);
    return rows.map((r) => {
      const ls = byWeek.get(Number(r.wk)) ?? [];
      return {
        week_start: String(r.first_day),
        total: Number(r.total),
        not_found_rate: rate(r.not_found, r.total),
        down: Number(r.down ?? 0),
        up: Number(r.up ?? 0),
        down_rate: rate(r.down, r.total),
        grounding_rate: rate(r.grounding, r.total),
        rule_rate: rate(r.rule_classified, r.classified),
        latency_p50: pctile(ls, 0.5),
        latency_p90: pctile(ls, 0.9),
      };
    });
  } catch (err: any) {
    if (err.code !== "ER_BAD_FIELD_ERROR") console.error("[dashboard] 답변 품질 집계 실패:", err.message);
    return [];
  }
}

// 띄어쓰기·문장부호·대소문자만 다른 질문은 같은 질문으로 묶음 ("행정실 운영시간?" = "행정실 운영 시간")
const questionKey = (q: string) => q.toLowerCase().replace(/[\s?!.,~'"·…]+/g, "");

// @route   GET api/dashboard
// @access  Private
router.get("/", auth, async (_req: Request, res: Response) => {
  try {
    const q = <T extends RowDataPacket[]>(sql: string, params: unknown[] = []) =>
      Pool.query<T>(sql, params).then(([rows]) => rows);

    const [quality, tests] = await Promise.all([qualityWeeks(), latestTests()]);
    const [totals, daily, topFaqs, topQuestions, feedbackCounts, recentFeedbacks, pipeline] = await Promise.all([
      q(`SELECT
           SUM(created_at >= CURDATE()) AS today,
           SUM(created_at >= CURDATE() - INTERVAL 6 DAY) AS week,
           SUM(created_at >= CURDATE() - INTERVAL 13 DAY AND created_at < CURDATE() - INTERVAL 6 DAY) AS prev_week,
           SUM(created_at >= CURDATE() - INTERVAL 29 DAY) AS month,
           SUM(created_at >= CURDATE() - INTERVAL 29 DAY AND language = 'EN') AS month_en
         FROM question_logs
         WHERE created_at >= CURDATE() - INTERVAL 29 DAY`),
      q(`SELECT DATE_FORMAT(DATE(created_at), '%Y-%m-%d') AS date,
                SUM(language = 'KO') AS ko, SUM(language = 'EN') AS en
         FROM question_logs
         WHERE created_at >= CURDATE() - INTERVAL ${DAYS - 1} DAY
         GROUP BY date`), // MySQL 8(only_full_group_by)은 SELECT와 같은 이름으로 묶어야 함
      q(`SELECT faqs.id AS faq_id, faqs.question_ko, COUNT(*) AS count
         FROM question_logs
         JOIN faqs ON question_logs.faq_id = faqs.id OR FIND_IN_SET(faqs.id, question_logs.cited_faq_ids)
         WHERE question_logs.created_at >= CURDATE() - INTERVAL 6 DAY
         GROUP BY faqs.id, faqs.question_ko
         ORDER BY count DESC LIMIT 6`),
      q(`SELECT user_question, created_at
         FROM question_logs
         WHERE created_at >= CURDATE() - INTERVAL 6 DAY AND answer_status = 'not_found' AND CHAR_LENGTH(user_question) > 1
         ORDER BY created_at DESC LIMIT 1000`),
      q(`SELECT SUM(resolved = 0) AS unresolved, SUM(created_at >= CURDATE() - INTERVAL 6 DAY) AS week
         FROM user_feedbacks
         WHERE feedback_reason IS NULL OR feedback_reason <> ?`, [AUTO_FEEDBACK_REASON]),
      q(`SELECT user_feedbacks.id, faqs.question_ko, user_feedbacks.user_question, user_feedbacks.feedback_reason,
                user_feedbacks.feedback_detail, user_feedbacks.language, user_feedbacks.created_at
         FROM user_feedbacks LEFT JOIN faqs ON user_feedbacks.faq_id = faqs.id
         WHERE user_feedbacks.resolved = 0
           AND (user_feedbacks.feedback_reason IS NULL OR user_feedbacks.feedback_reason <> ?)
         ORDER BY user_feedbacks.created_at DESC LIMIT 5`, [AUTO_FEEDBACK_REASON]),
      pipelineStatus(),
    ]);

    // 질문이 없던 날도 0으로 채움 (그래프 x축이 빠지지 않게)
    const byDate = new Map(daily.map((d) => [d.date, d]));
    const series = Array.from({ length: DAYS }, (_, i) => {
      const day = new Date();
      day.setDate(day.getDate() - (DAYS - 1 - i));
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      const row = byDate.get(key);
      return { date: key, ko: Number(row?.ko ?? 0), en: Number(row?.en ?? 0) };
    });

    // 답을 못 찾은 질문 — 비슷한 문장끼리 묶고, 대표 문장은 가장 최근에 들어온 표현
    const groups = new Map<string, { question: string; count: number }>();
    for (const r of topQuestions) {
      const key = questionKey(String(r.user_question));
      const g = groups.get(key);
      if (g) g.count += 1;
      else groups.set(key, { question: r.user_question, count: 1 });
    }
    const notFound = Array.from(groups.values()).sort((a, b) => b.count - a.count).slice(0, 6);

    const t: Record<string, any> = totals[0] ?? {};
    const f: Record<string, any> = feedbackCounts[0] ?? {};
    res.status(200).json({
      statusCode: 200,
      message: "Dashboard retrieved successfully",
      data: {
        totals: {
          today: Number(t.today ?? 0),
          week: Number(t.week ?? 0),
          prev_week: Number(t.prev_week ?? 0),
          month: Number(t.month ?? 0),
          month_en: Number(t.month_en ?? 0),
          unresolved_feedbacks: Number(f.unresolved ?? 0),
          week_feedbacks: Number(f.week ?? 0),
        },
        daily: series,
        top_faqs: topFaqs.map((r) => ({ faq_id: r.faq_id, question_ko: r.question_ko, count: Number(r.count) })),
        top_questions: notFound,
        pipeline,
        quality,
        tests,
        recent_feedbacks: recentFeedbacks.map((r) => ({
          user_feedback_id: r.id,
          question_ko: r.question_ko,
          user_question: r.user_question,
          feedback_reason: r.feedback_reason,
          feedback_detail: r.feedback_detail,
          language: r.language,
          created_at: r.created_at,
        })),
      },
    });
  } catch (err: any) {
    console.error(err.message);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  }
});

export default router;
