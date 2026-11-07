import express, { Response } from "express";
import { RowDataPacket } from "mysql2/promise";
import { Pool } from "../../../../config/connectDB";
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";
import env from "../../../../config/env";

/**
 * 답변 확인 — 확인이 필요한 AI 답변을 한곳에서 (질문 기록 question_logs, 칸은 hoBIT-backend config/createDB.ts)
 *   down       학생이 👎를 누른 답변 (+ 남긴 이유)
 *   not_found  자료에서 답을 못 찾은 질문
 *   grounding  근거에 없는 날짜·숫자가 있어 일부를 뺀 답변 (AI가 지어냈을 가능성)
 * 각 답변의 최종 답, 인용 근거, 검색 경로(규칙), 규칙/AI 분류를 보여주고, 근거 전체는 RAG 검색 기록(trace_id)에서 가져옴.
 * 관리자는 원인을 고르고 처리 완료 — 원인 통계로 무엇을 고칠지(FAQ 추가·검색 규칙·프롬프트) 정함
 */
const router = express.Router();

const TYPES: Record<string, string> = {
  down: "q.feedback_score = -1",
  not_found: "q.answer_status = 'not_found'",
  grounding: "q.grounding_issues IS NOT NULL",
};
const CAUSES = ["no_data", "outdated", "wrong_answer", "bad_search", "ok"] as const;
const parseJson = (v: unknown) => {
  try {
    return typeof v === "string" ? JSON.parse(v) : v ?? null;
  } catch {
    return null;
  }
};

// @route   GET api/answer-reviews?type=down|not_found|grounding&status=open|done&days=30
// @access  Private
router.get("/", auth, async (req: Request, res: Response) => {
  const type = String(req.query.type ?? "down");
  const open = String(req.query.status ?? "open") === "open";
  const days = Math.min(Math.max(Number(req.query.days ?? 30) || 30, 1), 365);
  if (!TYPES[type]) return res.status(400).json({ statusCode: 400, message: "type이 올바르지 않습니다." });
  try {
    const since = `q.created_at >= NOW() - INTERVAL ${days} DAY AND q.answer IS NOT NULL`;
    const [counts] = await Pool.query<RowDataPacket[]>(
      `SELECT ${Object.entries(TYPES).map(([k, c]) => `SUM(${c}) AS ${k}`).join(", ")}
         FROM question_logs q WHERE ${since} AND q.review_status IS NULL`
    );
    const [rows] = await Pool.query<RowDataPacket[]>(
      `SELECT q.id, q.created_at, q.user_question, q.language, q.answer, q.answer_status, q.cited_sources, q.routes,
              q.grounding_issues, q.trace_id, q.latency_ms, q.feedback_score, q.classified_by, q.topic,
              q.review_status, q.review_cause, q.reviewed_at,
              (SELECT f.feedback_reason FROM user_feedbacks f WHERE f.question_log_id = q.id ORDER BY f.id DESC LIMIT 1) AS feedback_reason,
              (SELECT f.feedback_detail FROM user_feedbacks f WHERE f.question_log_id = q.id ORDER BY f.id DESC LIMIT 1) AS feedback_detail
         FROM question_logs q
        WHERE ${since} AND ${TYPES[type]} AND q.review_status IS ${open ? "" : "NOT "}NULL
        ORDER BY q.id DESC LIMIT 100`
    );
    res.status(200).json({
      statusCode: 200,
      message: "Answer reviews retrieved",
      data: {
        counts: Object.fromEntries(Object.keys(TYPES).map((k) => [k, Number(counts[0]?.[k] ?? 0)])),
        items: rows.map((r) => ({ ...r, cited_sources: parseJson(r.cited_sources) ?? [] })),
      },
    });
  } catch (err: any) {
    if (err.code === "ER_BAD_FIELD_ERROR") {
      // 챗봇 백엔드가 아직 새 칸을 만들기 전
      return res.status(200).json({ statusCode: 200, message: "Not ready", data: { counts: {}, items: [] } });
    }
    console.error(err.message);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  }
});

// @route   GET api/answer-reviews/:id/trace — 그 답변이 본 근거 전체 (RAG 검색 기록)
// @access  Private
router.get("/:id/trace", auth, async (req: Request, res: Response) => {
  try {
    const [rows] = await Pool.query<RowDataPacket[]>(`SELECT trace_id FROM question_logs WHERE id = ?`, [Number(req.params.id)]);
    const traceId = rows[0]?.trace_id;
    if (!traceId) return res.status(404).json({ statusCode: 404, message: "검색 기록 번호가 없는 답변이에요" });
    const r = await fetch(`${env.RAG_URL}/logs/trace/${encodeURIComponent(traceId)}`, { signal: AbortSignal.timeout(3000) });
    const body: any = await r.json();
    if (!r.ok) return res.status(404).json({ statusCode: 404, message: body?.detail ?? "검색 기록을 찾지 못했어요" });
    res.status(200).json({ statusCode: 200, message: "Trace", data: body });
  } catch (err: any) {
    console.error(err.message);
    res.status(502).json({ statusCode: 502, message: "챗봇 서버에서 검색 기록을 가져오지 못했어요" });
  }
});

// @route   PUT api/answer-reviews/:id  { status: done | ignored | open, cause }
// @access  Private
router.put("/:id", auth, async (req: Request, res: Response) => {
  const status = String(req.body?.status ?? "");
  const cause = req.body?.cause ? String(req.body.cause) : null;
  if (!["done", "ignored", "open"].includes(status)) {
    return res.status(400).json({ statusCode: 400, message: "상태가 올바르지 않습니다." });
  }
  if (cause && !CAUSES.includes(cause as any)) {
    return res.status(400).json({ statusCode: 400, message: "원인이 올바르지 않습니다." });
  }
  try {
    await Pool.query(
      `UPDATE question_logs SET review_status = ?, review_cause = ?, reviewed_at = ${status === "open" ? "NULL" : "NOW()"} WHERE id = ?`,
      [status === "open" ? null : status, status === "open" ? null : cause, Number(req.params.id)]
    );
    res.status(200).json({ statusCode: 200, message: "Answer review updated" });
  } catch (err: any) {
    console.error(err.message);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  }
});

export default router;
