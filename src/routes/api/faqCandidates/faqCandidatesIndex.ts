import express, { Response } from "express";
import { RowDataPacket } from "mysql2/promise";
import { Pool } from "../../../../config/connectDB";
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";
import { buildTopicTree, maskProfanity, parseSamples } from "../../../utils/faqCandidateRules";
import { isFaqCandidatesRunning, runFaqCandidates } from "../../../scripts/faqCandidates";

/**
 * FAQ 후보 (faq_candidates, config/createDB.ts) — 학생이 물었지만 호빗이 답을 못 찾은 질문을 비슷한 것끼리 모은 것
 *   밤 12시 작업(src/scripts/faqCandidates.ts)이 채움. 관리자는 FAQ로 만든 뒤 '완료', 필요 없는 것은 '제외'
 *   근로장학생 계정은 앱 전체의 seniorGuard(chatIndex.ts)가 막음
 */
const router = express.Router();
const STATUSES = ["open", "done", "dismissed"] as const;
const SORTS: Record<string, string> = {
  count: "ask_count DESC, last_asked_at DESC, id DESC",
  recent: "last_asked_at DESC, id DESC",
};

const statusOf = (v: unknown) => (STATUSES.includes(String(v) as any) ? String(v) : "open");

// 목록·주제별이 같이 씀 — 화면에 보낼 때도 욕설을 한 번 더 가림 (예전에 저장된 문장까지)
async function loadCandidates(status: string, order: string) {
  const [counts] = await Pool.query<RowDataPacket[]>(`SELECT status, COUNT(*) AS n FROM faq_candidates GROUP BY status`);
  const [rows] = await Pool.query<RowDataPacket[]>(
    `SELECT c.id, c.question, c.ask_count, c.samples, c.first_asked_at, c.last_asked_at, c.status,
            c.similar_faq_id, c.similar_faq_question, c.similar_faq_senior, c.similar_score, c.created_at, c.updated_at,
            c.topic_id, c.topic_name, c.subtopic,
            (SELECT COUNT(*) FROM faq_candidate_questions q WHERE q.candidate_id = c.id) AS question_count
       FROM faq_candidates c WHERE c.status = ? ORDER BY ${order} LIMIT 1000`,
    [status],
  );
  return {
    counts: Object.fromEntries(STATUSES.map((s) => [s, Number(counts.find((c) => c.status === s)?.n ?? 0)])),
    candidates: rows.map((r) => ({
      ...r,
      question: maskProfanity(r.question),
      samples: parseSamples(r.samples).map((smp) => ({ ...smp, text: maskProfanity(smp.text) })),
      similar_faq_senior: !!r.similar_faq_senior,
      question_count: Number(r.question_count ?? 0),
    })),
  };
}

// @route   GET api/faq-candidates?status=open|done|dismissed&sort=count|recent
// @access  Private
router.get("/", auth, async (req: Request, res: Response) => {
  const order = SORTS[String(req.query.sort)] ?? SORTS.count;
  try {
    const data = await loadCandidates(statusOf(req.query.status), order.replace(/(^|, )/g, "$1c."));
    res.status(200).json({ statusCode: 200, message: "FAQ candidates retrieved", data });
  } catch (err: any) {
    if (err.code === "ER_NO_SUCH_TABLE") {
      return res.status(200).json({ statusCode: 200, message: "Not ready", data: { counts: {}, candidates: [] } });
    }
    console.error(err.message);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  }
});

// @route   GET api/faq-candidates/topics?status=open — 주제 → 하위 주제 → 후보 (물은 횟수 많은 순)
// @access  Private
router.get("/topics", auth, async (req: Request, res: Response) => {
  try {
    const { counts, candidates } = await loadCandidates(statusOf(req.query.status), SORTS.count.replace(/(^|, )/g, "$1c."));
    res.status(200).json({
      statusCode: 200,
      message: "FAQ candidate topics retrieved",
      data: { counts, total: candidates.length, topics: buildTopicTree(candidates as any[]) },
    });
  } catch (err: any) {
    if (err.code === "ER_NO_SUCH_TABLE" || err.code === "ER_BAD_FIELD_ERROR") {
      return res.status(200).json({ statusCode: 200, message: "Not ready", data: { counts: {}, total: 0, topics: [] } });
    }
    console.error(err.message);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  }
});

// @route   GET api/faq-candidates/:id/questions?offset=0&limit=20 — 학생이 실제로 쓴 질문 (최근 순)
// @access  Private
router.get("/:id/questions", auth, async (req: Request, res: Response) => {
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  try {
    const id = Number(req.params.id);
    const [[total]] = await Pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM faq_candidate_questions WHERE candidate_id = ?`, [id]) as any;
    const [rows] = await Pool.query<RowDataPacket[]>(
      `SELECT id, text, language, asked_at FROM faq_candidate_questions WHERE candidate_id = ?
        ORDER BY asked_at IS NULL, asked_at DESC, id DESC LIMIT ? OFFSET ?`,
      [id, limit, offset],
    );
    res.status(200).json({
      statusCode: 200,
      message: "FAQ candidate questions retrieved",
      data: { total: Number(total?.n ?? 0), questions: rows.map((r) => ({ ...r, text: maskProfanity(r.text) })) },
    });
  } catch (err: any) {
    console.error(err.message);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  }
});

// @route   POST api/faq-candidates/run — 밤 작업을 지금 실행 (확인·테스트용)
// @access  Private (근로장학생 제외)
router.post("/run", auth, async (_req: Request, res: Response) => {
  if (isFaqCandidatesRunning()) {
    return res.status(409).json({ statusCode: 409, message: "이미 모으는 중이에요. 잠시 후 다시 시도해 주세요." });
  }
  try {
    const summary = await runFaqCandidates();
    if (!summary) return res.status(409).json({ statusCode: 409, message: "이미 모으는 중이에요." });
    res.status(200).json({ statusCode: 200, message: "FAQ candidates updated", data: summary });
  } catch (err: any) {
    console.error(err.message);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  }
});

// @route   PATCH api/faq-candidates/:id  { status: open | done | dismissed }  (관리자 화면은 PUT으로 보냄 — 같은 처리)
// @access  Private
const updateStatus = async (req: Request, res: Response) => {
  const status = String(req.body?.status ?? "");
  if (!STATUSES.includes(status as any)) {
    return res.status(400).json({ statusCode: 400, message: "상태가 올바르지 않습니다." });
  }
  try {
    const [r]: any = await Pool.query(`UPDATE faq_candidates SET status = ? WHERE id = ?`, [status, Number(req.params.id)]);
    if (!r.affectedRows) return res.status(404).json({ statusCode: 404, message: "후보를 찾지 못했어요." });
    res.status(200).json({ statusCode: 200, message: "FAQ candidate updated" });
  } catch (err: any) {
    console.error(err.message);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  }
};
router.patch("/:id", auth, updateStatus);
router.put("/:id", auth, updateStatus);

// @route   DELETE api/faq-candidates/:id
// @access  Private
router.delete("/:id", auth, async (req: Request, res: Response) => {
  try {
    await Pool.query(`DELETE FROM faq_candidates WHERE id = ?`, [Number(req.params.id)]);
    res.status(200).json({ statusCode: 200, message: "FAQ candidate deleted" });
  } catch (err: any) {
    console.error(err.message);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  }
});

export default router;
