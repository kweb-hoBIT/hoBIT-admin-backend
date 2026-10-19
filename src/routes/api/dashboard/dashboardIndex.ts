import express, { Response } from "express";
import { RowDataPacket } from "mysql2/promise";
import { Pool } from "../../../../config/connectDB";
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

/**
 * 관리자 홈 대시보드 — 이용 통계와 최근 피드백을 한 번에 (질문 기록·피드백 테이블만 읽음)
 */
const router = express.Router();

const DAYS = 14;

// @route   GET api/dashboard
// @access  Private
router.get("/", auth, async (_req: Request, res: Response) => {
  try {
    const q = <T extends RowDataPacket[]>(sql: string, params: unknown[] = []) =>
      Pool.query<T>(sql, params).then(([rows]) => rows);

    const [totals, daily, topFaqs, topQuestions, feedbackCounts, recentFeedbacks] = await Promise.all([
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
         GROUP BY DATE(created_at)`),
      q(`SELECT faqs.id AS faq_id, faqs.question_ko, COUNT(*) AS count
         FROM question_logs JOIN faqs ON question_logs.faq_id = faqs.id
         WHERE question_logs.created_at >= CURDATE() - INTERVAL 6 DAY
         GROUP BY faqs.id, faqs.question_ko
         ORDER BY count DESC LIMIT 6`),
      q(`SELECT user_question, COUNT(*) AS count
         FROM question_logs
         WHERE created_at >= CURDATE() - INTERVAL 6 DAY AND faq_id IS NULL AND CHAR_LENGTH(user_question) > 1
         GROUP BY user_question
         ORDER BY count DESC, MAX(created_at) DESC LIMIT 6`),
      q(`SELECT SUM(resolved = 0) AS unresolved, SUM(created_at >= CURDATE() - INTERVAL 6 DAY) AS week
         FROM user_feedbacks`),
      q(`SELECT user_feedbacks.id, faqs.question_ko, user_feedbacks.user_question, user_feedbacks.feedback_reason,
                user_feedbacks.feedback_detail, user_feedbacks.language, user_feedbacks.created_at
         FROM user_feedbacks LEFT JOIN faqs ON user_feedbacks.faq_id = faqs.id
         WHERE user_feedbacks.resolved = 0
         ORDER BY user_feedbacks.created_at DESC LIMIT 5`),
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
        top_questions: topQuestions.map((r) => ({ question: r.user_question, count: Number(r.count) })),
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
