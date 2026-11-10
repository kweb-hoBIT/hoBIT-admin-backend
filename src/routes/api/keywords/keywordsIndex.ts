import express, { Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { Pool } from "../../../../config/connectDB";
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";
import env from "../../../../config/env";
import { splitKeywordLang } from "../../../utils/keywordLang";

/**
 * 키워드 규칙 — 대표 키워드 + 연관 단어 + 맨 위에 고정할 FAQ
 *   입시 ← 수시, 정시, 입학, 이공계, 인문계, 계열   → "수시, 정시 등 입학(입시) 관련 사항이 궁금해!" 고정
 * 호빗 입력창 추천(자동완성)에서 연관 단어를 입력해도 대표 키워드로 찾고, 고정 FAQ를 맨 위에 보여줌.
 * 질문을 보냈을 때도 연관 단어가 있으면 대표 키워드로 함께 검색하고 고정 FAQ를 근거로 넣음 (hoBIT-backend).
 * search_sources: 먼저 찾아볼 곳 (예: 휴학 → 학사 운영 규정·홈페이지 학사안내) — RAG가 그 출처에서 먼저 찾아 근거 앞에 둠.
 *   선택지는 RAG GET /search/sources (GET api/keywords/sources로 전달)
 * keyword_en·synonyms_en: 영어 모드용 대표 키워드·영어 단어 (예: computer science ← cs, comp sci)
 *   영어 질문이면 keyword_en을 검색어에 더함. 예전처럼 synonyms에 섞인 영어 단어는 읽을 때·저장할 때 영어 쪽으로 옮김
 */
const router = express.Router();

const MAX_SYNONYMS = 50;
const MAX_PINNED = 3; // 학생 화면이 실제로 쓰는 개수 (hoBIT-backend question.ts MAX_PINNED_FAQS)
const MAX_SOURCES = 6;

type Rule = {
  id: number;
  keyword: string;
  keyword_en: string | null;
  synonyms: string[];
  synonyms_en: string[];
  pinned_faq_ids: number[];
  search_sources: string[];
};

const parseJson = <T>(v: unknown, fallback: T): T => {
  if (Array.isArray(v)) return v as unknown as T;
  try {
    return typeof v === "string" ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};

/** 입력 정리: 앞뒤 공백 제거, 빈 값·중복·대표 키워드와 같은 단어 제거 */
export function clean(body: any): { rule?: Omit<Rule, "id">; error?: string } {
  const keyword = String(body?.keyword ?? "").trim();
  if (!keyword) return { error: "대표 키워드를 입력해주세요." };
  if (keyword.length > 100) return { error: "대표 키워드는 100자 이하로 입력해주세요." };
  const keywordEn = String(body?.keyword_en ?? "").trim();
  if (keywordEn.length > 100) return { error: "영어 대표 키워드는 100자 이하로 입력해주세요." };
  const words = (v: unknown, except: string) =>
    (Array.isArray(v) ? v : []).map((s) => String(s).trim()).filter((s) => s && s.length <= 50 && s !== except);
  // 한국어 칸에 들어온 영어 단어는 영어 칸으로 (예전 화면·API로 저장해도 같은 모양이 되게)
  const split = splitKeywordLang(words(body?.synonyms, keyword), words(body?.synonyms_en, keywordEn));
  const synonyms = Array.from(new Set(split.synonyms));
  const synonymsEn = split.synonyms_en.filter((s) => s.toLowerCase() !== keywordEn.toLowerCase());
  if (synonyms.length > MAX_SYNONYMS) return { error: `연관 단어는 ${MAX_SYNONYMS}개까지 등록할 수 있습니다.` };
  if (synonymsEn.length > MAX_SYNONYMS) return { error: `영어 단어는 ${MAX_SYNONYMS}개까지 등록할 수 있습니다.` };
  const pinnedRaw: unknown[] = Array.isArray(body?.pinned_faq_ids) ? body.pinned_faq_ids : [];
  const pinned = Array.from(new Set(pinnedRaw.map(Number).filter((n) => Number.isInteger(n) && n > 0)));
  if (pinned.length > MAX_PINNED) return { error: `고정 FAQ는 ${MAX_PINNED}개까지 지정할 수 있습니다.` };
  const srcRaw: unknown[] = Array.isArray(body?.search_sources) ? body.search_sources : [];
  const sources = Array.from(new Set(srcRaw.map((x) => String(x).trim()).filter((x) => x && x.length <= 100)));
  if (sources.length > MAX_SOURCES) return { error: `먼저 찾아볼 곳은 ${MAX_SOURCES}개까지 고를 수 있습니다.` };
  return {
    rule: { keyword, keyword_en: keywordEn || null, synonyms, synonyms_en: synonymsEn, pinned_faq_ids: pinned, search_sources: sources },
  };
}

async function missingFaqIds(ids: number[]): Promise<number[]> {
  if (!ids.length) return [];
  const [rows] = await Pool.query<RowDataPacket[]>(`SELECT id FROM faqs WHERE id IN (?)`, [ids]);
  const found = new Set(rows.map((r) => Number(r.id)));
  return ids.filter((id) => !found.has(id));
}

// @route   GET api/keywords/sources
// @desc    '먼저 찾아볼 곳' 선택지 (RAG 서버 목록, 못 받으면 빈 목록)
// @access  Private
router.get("/sources", auth, async (_req: Request, res: Response) => {
  try {
    const r = await fetch(`${env.RAG_URL}/search/sources`, { signal: AbortSignal.timeout(2000) });
    const body: any = await r.json();
    res.status(200).json({ statusCode: 200, message: "Search sources", data: { sources: body.sources ?? [] } });
  } catch {
    res.status(200).json({ statusCode: 200, message: "Search sources unavailable", data: { sources: [] } });
  }
});

// @route   GET api/keywords
// @desc    키워드 규칙 목록 (고정 FAQ 질문 포함)
// @access  Private
router.get("/", auth, async (_req: Request, res: Response) => {
  try {
    const [rows] = await Pool.query<RowDataPacket[]>(
      `SELECT id, keyword, keyword_en, synonyms, synonyms_en, pinned_faq_ids, search_sources, updated_at FROM keyword_rules ORDER BY keyword`
    );
    const rules = rows.map((r) => ({
      id: r.id,
      keyword: r.keyword,
      keyword_en: r.keyword_en || null,
      // 예전 줄(synonyms에 영어가 섞임)도 한국어·영어로 나눠서
      ...splitKeywordLang(parseJson<string[]>(r.synonyms, []).map(String), parseJson<string[]>(r.synonyms_en, []).map(String)),
      pinned_faq_ids: parseJson<number[]>(r.pinned_faq_ids, []),
      search_sources: parseJson<string[]>(r.search_sources, []),
      updated_at: r.updated_at,
    }));
    const ids = Array.from(new Set(rules.flatMap((r) => r.pinned_faq_ids)));
    const questions: Record<number, { ko: string; en: string | null }> = {};
    if (ids.length) {
      const [faqs] = await Pool.query<RowDataPacket[]>(`SELECT id, question_ko, question_en FROM faqs WHERE id IN (?)`, [ids]);
      faqs.forEach((f) => (questions[Number(f.id)] = { ko: f.question_ko, en: f.question_en || null }));
    }
    res.status(200).json({
      statusCode: 200,
      message: "Keyword rules retrieved successfully",
      data: {
        rules: rules.map((r) => ({
          ...r,
          pinned_faqs: r.pinned_faq_ids.map((id) => ({
            faq_id: id,
            question_ko: questions[id]?.ko ?? null,
            question_en: questions[id]?.en ?? null,
          })),
        })),
      },
    });
  } catch (err: any) {
    console.error(err.message);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  }
});

// @route   POST api/keywords
// @access  Private
router.post("/", auth, async (req: Request, res: Response) => {
  const { rule, error } = clean(req.body);
  if (!rule) return res.status(400).json({ statusCode: 400, message: error });
  try {
    const missing = await missingFaqIds(rule.pinned_faq_ids);
    if (missing.length) return res.status(400).json({ statusCode: 400, message: `없는 FAQ입니다: ${missing.join(", ")}` });
    const [result] = await Pool.query<ResultSetHeader>(
      `INSERT INTO keyword_rules (keyword, keyword_en, synonyms, synonyms_en, pinned_faq_ids, search_sources, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [rule.keyword, rule.keyword_en, JSON.stringify(rule.synonyms), JSON.stringify(rule.synonyms_en),
        JSON.stringify(rule.pinned_faq_ids), JSON.stringify(rule.search_sources), req.user_id ?? null]
    );
    res.status(200).json({ statusCode: 200, message: "Keyword rule created", data: { id: result.insertId } });
  } catch (err: any) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ statusCode: 409, message: "이미 등록된 대표 키워드입니다." });
    }
    console.error(err.message);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  }
});

// @route   PUT api/keywords/:id
// @access  Private
router.put("/:id", auth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { rule, error } = clean(req.body);
  if (!rule) return res.status(400).json({ statusCode: 400, message: error });
  try {
    const missing = await missingFaqIds(rule.pinned_faq_ids);
    if (missing.length) return res.status(400).json({ statusCode: 400, message: `없는 FAQ입니다: ${missing.join(", ")}` });
    const [result] = await Pool.query<ResultSetHeader>(
      `UPDATE keyword_rules SET keyword = ?, keyword_en = ?, synonyms = ?, synonyms_en = ?, pinned_faq_ids = ?, search_sources = ?, updated_by = ? WHERE id = ?`,
      [rule.keyword, rule.keyword_en, JSON.stringify(rule.synonyms), JSON.stringify(rule.synonyms_en),
        JSON.stringify(rule.pinned_faq_ids), JSON.stringify(rule.search_sources), req.user_id ?? null, id]
    );
    if (!result.affectedRows) return res.status(404).json({ statusCode: 404, message: "Keyword rule not found" });
    res.status(200).json({ statusCode: 200, message: "Keyword rule updated" });
  } catch (err: any) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ statusCode: 409, message: "이미 등록된 대표 키워드입니다." });
    }
    console.error(err.message);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  }
});

// @route   DELETE api/keywords/:id
// @access  Private
router.delete("/:id", auth, async (req: Request, res: Response) => {
  try {
    const [result] = await Pool.query<ResultSetHeader>(`DELETE FROM keyword_rules WHERE id = ?`, [Number(req.params.id)]);
    if (!result.affectedRows) return res.status(404).json({ statusCode: 404, message: "Keyword rule not found" });
    res.status(200).json({ statusCode: 200, message: "Keyword rule deleted" });
  } catch (err: any) {
    console.error(err.message);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  }
});

export default router;
