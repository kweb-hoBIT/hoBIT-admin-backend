/**
 * '키워드 규칙' 시트 (keyword_rules) — 규칙 하나가 한 줄
 *   번호 | 대표 키워드 | 연관 단어 (쉼표로 구분) | 고정 FAQ 번호 (쉼표, 최대 3개) | 고정 FAQ 질문 (읽기만) | 먼저 찾아볼 곳 (쉼표로 구분) | 삭제
 *   '고정 FAQ 질문'은 어떤 FAQ인지 보여 주는 칸이라 올릴 때는 읽지 않아요
 *   '먼저 찾아볼 곳'은 출처 이름(한국어)으로 보여 주고, 올릴 때는 이름이나 id 모두 받아요 (선택지는 RAG GET /search/sources)
 * 관리자 사이트 키워드 규칙 화면(src/routes/api/keywords/keywordsIndex.ts)과 같은 규칙으로 확인해요
 */
import ExcelJS from 'exceljs';
import { addListValidation, addStyledSheet, cellText, Change, DELETE_MARK, inSheet, Issue, normLine } from './faqExcel';
import {
  byRow,
  dedupLoose,
  findLooseColumns,
  missingHeaderMessage,
  nameKey,
  parseJsonList,
  READONLY_FONT,
  readIdCell,
  SimplePlan,
  splitList,
} from './sheetHelpers';

export const KEYWORD_SHEET = '키워드 규칙';
const SHEET = KEYWORD_SHEET;
export const MAX_KEYWORD_PINNED = 3;
const MAX_SYNONYMS = 50;
const MAX_SOURCES = 6;

export interface KeywordRuleDbRow {
  id: number;
  keyword: string;
  synonyms: unknown; // JSON 글자 또는 배열
  pinned_faq_ids: unknown;
  search_sources: unknown;
  [key: string]: any;
}

/** RAG GET /search/sources 한 줄 */
export interface SearchSource {
  id: string;
  label: string;
  group?: string;
}

export interface KeywordView {
  keyword: string;
  synonyms: string[];
  pinned: number[]; // 고정 FAQ 번호 (순서대로)
  sources: string[]; // 먼저 찾아볼 곳 id
}

export interface ParsedKeyword {
  row: number;
  id: number | null;
  badId: boolean;
  del: boolean;
  keyword: string;
  synonyms: string[];
  pinnedTokens: string[];
  sourceTokens: string[];
}

export type KeywordPlan = SimplePlan<KeywordView>;

type Key = 'id' | 'keyword' | 'synonyms' | 'pinned' | 'pinned_q' | 'sources' | 'delete';
export const KEYWORD_COLUMNS: { key: Key; header: string; match: string; width: number; numeric?: boolean }[] = [
  { key: 'id', header: '번호', match: '번호', width: 7, numeric: true },
  { key: 'keyword', header: '대표 키워드', match: '대표키워드', width: 16 },
  { key: 'synonyms', header: '연관 단어 (쉼표로 구분)', match: '연관단어', width: 40 },
  { key: 'pinned', header: `고정 FAQ 번호 (쉼표, 최대 ${MAX_KEYWORD_PINNED}개)`, match: '고정FAQ번호', width: 16 },
  { key: 'pinned_q', header: '고정 FAQ 질문 (읽기만)', match: '고정FAQ질문', width: 44 },
  { key: 'sources', header: '먼저 찾아볼 곳 (쉼표로 구분)', match: '먼저찾아볼곳', width: 34 },
  { key: 'delete', header: '삭제', match: '삭제', width: 8 },
];

// ───────────────────────── DB 줄 ↔ 엑셀 모양 ─────────────────────────

export function keywordRowToView(r: KeywordRuleDbRow): KeywordView {
  const keyword = normLine(r.keyword);
  return {
    keyword,
    synonyms: dedupLoose(parseJsonList(r.synonyms).map((s) => normLine(s)), [keyword]),
    pinned: [...new Set(parseJsonList(r.pinned_faq_ids).map(Number).filter((n) => Number.isInteger(n) && n > 0))],
    sources: [...new Set(parseJsonList(r.search_sources).map((s) => normLine(s)).filter(Boolean))],
  };
}

