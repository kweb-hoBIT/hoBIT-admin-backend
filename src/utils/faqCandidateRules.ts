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

// ── 욕설 가리기 ─────────────────────────────────────────────
// AI 거르기(욕설·장난 질문 버림)를 지나 남은 질문 속 욕설을 한 번 더 가림 — 저장할 때와 화면에 보낼 때
// 단어 목록은 여기 한 곳에만 (고칠 때 tests/utils/faqCandidateRules.test.ts도 같이)
//   한국어: 글자 사이에 기호를 끼워 써도 잡음 ("ㅅ.ㅂ", "씨*발") — 띄어쓰기는 허용 안 함 ("몇 시 발표"가 걸려서)
//   '시발점'·'시발표'(몇시발표)처럼 뜻이 다른 말은 뺌. '시바'·'애미'·'니미'는 다른 말 속에 너무 자주 나와 넣지 않음
const KO_PROFANITY = [
  '씨발', '씨바', '씨빨', '시발(?![점표령전])', 'ㅅㅂ', 'ㅆㅂ', '씹', '좆', '좃', '존나', '졸라', 'ㅈㄴ', '병신', 'ㅂㅅ', '븅신',
  '개새끼', '개새기', '새끼', '쌔끼', '미친놈', '미친년', '미친새끼', '지랄', 'ㅈㄹ', '닥쳐', '꺼져', '엿먹', '느금마', '니애미',
  '썅', '개같',
  // 비하·모욕·혐오 표현 (채팅 욕설 검사 hoBIT-backend/src/chat/moderation.ts와 같은 목록 — 일상어와 겹치는 말은 뒤 글자까지)
  '바보(?!상자)', '멍청', '멍텅구리', '등신', '머저리', '찐따', '찌질', '돌대가리', '닭대가리', '새대가리', '빡대가리', '저능', '꼴통', '띨띨',
  '모지리', '얼간이', '무뇌', '한심하', '한심한', '재수없', '싸가지', '개빡', '개소리', '쓰레기같', '쓰레기야', '쓰레기네', '정신병자', '정신나간',
  '틀딱', '한남충', '급식충', '맘충', '김치녀', '된장녀', '니미', '느개비',
];
const EN_PROFANITY = [
  'fuck\\w*', 'motherfuck\\w*', 'shit\\w*', 'bitch\\w*', 'asshole\\w*', 'bastard\\w*', 'cunt\\w*', 'dick', 'dickhead', 'wtf', 'stfu',
  'idiot\\w*', 'stupid\\w*', 'moron\\w*', 'dumbass\\w*', 'dumb', 'imbecile\\w*', 'loser\\w*', 'jerk\\w*', 'scumbag\\w*', 'retard\\w*', 'whore\\w*', 'slut\\w*',
  'shut\\s+up', 'screw\\s+you', 'you\\s+suck',
];
const PROFANITY_MASK = '●●';

// 한 글자씩 사이에 기호 허용 (뒤에 붙은 (?!점) 같은 조건은 그대로)
const spaced = (w: string) => {
  const m = /^(.*?)(\(\?.*\))?$/.exec(w)!;
  return [...m[1]].join('[.\\-_*~]*') + (m[2] ?? '');
};
const PROFANITY_RE = new RegExp(
  `(${KO_PROFANITY.map(spaced).join('|')})|\\b(${EN_PROFANITY.join('|')})\\b`,
  'gi',
);

/** 욕설을 ●●로 */
export function maskProfanity(text: string): string {
  return String(text ?? '').replace(PROFANITY_RE, PROFANITY_MASK);
}

// ── 주제별 묶음 ─────────────────────────────────────────────
export const OTHER_TOPIC = { id: 'other', name: '기타' };

export type TopicCandidateRow = {
  id: number;
  question: string;
  ask_count: number;
  topic_id?: string | null;
  topic_name?: string | null;
  subtopic?: string | null;
  [key: string]: any;
};
export type SubtopicNode<T> = { name: string; count: number; candidates: T[] };
export type TopicNode<T> = {
  topic: { id: string; name: string };
  count: number; // 물은 횟수 합
  candidates_count: number;
  subtopics: SubtopicNode<T>[];
};

/** 후보 목록 → 주제 → 하위 주제 → 후보 (모두 물은 횟수 많은 순, '기타'는 같은 횟수면 뒤로) */
export function buildTopicTree<T extends TopicCandidateRow>(rows: T[]): TopicNode<T>[] {
  const topics = new Map<string, TopicNode<T> & { subs: Map<string, SubtopicNode<T>> }>();
  for (const r of rows) {
    const id = r.topic_id || OTHER_TOPIC.id;
    const name = r.topic_name || OTHER_TOPIC.name;
    let t = topics.get(id);
    if (!t) {
      t = { topic: { id, name }, count: 0, candidates_count: 0, subtopics: [], subs: new Map() };
      topics.set(id, t);
    }
    const subName = (r.subtopic || '').trim() || OTHER_TOPIC.name;
    let s = t.subs.get(subName);
    if (!s) {
      s = { name: subName, count: 0, candidates: [] };
      t.subs.set(subName, s);
    }
    const n = Number(r.ask_count) || 0;
    s.count += n;
    s.candidates.push(r);
    t.count += n;
    t.candidates_count += 1;
  }
  const otherLast = (a: string, b: string) => (a === OTHER_TOPIC.name ? 1 : 0) - (b === OTHER_TOPIC.name ? 1 : 0);
  return [...topics.values()]
    .map(({ subs, ...t }) => ({
      ...t,
      subtopics: [...subs.values()]
        .map((s) => ({ ...s, candidates: [...s.candidates].sort((a, b) => b.ask_count - a.ask_count || b.id - a.id) }))
        .sort((a, b) => b.count - a.count || otherLast(a.name, b.name) || a.name.localeCompare(b.name, 'ko')),
    }))
    .sort((a, b) => b.count - a.count || otherLast(a.topic.name, b.topic.name) || a.topic.name.localeCompare(b.topic.name, 'ko'));
}
