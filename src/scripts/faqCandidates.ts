import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { OpenAI } from "openai";
import { Pool } from "../../config/connectDB";
import env from "../../config/env";
import {
  groupByExactText,
  isTrivialQuestion,
  mergeSamples,
  normalizeQuestion,
  parseFilterResponse,
  parseSamples,
  pickRepresentative,
  Sample,
} from "../utils/faqCandidateRules";

/**
 * FAQ 후보 모으기 — 밤 12시 (scripts/cronJobs.ts), 관리자 'FAQ 후보' 화면의 POST /api/faq-candidates/run
 *   1) 답을 못 찾은 질문(question_logs answer_status='not_found', 아직 안 본 것)을 가져옴
 *   2) 규칙: 비었거나 한 글자면 버림 / 글자가 같은 질문은 한 번만 AI에 보냄
 *   3) AI(gpt-4o-mini, 50개씩): 챗봇과 상관없는 질문 거르기 + 영어 → 한국어. 응답을 못 읽으면 그 묶음은 그대로 둠
 *   4) RAG(POST /faq_candidates/analyze): 기존 후보에 붙일지, 새 질문끼리 어떻게 묶을지, 비슷한 FAQ가 있는지
 *      RAG가 꺼져 있으면 글자가 같은 것만 묶음
 *   5) 후보 표(faq_candidates)에 합치거나 새로 만들고, 가져온 질문을 '살펴봄'(ismatched=1)으로
 * 예전 방식(user_feedbacks에 매일 한 줄씩)은 같은 질문이 날마다 다시 쌓이고 몇 명이 물었는지 몰라서 바꿈
 */

const openai = new OpenAI({ apiKey: env.OPENAI_KEY });

const LLM_CHUNK = 50;
const MAX_LOGS_PER_RUN = 2000; // RAG 한 번에 받는 수 — 넘치면 다음 실행에서 이어서
const RAG_TIMEOUT_MS = 120_000;

type LogRow = { id: number; user_question: string; language: string; created_at: Date };
type SimilarFaq = { faq_id: number | null; question: string; score: number; senior: boolean } | null;
type Group = { existing_id: number | null; cluster: number | null; similar_faq?: SimilarFaq };
export type RunSummary = {
  logs: number;
  dropped: number;
  merged: number;
  created: number;
  rag: boolean;
};

let running = false;
export const isFaqCandidatesRunning = () => running;

const FILTER_PROMPT = `당신은 대학(고려대학교 정보대학) 학생용 챗봇의 질문 정리 도우미입니다.
입력: {"items":[{"i":번호,"q":"학생 질문"}]}
각 질문마다 다음을 판단해 같은 번호로 돌려주세요.
- keep: 대학 생활·학사·행정·시설·장학·진로 등 챗봇이 답해야 할 실질적인 질문이면 true.
        욕설·성적인 내용·정치 발언, 의미 없는 글자, 챗봇과 상관없는 잡담, AI 자체에 대한 질문이면 false.
        애매하면 true.
- ko: 질문을 자연스러운 한국어로. 이미 한국어면 원문 그대로(맞춤법만 고치지 말고 그대로). 영어 등 다른 언어면 한국어로 번역.
질문을 합치거나 빼지 말고, 입력한 모든 번호를 돌려주세요.
응답 형식(JSON): {"items":[{"i":0,"keep":true,"ko":"..."}]}`;

/** AI로 거르기·번역 — 50개씩. 실패한 묶음은 그대로 남김 (지우지 않음) */
async function filterAndTranslate(texts: string[]): Promise<{ keep: boolean; ko: string }[]> {
  const out: { keep: boolean; ko: string }[] = [];
  for (let k = 0; k < texts.length; k += LLM_CHUNK) {
    const part = texts.slice(k, k + LLM_CHUNK);
    let raw: string | null | undefined = null;
    try {
      const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: FILTER_PROMPT },
          { role: "user", content: JSON.stringify({ items: part.map((q, i) => ({ i, q })) }) },
        ],
      });
      raw = res.choices[0]?.message?.content;
    } catch (e: any) {
      console.error("[faqCandidates] AI 거르기 실패 — 이 묶음은 그대로 둠:", e?.message);
    }
    out.push(...parseFilterResponse(raw, part));
  }
  return out;
}