const sourceLabel = (sources: SearchSource[] | null | undefined) => {
  const m = new Map((sources ?? []).map((s) => [s.id, s.label]));
  return (id: string) => m.get(id) ?? id;
};

// ───────────────────────── 엑셀 만들기 ─────────────────────────

export function addKeywordSheet(
  wb: ExcelJS.Workbook,
  rules: KeywordRuleDbRow[],
  faqs: { id: number; question_ko: string }[],
  sources: SearchSource[] | null | undefined
): ExcelJS.Worksheet {
  const ws = addStyledSheet(wb, SHEET, KEYWORD_COLUMNS.map((c) => ({ key: c.key, header: c.header, width: c.width, numeric: c.numeric })));
  const question = new Map(faqs.map((f) => [Number(f.id), normLine(f.question_ko)]));
  const label = sourceLabel(sources);
  const views = rules.map((r) => ({ id: Number(r.id), v: keywordRowToView(r) })).sort((a, b) => a.v.keyword.localeCompare(b.v.keyword, 'ko'));
  const qCol = KEYWORD_COLUMNS.findIndex((c) => c.key === 'pinned_q') + 1;
  for (const { id, v } of views) {
    const row = ws.addRow({
      id,
      keyword: v.keyword,
      synonyms: v.synonyms.join(', '),
      pinned: v.pinned.join(', '),
      pinned_q: v.pinned.map((n) => `${n}. ${question.get(n) ?? '(없는 FAQ)'}`).join('\n'),
      sources: v.sources.map(label).join(', '),
      delete: '',
    });
    row.getCell(qCol).font = READONLY_FONT;
  }
  ws.getRow(1).getCell(qCol).font = { bold: true, color: READONLY_FONT.color };
  ws.getRow(1).getCell(qCol).note = '어떤 FAQ인지 보여 주는 칸이에요. 고쳐도 반영되지 않아요. 고정 FAQ는 왼쪽 번호 칸에서 바꿔요.';
  if (sources?.length) {
    const sCol = KEYWORD_COLUMNS.findIndex((c) => c.key === 'sources') + 1;
    ws.getRow(1).getCell(sCol).note = `쓸 수 있는 이름 (쉼표로 여러 개):\n${sources.map((s) => `• ${s.label}`).join('\n')}`;
  }
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];
  addListValidation(ws, KEYWORD_COLUMNS.findIndex((c) => c.key === 'delete') + 1, [DELETE_MARK], '삭제', "규칙을 지우려면 '삭제'를 골라 주세요.");
  return ws;
}

// ───────────────────────── 엑셀 읽기 ─────────────────────────

export function parseKeywordSheet(ws: ExcelJS.Worksheet | undefined): { items: ParsedKeyword[]; problems: Issue[]; warnings: Issue[] } | null {
  if (!ws) return null;
  const problems: Issue[] = [];
  const items: ParsedKeyword[] = [];
  const done = () => ({ items, problems: problems.map(inSheet(SHEET)), warnings: [] as Issue[] });

  const colOf = findLooseColumns(ws, KEYWORD_COLUMNS);
  const need: Key[] = ['id', 'keyword', 'synonyms', 'pinned', 'sources'];
  const missing = KEYWORD_COLUMNS.filter((c) => need.includes(c.key) && !colOf[c.key]).map((c) => c.header);
  if (missing.length) {
    problems.push({ row: 1, message: missingHeaderMessage(missing) });
    return done();
  }
  const readKeys: Key[] = ['id', 'keyword', 'synonyms', 'pinned', 'sources', 'delete'];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const text = (k: Key) => (colOf[k] ? cellText(row.getCell(colOf[k]!).value) : '');
    if (readKeys.every((k) => normLine(text(k)) === '')) continue;

    const idText = normLine(text('id'));
    const { id, badId } = readIdCell(idText);
    const keyword = normLine(text('keyword'));
    const delText = normLine(text('delete'));
    if (badId) problems.push({ row: r, message: `번호 칸('${idText}')을 읽지 못했어요. 번호 칸은 고치지 말고, 새 규칙은 번호를 비워 주세요.` });
    let del = false;
    if (delText === DELETE_MARK) del = true;
    else if (delText) problems.push({ row: r, message: `삭제 칸에는 '삭제'만 쓸 수 있어요. (지금: '${delText}')` });
    if (!keyword && !del) {
      problems.push({ row: r, message: '대표 키워드가 비어 있어요. 대표 키워드를 적어 주세요.' });
      continue;
    }
    items.push({
      row: r,
      id,
      badId,
      del,
      keyword,
      synonyms: splitList(text('synonyms')),
      pinnedTokens: String(text('pinned')).split(/[,，、;\s]+/).map((s) => s.trim()).filter(Boolean),
      sourceTokens: splitList(text('sources')),
    });
  }
  return done();
}

