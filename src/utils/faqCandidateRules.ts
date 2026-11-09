/**
 * FAQ 후보 규칙 (DB·네트워크 없음) — 밤 12시 작업(scripts/faqCandidates.ts)과 처음 옮기기(config/createDB.ts)가 같이 씀
 *   npx jest tests/utils/faqCandidateRules.test.ts
 */

/** 예전 밤 작업이 user_feedbacks에 넣던 기록의 이유 문구 — 학생이 직접 남긴 피드백과 구분할 때 씀 (대시보드·피드백 목록) */
export const AUTO_FEEDBACK_REASON = 'AI가 유저 질문과 매칭되는 FAQ가 없는것을 발견';

/** 후보 하나에 남기는 학생 원래 문장 수 */
export const MAX_SAMPLES = 8;

export type Sample = { text: string; language: string; at: string };

/** 띄어쓰기·문장부호를 빼고 소문자로 — RAG(hoBIT-rag src/utils/faq_candidates.py normalize)와 같은 규칙 */
export function normalizeQuestion(text: string): string {
  return String(text ?? '').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, '');
}

/** 규칙으로 바로 버릴 질문 — 비었거나 한 글자 (LLM에 보낼 필요 없음) */
export function isTrivialQuestion(text: string): boolean {
  return normalizeQuestion(text).length <= 1;
}

/** 예전 자동 피드백 문구 `'질문' 질문을 추가해주세요!`에서 질문만 */
export function parseAutoFeedbackDetail(detail: string): string | null {
  const m = /^\s*'([\s\S]*)'\s*질문을 추가해주세요!?\s*$/.exec(String(detail ?? ''));
  const q = m ? m[1].trim() : '';
  return q && !isTrivialQuestion(q) ? q : null;
}

/** 묶음의 대표 문장 — 가장 많이 나온 문장(정규화 기준), 같으면 짧은 것, 그래도 같으면 먼저 나온 것 (LLM 없음) */
export function pickRepresentative(texts: string[]): string {
  const stats = new Map<string, { text: string; n: number; first: number }>();
  texts.forEach((t, i) => {
    const text = String(t ?? '').trim();
    if (!text) return;
    const key = normalizeQuestion(text);
    const s = stats.get(key);
    if (s) {
      s.n += 1;
      if (text.length < s.text.length) s.text = text;
    } else stats.set(key, { text, n: 1, first: i });
  });
  const best = [...stats.values()].sort((a, b) => b.n - a.n || a.text.length - b.text.length || a.first - b.first)[0];
  return best?.text ?? '';
}

/** 원래 문장 합치기 — 같은 문장(정규화 기준)은 최근 것 하나만, 최근 순으로 MAX_SAMPLES개 */
export function mergeSamples(old: Sample[], added: Sample[], max = MAX_SAMPLES): Sample[] {
  const all = [...added, ...old]
    .filter((s) => s && String(s.text ?? '').trim())
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const seen = new Set<string>();
  const out: Sample[] = [];
  for (const s of all) {
    const key = normalizeQuestion(s.text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text: String(s.text).trim(), language: s.language || 'KO', at: s.at });
    if (out.length >= max) break;
  }
  return out;
}

export function parseSamples(v: unknown): Sample[] {
  try {
    const arr = typeof v === 'string' ? JSON.parse(v) : v;
    return Array.isArray(arr) ? arr.filter((s) => s && typeof s.text === 'string') : [];
  } catch {
    return [];
  }
}

/** LLM 응답(JSON) → 입력 순서대로 {keep, ko}. 못 읽은 칸은 그대로 남김 (지우지 않음) */
export function parseFilterResponse(raw: string | null | undefined, inputs: string[]): { keep: boolean; ko: string }[] {
  const fallback = inputs.map((q) => ({ keep: true, ko: q }));
  let parsed: any;
  try {
    parsed = JSON.parse(String(raw ?? ''));
  } catch {
    return fallback;
  }
  const items: any[] = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
  const byIndex = new Map<number, any>();
  items.forEach((it, k) => {
    const i = Number.isInteger(it?.i) ? it.i : k;
    if (i >= 0 && i < inputs.length && !byIndex.has(i)) byIndex.set(i, it);
  });
  return inputs.map((q, i) => {
    const it = byIndex.get(i);
    if (!it) return { keep: true, ko: q };
    const ko = typeof it.ko === 'string' && it.ko.trim() ? it.ko.trim().slice(0, 300) : q;
    return { keep: it.keep !== false, ko };
  });
}

/** RAG를 못 쓸 때 — 정규화한 글자가 같은 것만 기존 후보에 붙이고, 나머지는 같은 글자끼리 묶음 */
export function groupByExactText(
  questions: string[],
  existing: { id: number; question: string }[],
): { existing_id: number | null; cluster: number | null }[] {
  const byNorm = new Map<string, number>();
  existing.forEach((e) => {
    const k = normalizeQuestion(e.question);
    if (!byNorm.has(k)) byNorm.set(k, e.id);
  });
  const clusters = new Map<string, number>();
  return questions.map((q) => {
    const k = normalizeQuestion(q);
    if (byNorm.has(k)) return { existing_id: byNorm.get(k)!, cluster: null };
    if (!clusters.has(k)) clusters.set(k, clusters.size);
    return { existing_id: null, cluster: clusters.get(k)! };
  });
}