/** RAG에 묶기·비슷한 FAQ 묻기 — 실패하면 null */
async function analyzeWithRag(
  questions: string[],
  existing: { id: number; question: string }[],
): Promise<{ results: Group[]; existing: { id: number; similar_faq: SimilarFaq }[] } | null> {
  try {
    const r = await fetch(`${env.RAG_URL}/faq_candidates/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions, existing }),
      signal: AbortSignal.timeout(RAG_TIMEOUT_MS),
    });
    if (!r.ok) throw new Error(`RAG ${r.status}`);
    const body: any = await r.json();
    if (!Array.isArray(body?.results) || body.results.length !== questions.length) throw new Error("RAG 응답 형식");
    return { results: body.results, existing: Array.isArray(body.existing) ? body.existing : [] };
  } catch (e: any) {
    console.error("[faqCandidates] RAG 묶기 실패 — 글자가 같은 것만 묶음:", e?.message);
    return null;
  }
}

/** 검색 데이터에 FAQ 번호가 없을 때(예전 데이터) 질문 문장으로 찾음 */
async function resolveFaqId(conn: PoolConnection, s: SimilarFaq): Promise<number | null> {
  if (!s) return null;
  if (s.faq_id) return Number(s.faq_id);
  const [rows] = s.senior
    ? await conn.query<RowDataPacket[]>(`SELECT id FROM senior_faqs WHERE detailcategory_ko = ? LIMIT 1`, [s.question])
    : await conn.query<RowDataPacket[]>(`SELECT id FROM faqs WHERE question_ko = ? LIMIT 1`, [s.question]);
  return rows[0]?.id ?? null;
}

async function similarColumns(conn: PoolConnection, s: SimilarFaq) {
  const id = await resolveFaqId(conn, s);
  return s && id
    ? [id, s.question.slice(0, 300), s.senior ? 1 : 0, s.score]
    : [null, null, 0, null];
}

const iso = (d: Date | string) => new Date(d).toISOString();

export async function runFaqCandidates(): Promise<RunSummary | null> {
  if (running) return null;
  running = true;
  let conn: PoolConnection | null = null;
  const summary: RunSummary = { logs: 0, dropped: 0, merged: 0, created: 0, rag: false };
  try {
    conn = await Pool.getConnection();
    // 답한 질문·FAQ 클릭·예전 기록은 살펴본 것으로 표시만
    await conn.execute(
      `UPDATE question_logs SET ismatched = 1 WHERE ismatched = 0 AND (answer_status IS NULL OR answer_status <> 'not_found')`,
    );
    const [logRows] = await conn.query<RowDataPacket[]>(
      `SELECT id, user_question, language, created_at FROM question_logs
        WHERE ismatched = 0 AND answer_status = 'not_found' ORDER BY id LIMIT ?`,
      [MAX_LOGS_PER_RUN],
    );
    const logs = logRows as LogRow[];
    summary.logs = logs.length;
    if (!logs.length) return summary;

    // 규칙 먼저 — 빈·한 글자 질문은 버리고, 글자가 같은 질문은 AI에 한 번만
    const kept = logs.filter((l) => !isTrivialQuestion(l.user_question));
    const uniq: string[] = [];
    const uniqIndex = new Map<string, number>();
    for (const l of kept) {
      const key = normalizeQuestion(l.user_question);
      if (!uniqIndex.has(key)) {
        uniqIndex.set(key, uniq.length);
        uniq.push(l.user_question.trim());
      }
    }
    const filtered = await filterAndTranslate(uniq);

    // 남길 질문 (한국어 문장 기준) — 같은 한국어 문장끼리 다시 모음
    type Item = { ko: string; logs: LogRow[] };
    const items: Item[] = [];
    const itemByKo = new Map<string, Item>();
    for (const l of kept) {
      const f = filtered[uniqIndex.get(normalizeQuestion(l.user_question))!];
      if (!f.keep) continue;
      const key = normalizeQuestion(f.ko);
      if (!key || key.length <= 1) continue;
      let it = itemByKo.get(key);
      if (!it) {
        it = { ko: f.ko, logs: [] };
        itemByKo.set(key, it);
        items.push(it);
      }
      it.logs.push(l);
    }
    summary.dropped = logs.length - items.reduce((n, it) => n + it.logs.length, 0);

    // 기존 후보 — 열림·제외 (제외한 질문이 또 들어와도 다시 열리지 않게). 완료한 후보는 빼서
    // FAQ를 만든 뒤에도 같은 질문이 못 찾음으로 남으면 새 후보로 떠서 '비슷한 FAQ 있음(검색이 놓침)'으로 보이게
    const [candRows] = await conn.query<RowDataPacket[]>(
      `SELECT id, question FROM faq_candidates WHERE status IN ('open', 'dismissed')`,
    );
    const existing = candRows.map((r) => ({ id: Number(r.id), question: String(r.question) }));
    const questions = items.map((it) => it.ko);
    const rag = questions.length || existing.length ? await analyzeWithRag(questions, existing) : null;
    summary.rag = !!rag;
    const groups: Group[] = rag ? rag.results : groupByExactText(questions, existing);

    await conn.beginTransaction();
    try {
      // 기존 후보에 합치기
      const toExisting = new Map<number, Item[]>();
      const toCluster = new Map<number, number[]>(); // 묶음 번호 → items 위치
      groups.forEach((g, i) => {
        if (g.existing_id != null && existing.some((e) => e.id === g.existing_id)) {
          toExisting.set(g.existing_id, [...(toExisting.get(g.existing_id) ?? []), items[i]]);
        } else {
          const c = g.cluster ?? -1 - i; // 묶음 번호가 없으면 혼자 한 묶음
          toCluster.set(c, [...(toCluster.get(c) ?? []), i]);
        }
      });

      const samplesOf = (its: Item[]): Sample[] =>
        its.flatMap((it) => it.logs.map((l) => ({ text: l.user_question.trim(), language: l.language || "KO", at: iso(l.created_at) })));
      const range = (its: Item[]) => {
        const times = its.flatMap((it) => it.logs.map((l) => new Date(l.created_at).getTime()));
        return [new Date(Math.min(...times)), new Date(Math.max(...times))];
      };

      for (const [id, its] of toExisting) {
        const [rows] = await conn.query<RowDataPacket[]>(`SELECT samples FROM faq_candidates WHERE id = ? FOR UPDATE`, [id]);
        if (!rows.length) continue;
        const n = its.reduce((s, it) => s + it.logs.length, 0);
        const [first, last] = range(its);
        await conn.query(
          `UPDATE faq_candidates
              SET ask_count = ask_count + ?, samples = ?,
                  first_asked_at = LEAST(COALESCE(first_asked_at, ?), ?), last_asked_at = GREATEST(COALESCE(last_asked_at, ?), ?)
            WHERE id = ?`,
          [n, JSON.stringify(mergeSamples(parseSamples(rows[0].samples), samplesOf(its))), first, first, last, last, id],
        );
        summary.merged += 1;
      }

      for (const idxs of toCluster.values()) {
        const its = idxs.map((i) => items[i]);
        // 대표 문장 — 학생이 가장 많이 쓴 한국어 문장, 같으면 짧은 것 (규칙)
        const rep = pickRepresentative(its.flatMap((it) => it.logs.map(() => it.ko)));
        const repIdx = idxs.find((i) => normalizeQuestion(items[i].ko) === normalizeQuestion(rep)) ?? idxs[0];
        const [first, last] = range(its);
        await conn.query(
          `INSERT INTO faq_candidates
             (question, ask_count, samples, first_asked_at, last_asked_at, similar_faq_id, similar_faq_question, similar_faq_senior, similar_score)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rep.slice(0, 300), its.reduce((s, it) => s + it.logs.length, 0), JSON.stringify(mergeSamples([], samplesOf(its))),
            first, last, ...(await similarColumns(conn, groups[repIdx]?.similar_faq ?? null))],
        );
        summary.created += 1;
      }

      // 기존 후보의 비슷한 FAQ 새로 — 그사이 FAQ를 추가했으면 바로 보이게
      for (const e of rag?.existing ?? []) {
        await conn.query(
          `UPDATE faq_candidates SET similar_faq_id = ?, similar_faq_question = ?, similar_faq_senior = ?, similar_score = ?,
                  updated_at = updated_at WHERE id = ?`,
          [...(await similarColumns(conn, e.similar_faq ?? null)), Number(e.id)],
        );
      }

      // 가져온 질문만 '살펴봄' (작업 중에 새로 들어온 질문은 다음에)
      await conn.query(`UPDATE question_logs SET ismatched = 1 WHERE id IN (?)`, [logs.map((l) => l.id)]);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    }
    console.log("[faqCandidates] 완료:", summary);
    return summary;
  } finally {
    conn?.release();
    running = false;
  }
}