// ───────────────────────── 비교 ─────────────────────────

const LABEL = { keyword: '대표 키워드', synonyms: '연관 단어', pinned: '고정 FAQ', sources: '먼저 찾아볼 곳' };

export function diffKeyword(before: KeywordView, after: KeywordView, sources?: SearchSource[] | null): Change[] {
  const label = sourceLabel(sources);
  const show: Record<keyof KeywordView, (v: KeywordView) => string> = {
    keyword: (v) => v.keyword,
    synonyms: (v) => v.synonyms.join(', '),
    pinned: (v) => v.pinned.join(', '),
    sources: (v) => v.sources.map(label).join(', '),
  };
  const out: Change[] = [];
  for (const f of Object.keys(show) as (keyof KeywordView)[]) {
    const b = show[f](before);
    const a = show[f](after);
    // 먼저 찾아볼 곳은 이름이 아닌 id로 비교
    const same = f === 'sources' ? before.sources.join('\n') === after.sources.join('\n') : b === a;
    if (!same) out.push({ field: f, label: LABEL[f], before: b, after: a });
  }
  return out;
}

/**
 * 엑셀의 키워드 규칙과 지금 DB를 비교
 *   faqs: 고정 FAQ 번호 확인용 (DB에 있는 FAQ만 고를 수 있음), deletedFaqIds: 이번에 지우는 FAQ
 *   sources: 먼저 찾아볼 곳 선택지 (못 받았으면 null — 이미 쓰던 값만 그대로 받음)
 */
