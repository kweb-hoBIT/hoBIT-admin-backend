import express, { Response } from "express";
import { RowDataPacket } from "mysql2/promise";
import { Pool } from "../../../../config/connectDB";
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

/**
 * 주제별 검색 범위 요약 — 챗봇(RAG)은 질문마다 주제를 정하고 그 주제의 자료부터 찾아요.
 * 결과가 너무 적으면 전체 자료로 넓히고 검색 경로(routes)에 "범위가 좁아 전체로 넓힘 (안내·공지)"를 남겨요.
 * 주제마다 넓힌 비율이 높으면 그 주제의 '먼저 찾는 자료'에 빠진 곳이 있다는 뜻 — 넓혔을 때 인용된 자료를 함께 보여 줘
 * 어떤 자료를 범위에 더할지 고를 수 있게 해요.
 *
 * question_logs 칸 (hoBIT-backend config/createDB.ts, 기록은 src/apis/question.ts logQuestion)
 *   topic          주제 id (hoBIT-rag/src/utils/topics.py) 또는 NULL
 *   routes         검색 경로 — 문장들을 ' | '로 이어 붙인 글 (JSON 배열로 들어온 것도 읽어요)
 *   cited_sources  인용한 근거 JSON [{ id, label, title, link }]
 *   answer_status  answered | not_found
 *   feedback_score 1(👍) / -1(👎) / NULL
 */
const router = express.Router();

export const TOPIC_LABELS: Record<string, string> = {
  graduation: "졸업",
  courses: "수업·수강",
  majors: "전공·교육과정",
  academic_status: "학적",
  scholarship: "장학·등록",
  career: "현장실습·진로",
  exchange: "교환·학점교류",
  facilities: "시설·생활",
  safety: "안전·병무·필수교육",
  student_life: "학생 활동",
  faculty: "교수·연구",
  office: "행정·문의",
  notices: "공지·모집",
};
const NO_TOPIC = "none";

const WIDENED_PREFIX = "범위가 좁아 전체로 넓힘";
const TOP_SOURCES = 5;

/** routes 칸을 문장 목록으로 — ' | '로 이은 글(지금 방식) 또는 JSON 배열 */
const parseRoutes = (v: unknown): string[] => {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String);
  const s = String(v).trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map(String);
    } catch {
      /* 아래에서 글로 처리 */
    }
  }
  return s.split(" | ").map((x) => x.trim()).filter(Boolean);
};

/** "범위가 좁아 전체로 넓힘 (안내·공지)" → ["안내", "공지"] (괄호가 없으면 빈 목록) */
const widenedParts = (route: string): string[] => {
  const m = route.match(/\(([^)]*)\)/);
  return m ? m[1].split("·").map((x) => x.trim()).filter(Boolean) : [];
};

const parseCited = (v: unknown): { label?: string; title?: string }[] => {
  try {
    const arr = typeof v === "string" ? JSON.parse(v) : v;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

// @route   GET api/dashboard/scope?days=30
// @access  Private
router.get("/", auth, async (req: Request, res: Response) => {
  const days = Math.min(Math.max(Number(req.query.days ?? 30) || 30, 1), 365);
  try {
    const [rows] = await Pool.query<RowDataPacket[]>(
      `SELECT topic, routes, cited_sources, answer_status, feedback_score
         FROM question_logs
        WHERE answer IS NOT NULL AND created_at >= NOW() - INTERVAL ${days} DAY`
    );

    type Acc = {
      questions: number;
      widened: number;
      widened_static: number;
      widened_notices: number;
      not_found: number;
      down: number;
      sources: Map<string, number>;
    };
    const byTopic = new Map<string, Acc>();
    for (const r of rows) {
      const id = r.topic ? String(r.topic) : NO_TOPIC;
      let a = byTopic.get(id);
      if (!a) {
        a = { questions: 0, widened: 0, widened_static: 0, widened_notices: 0, not_found: 0, down: 0, sources: new Map() };
        byTopic.set(id, a);
      }
      a.questions += 1;
      if (r.answer_status === "not_found") a.not_found += 1;
      if (Number(r.feedback_score) === -1) a.down += 1;

      // 255자로 잘려 마지막 문장이 끊긴 경우도 넓힌 것으로 셈
      const wide =
        parseRoutes(r.routes).find((x) => x.startsWith(WIDENED_PREFIX)) ??
        (String(r.routes ?? "").includes(WIDENED_PREFIX) ? WIDENED_PREFIX : undefined);
      if (!wide) continue;
      a.widened += 1;
      const parts = widenedParts(wide);
      if (parts.includes("안내")) a.widened_static += 1;
      if (parts.includes("공지")) a.widened_notices += 1;
      // 넓혔을 때 실제로 답에 쓰인 자료 — 한 답변에서 같은 자료는 한 번만
      const names = new Set(
        parseCited(r.cited_sources)
          .map((c) => String(c?.label || c?.title || "").trim())
          .filter(Boolean)
      );
      names.forEach((n) => a!.sources.set(n, (a!.sources.get(n) ?? 0) + 1));
    }

    const topics = Array.from(byTopic.entries())
      .map(([id, a]) => ({
        topic: id === NO_TOPIC ? null : id,
        label: id === NO_TOPIC ? "주제 없음" : TOPIC_LABELS[id] ?? id,
        questions: a.questions,
        widened: a.widened,
        widened_rate: rate(a.widened, a.questions),
        widened_static: a.widened_static,
        widened_notices: a.widened_notices,
        not_found: a.not_found,
        not_found_rate: rate(a.not_found, a.questions),
        down: a.down,
        down_rate: rate(a.down, a.questions),
        widened_sources: Array.from(a.sources.entries())
          .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
          .slice(0, TOP_SOURCES)
          .map(([name, count]) => ({ name, count })),
      }))
      .sort((x, y) => y.widened_rate - x.widened_rate || y.questions - x.questions);

    res.status(200).json({
      statusCode: 200,
      message: "Scope summary retrieved",
      data: { days, total: rows.length, topics },
    });
  } catch (err: any) {
    if (err.code === "ER_BAD_FIELD_ERROR" || err.code === "ER_NO_SUCH_TABLE") {
      // 챗봇 백엔드가 아직 새 칸(topic·routes 등)을 만들기 전
      return res.status(200).json({ statusCode: 200, message: "Not ready", data: { days, total: 0, topics: [] } });
    }
    console.error(err.message);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  }
});

export default router;