export function buildKeywordPlan(
  parsed: { items: ParsedKeyword[]; problems: Issue[]; warnings: Issue[] },
  rules: KeywordRuleDbRow[],
  ctx: { faqs: { id: number; question_ko?: string }[]; deletedFaqIds?: Set<number>; sources: SearchSource[] | null }
): KeywordPlan {
  const problems: Issue[] = [...parsed.problems];
  const warnings: Issue[] = [...parsed.warnings];
  const dbViews = new Map<number, KeywordView>();
  for (const r of rules) dbViews.set(Number(r.id), keywordRowToView(r));
  const faqIds = new Set(ctx.faqs.map((f) => Number(f.id)));
  const deletedFaqs = ctx.deletedFaqIds ?? new Set<number>();

  // 출처 이름·id → id
  const sourceOf = new Map<string, string>();
  for (const s of ctx.sources ?? []) {
    sourceOf.set(nameKey(s.id), s.id);
    sourceOf.set(nameKey(s.label), s.id);
  }
  const validNames = (ctx.sources ?? []).map((s) => s.label).join(', ');

  const plan: KeywordPlan = { created: [], updated: [], deleted: [], unchanged: 0, missingFromFile: [], problems, warnings };
  const seen = new Map<number, number>();
  const finalOf = new Map<number, { row: number; view: KeywordView }>();

  for (const it of parsed.items) {
    if (it.badId) continue;
    if (it.id !== null) {
      if (!dbViews.has(it.id)) {
        problems.push({ row: it.row, message: `번호 ${it.id}인 키워드 규칙이 없어요. 번호는 고치지 말고, 새 규칙은 번호를 비워 주세요.` });
        continue;
      }
      if (seen.has(it.id)) {
        problems.push({ row: it.row, message: `같은 번호(${it.id})가 ${seen.get(it.id)}번째 줄에도 있어요. 같은 규칙은 한 번만 적어 주세요.` });
        continue;
      }
      seen.set(it.id, it.row);
    }
    if (it.del) {
      if (it.id === null) warnings.push({ row: it.row, message: "번호가 없는 새 줄에 '삭제'를 적어서 건너뛰었어요." });
      else plan.deleted.push({ id: it.id, row: it.row, before: dbViews.get(it.id)! });
      continue;
    }

    const prev = it.id !== null ? dbViews.get(it.id)! : null;
    const before = problems.length;
    const keyword = it.keyword;
    if (keyword.length > 100) problems.push({ row: it.row, message: `대표 키워드가 너무 길어요. 100자까지 쓸 수 있어요. (지금 ${keyword.length}자)` });

    const long = it.synonyms.filter((s) => s.length > 50);
    if (long.length) problems.push({ row: it.row, message: `연관 단어는 하나에 50자까지 쓸 수 있어요. ('${long[0].slice(0, 20)}…')` });
    const synonyms = dedupLoose(it.synonyms, [keyword]);
    if (synonyms.length > MAX_SYNONYMS) problems.push({ row: it.row, message: `연관 단어는 ${MAX_SYNONYMS}개까지 적을 수 있어요. (지금 ${synonyms.length}개)` });

    // 고정 FAQ 번호
    const pinned: number[] = [];
    for (const t of it.pinnedTokens) {
      const n = /^\d+$/.test(t) ? Number(t) : NaN;
      if (!Number.isInteger(n) || n <= 0) {
        problems.push({ row: it.row, message: `고정 FAQ 번호 칸의 '${t}'을(를) 읽지 못했어요. FAQ 번호만 쉼표로 나눠 적어 주세요.` });
        continue;
      }
      if (!pinned.includes(n)) pinned.push(n);
    }
    const pinnedChanged = !prev || prev.pinned.join(',') !== pinned.join(',');
    if (pinnedChanged) {
      // 고친 규칙만 확인 (예전부터 그대로인 규칙은 막지 않음)
      if (pinned.length > MAX_KEYWORD_PINNED) {
        problems.push({ row: it.row, message: `고정 FAQ는 ${MAX_KEYWORD_PINNED}개까지 고를 수 있어요. (지금 ${pinned.length}개)` });
      }
      for (const n of pinned) {
        if (prev?.pinned.includes(n) && !deletedFaqs.has(n)) continue;
        if (!faqIds.has(n)) problems.push({ row: it.row, message: `고정 FAQ 번호 ${n}인 FAQ가 없어요. FAQ 시트의 번호를 적어 주세요.` });
        else if (deletedFaqs.has(n)) problems.push({ row: it.row, message: `고정 FAQ 번호 ${n}은(는) 이번에 지우는 FAQ예요. 다른 FAQ를 골라 주세요.` });
      }
    } else {
      for (const n of pinned) {
        if (deletedFaqs.has(n)) warnings.push({ row: it.row, message: `고정 FAQ 번호 ${n}을(를) 이번에 지워서, 규칙 '${keyword}'의 고정 FAQ에서 빠져요.` });
      }
    }

    // 먼저 찾아볼 곳 (이름이나 id → id)
    const sources: string[] = [];
    const prevSources = new Map((prev?.sources ?? []).map((s) => [nameKey(s), s]));
    for (const t of it.sourceTokens) {
      const id = sourceOf.get(nameKey(t)) ?? prevSources.get(nameKey(t));
      if (!id) {
        problems.push({
          row: it.row,
          message: ctx.sources
            ? `먼저 찾아볼 곳 '${t}'을(를) 찾지 못했어요. 쓸 수 있는 이름: ${validNames}`
            : `먼저 찾아볼 곳 목록을 불러오지 못해서 '${t}'이(가) 맞는지 확인할 수 없어요. 잠시 후 다시 올려 주세요.`,
        });
        continue;
      }
      if (!sources.includes(id)) sources.push(id);
    }
    if (sources.length > MAX_SOURCES) problems.push({ row: it.row, message: `먼저 찾아볼 곳은 ${MAX_SOURCES}개까지 고를 수 있어요. (지금 ${sources.length}개)` });
    if (problems.length !== before) continue;

    const view: KeywordView = { keyword, synonyms, pinned, sources };
    if (!prev) plan.created.push({ row: it.row, view });
    else {
      finalOf.set(it.id!, { row: it.row, view });
      const changes = diffKeyword(prev, view, ctx.sources);
      if (changes.length) plan.updated.push({ id: it.id!, row: it.row, before: prev, after: view, changes });
      else plan.unchanged++;
    }
  }
  plan.missingFromFile = [...dbViews.keys()].filter((id) => !seen.has(id));

  // 대표 키워드가 겹침 (띄어쓰기·대소문자 무시) — 새로 넣거나 키워드를 바꾼 규칙만
  const deletedIds = new Set(plan.deleted.map((d) => d.id));
  const updatedIds = new Set(plan.updated.filter((u) => nameKey(u.before.keyword) !== nameKey(u.after.keyword)).map((u) => u.id));
  type Entry = { label: string; row: number | null; touched: boolean };
  const byKey = new Map<string, Entry[]>();
  const add = (k: string, e: Entry) => {
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(e);
  };
  for (const [id, prev] of dbViews) {
    if (deletedIds.has(id)) continue;
    const f = finalOf.get(id);
    add(nameKey(f?.view.keyword ?? prev.keyword), { label: `번호 ${id}`, row: f?.row ?? seen.get(id) ?? null, touched: updatedIds.has(id) });
  }
  for (const c of plan.created) add(nameKey(c.view.keyword), { label: `${c.row}번째 줄`, row: c.row, touched: true });
  const dupRows = new Set<number>();
  for (const [, group] of byKey) {
    if (group.length < 2) continue;
    for (const e of group) {
      if (!e.touched || e.row === null) continue;
      problems.push({ row: e.row, message: `대표 키워드가 ${group.filter((o) => o !== e).map((o) => o.label).join(', ')}와(과) 같아요. 한 규칙으로 합치거나 다르게 적어 주세요.` });
      dupRows.add(e.row);
    }
  }
  plan.created = plan.created.filter((c) => !dupRows.has(c.row));
  plan.updated = plan.updated.filter((u) => !dupRows.has(u.row));

  // 연관 단어가 다른 규칙의 대표 키워드 — 막지는 않고 알림
  const keywordOwner = new Map<string, string>();
  for (const [id, prev] of dbViews) if (!deletedIds.has(id)) keywordOwner.set(nameKey(finalOf.get(id)?.view.keyword ?? prev.keyword), finalOf.get(id)?.view.keyword ?? prev.keyword);
  for (const c of plan.created) keywordOwner.set(nameKey(c.view.keyword), c.view.keyword);
  for (const t of [...plan.created.map((c) => ({ row: c.row, v: c.view })), ...plan.updated.map((u) => ({ row: u.row, v: u.after }))]) {
    const clash = t.v.synonyms.find((s) => keywordOwner.has(nameKey(s)));
    if (clash) warnings.push({ row: t.row, message: `연관 단어 '${clash}'은(는) 다른 규칙의 대표 키워드이기도 해요. 두 규칙이 함께 쓰일 수 있어요.` });
  }

  plan.problems = problems.map(inSheet(SHEET)).sort(byRow);
  plan.warnings = warnings.map(inSheet(SHEET)).sort(byRow);
  return plan;
}

/** 미리보기·로그용 짧은 설명 */
export function keywordSummary(v: KeywordView, faqs: Map<number, string>, sources?: SearchSource[] | null): string[] {
  const label = sourceLabel(sources);
  const out: string[] = [];
  if (v.synonyms.length) out.push(`연관 단어: ${v.synonyms.join(', ')}`);
  if (v.pinned.length) out.push(`고정 FAQ: ${v.pinned.map((n) => `${n}. ${faqs.get(n) ?? ''}`.trim()).join(' / ')}`);
  if (v.sources.length) out.push(`먼저 찾아볼 곳: ${v.sources.map(label).join(', ')}`);
  return out;
}
