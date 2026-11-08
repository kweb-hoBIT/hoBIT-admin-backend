/**
 * FAQ 엑셀 받기·올리기 — DB·서버와 상관없는 부분 (엑셀 만들기, 읽기, 정리, 비교)
 *   라우트: src/routes/api/faqs/faqExcel.ts
 *   CLI:   src/scripts/faqExcelFromJson.ts (베타 DB에서 뽑은 JSON → 첫 엑셀 양식)
 *
 * 엑셀 모양 — 시트 "FAQ", 답변 카드 하나가 한 줄
 *   번호 | 대상 | 대분류 | 대분류(영어) | 소분류 | 소분류(영어) | 질문 | 질문(영어) | 답변 | 답변(영어) | 링크 | 이메일 | 전화 | 담당자 | 삭제
 *   FAQ 첫 줄에 번호·질문 등 FAQ 전체 칸을 적고, 답변이 여러 개면 아래 줄에 질문 칸을 비운 채 답변·링크·이메일·전화만 적음
 *   → 읽을 때: 질문 칸이 빈 줄은 바로 위 FAQ의 다음 답변
 */
import ExcelJS from 'exceljs';
import { Audience, AUDIENCE_LABEL, audienceFromLabel, DEFAULT_AUDIENCE, initialAudience, isAudience } from './faqAudience';

// ───────────────────────── 자료 모양 ─────────────────────────

/** DB answer_ko / answer_en 안의 답변 카드 하나 */
export interface AnswerCard {
  answer: string;
  url: string;
  email: string;
  phone: string;
}

/** `SELECT * FROM faqs` 한 줄 (answer_ko/answer_en은 JSON 글자) */
export interface DbFaqRow {
  id: number;
  maincategory_ko: string;
  maincategory_en: string;
  subcategory_ko: string;
  subcategory_en: string;
  question_ko: string;
  question_en: string;
  answer_ko: string | AnswerCard[] | null;
  answer_en: string | AnswerCard[] | null;
  manager: string;
  audience?: string | null;
  category_order?: number | null;
  subcategory_order?: number | null;
  [key: string]: any;
}

/** 엑셀 한 줄에 해당하는 답변 카드 (한국어·영어 답변 + 공통 링크·이메일·전화) */
export interface ExcelCard {
  answer: string;
  answer_en: string;
  url: string;
  email: string;
  phone: string;
}

/** 엑셀로 보이는 FAQ 하나 — 비교·저장의 기준 */
export interface FaqView {
  audience: Audience;
  maincategory_ko: string;
  maincategory_en: string;
  subcategory_ko: string;
  subcategory_en: string;
  question_ko: string;
  question_en: string;
  manager: string;
  cards: ExcelCard[];
}

export interface Issue {
  sheet?: string; // 시트 이름 (FAQ / 선배 FAQ / 담당자 / 이메일)
  row: number | null; // 엑셀 줄 번호 (없으면 파일·시트 전체 문제)
  message: string;
}

export interface ParsedFaq {
  row: number; // FAQ 첫 줄의 엑셀 줄 번호
  id: number | null; // 번호 (새 FAQ는 null)
  badId: boolean; // 번호 칸을 읽지 못함 (문제로 이미 적어 둠)
  del: boolean; // 삭제 칸에 '삭제'
  audienceBlank: boolean;
  view: FaqView;
  cardRows: number[]; // 각 카드의 엑셀 줄 번호
}

// ───────────────────────── 칸 정의 ─────────────────────────

type ColumnKey =
  | 'id' | 'audience' | 'maincategory_ko' | 'maincategory_en' | 'subcategory_ko' | 'subcategory_en'
  | 'question_ko' | 'question_en' | 'answer' | 'answer_en' | 'url' | 'email' | 'phone' | 'manager' | 'delete';

export const COLUMNS: { key: ColumnKey; header: string; width: number; faqLevel: boolean }[] = [
  { key: 'id', header: '번호', width: 7, faqLevel: true },
  { key: 'audience', header: '대상', width: 9, faqLevel: true },
  { key: 'maincategory_ko', header: '대분류', width: 14, faqLevel: true },
  { key: 'maincategory_en', header: '대분류(영어)', width: 18, faqLevel: true },
  { key: 'subcategory_ko', header: '소분류', width: 16, faqLevel: true },
  { key: 'subcategory_en', header: '소분류(영어)', width: 20, faqLevel: true },
  { key: 'question_ko', header: '질문', width: 36, faqLevel: true },
  { key: 'question_en', header: '질문(영어)', width: 36, faqLevel: true },
  { key: 'answer', header: '답변', width: 60, faqLevel: false },
  { key: 'answer_en', header: '답변(영어)', width: 60, faqLevel: false },
  { key: 'url', header: '링크', width: 32, faqLevel: false },
  { key: 'email', header: '이메일', width: 26, faqLevel: false },
  { key: 'phone', header: '전화', width: 16, faqLevel: false },
  { key: 'manager', header: '담당자', width: 12, faqLevel: true },
  { key: 'delete', header: '삭제', width: 8, faqLevel: true },
];

export const DELETE_MARK = '삭제';
export const SHEET_NAME = 'FAQ'; // 예전 파일 (한 시트에 모두) — 올리면 그대로 읽음
// 대상별 시트 — 받을 때는 셋으로 나눔. 시트가 곧 기본 대상 (대상 칸을 바꾸면 그 값이 우선)
export const FAQ_SHEETS: { name: string; audience: Audience }[] = [
  { name: '학부 FAQ', audience: 'undergraduate' },
  { name: '대학원 FAQ', audience: 'graduate' },
  { name: '공통 FAQ', audience: 'all' },
];
// 여러 시트의 줄 번호가 겹치지 않게 내부에서만 쓰는 값 (시트 순서 × ROW_SHEET_STEP + 줄 번호)
export const ROW_SHEET_STEP = 100000;
export const HELP_SHEET_NAME = '사용 방법';

// DB 칸 길이 (config/createDB.ts)
const MAX_LEN: Partial<Record<keyof FaqView, number>> = {
  maincategory_ko: 300,
  maincategory_en: 300,
  subcategory_ko: 300,
  subcategory_en: 300,
  question_ko: 300,
  question_en: 300,
  manager: 45,
};
const MAX_TEXT_BYTES = 65535; // answer_ko/answer_en (TEXT)

const FIELD_LABEL: Record<string, string> = {
  audience: '대상',
  maincategory_ko: '대분류',
  maincategory_en: '대분류(영어)',
  subcategory_ko: '소분류',
  subcategory_en: '소분류(영어)',
  question_ko: '질문',
  question_en: '질문(영어)',
  manager: '담당자',
  answer: '답변',
  answer_en: '답변(영어)',
  url: '링크',
  email: '이메일',
  phone: '전화',
};

// ───────────────────────── 글자 정리 ─────────────────────────

const INVISIBLE = /[​-‍⁠﻿­]/g;

function baseNorm(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLE, '')
    .replace(/[　   \t]/g, ' ');
}

/** 한 줄 칸 (분류·질문·담당자) — 줄바꿈·여러 칸 띄움을 한 칸으로 */
export function normLine(v: unknown): string {
  return baseNorm(String(v ?? '')).replace(/\s+/g, ' ').trim();
}

/** 여러 줄 칸 (답변) — 줄바꿈은 살리고 줄 끝 공백, 앞뒤 빈 줄만 정리 */
export function normMulti(v: unknown): string {
  return baseNorm(String(v ?? ''))
    .split('\n')
    .map((l) => l.replace(/ +$/, ''))
    .join('\n')
    .trim();
}

/** 링크·이메일·전화 — 줄마다 한 줄 정리, 빈 줄 없앰 */
export function normList(v: unknown): string {
  return baseNorm(String(v ?? ''))
    .split('\n')
    .map((l) => l.replace(/ +/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** 비슷한 이름 찾기용 — 띄어쓰기·문장부호 빼고 비교 */
export function looseKey(s: string): string {
  return s.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();
}

/** exceljs 칸 값(글자·숫자·날짜·서식 글자·하이퍼링크·수식 등) → 글자 */
export function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return '';
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'object') {
    const o = v as any;
    if (Array.isArray(o.richText)) return o.richText.map((t: any) => cellText(t?.text)).join('');
    if ('hyperlink' in o) {
      const text = cellText(o.text);
      if (text) return text;
      return String(o.hyperlink ?? '').replace(/^mailto:/i, '');
    }
    if ('formula' in o || 'sharedFormula' in o) return cellText(o.result);
    if ('error' in o) return '';
    if ('text' in o) return cellText(o.text);
  }
  return String(v);
}

// ───────────────────────── DB 줄 ↔ 엑셀 모양 ─────────────────────────

function toCard(c: any): AnswerCard {
  if (c === null || typeof c !== 'object') return { answer: String(c ?? ''), url: '', email: '', phone: '' };
  return {
    answer: String(c.answer ?? ''),
    url: String(c.url ?? ''),
    email: String(c.email ?? ''),
    phone: String(c.phone ?? ''),
  };
}

export function parseCards(raw: unknown): AnswerCard[] {
  if (raw === null || raw === undefined || raw === '') return [];
  let v: unknown = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw);
    } catch {
      return [{ answer: raw, url: '', email: '', phone: '' }];
    }
  }
  if (Array.isArray(v)) return v.map(toCard);
  if (v && typeof v === 'object' && Object.keys(v as object).length > 0) return [toCard(v)];
  return [];
}

const cardIsEmpty = (c: ExcelCard) => !c.answer && !c.answer_en && !c.url && !c.email && !c.phone;

/** DB 한 줄 → 엑셀에 보이는 모양 (정리된 글자). 대상이 없으면 처음 규칙을 씀 */
export function dbRowToView(row: DbFaqRow): FaqView {
  const ko = parseCards(row.answer_ko);
  const en = parseCards(row.answer_en);
  const n = Math.max(ko.length, en.length);
  const cards: ExcelCard[] = [];
  for (let i = 0; i < n; i++) {
    const k = ko[i];
    const e = en[i];
    const card: ExcelCard = {
      answer: normMulti(k?.answer),
      answer_en: normMulti(e?.answer),
      url: normList(k?.url || e?.url),
      email: normList(k?.email || e?.email),
      phone: normList(k?.phone || e?.phone),
    };
    if (!cardIsEmpty(card)) cards.push(card);
  }
  return {
    audience: isAudience(row.audience) ? row.audience : initialAudience(row),
    maincategory_ko: normLine(row.maincategory_ko),
    maincategory_en: normLine(row.maincategory_en),
    subcategory_ko: normLine(row.subcategory_ko),
    subcategory_en: normLine(row.subcategory_en),
    question_ko: normLine(row.question_ko),
    question_en: normLine(row.question_en),
    manager: normLine(row.manager),
    cards,
  };
}

/** 엑셀 모양 → DB에 넣을 answer_ko / answer_en (영어 카드도 링크·이메일·전화를 똑같이) */
export function viewToAnswers(view: FaqView): { answer_ko: AnswerCard[]; answer_en: AnswerCard[] } {
  return {
    answer_ko: view.cards.map((c) => ({ answer: c.answer, url: c.url, email: c.email, phone: c.phone })),
    answer_en: view.cards.map((c) => ({ answer: c.answer_en, url: c.url, email: c.email, phone: c.phone })),
  };
}

// ───────────────────────── 엑셀 만들기 ─────────────────────────

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
const CONT_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
export const EXTRA_VALIDATION_ROWS = 300; // 새 줄을 아래에 붙여 적을 때도 드롭다운이 나오게

/** 시트 만들기 — 칸 제목 꾸밈, 첫 줄 고정, 자동 필터, 줄바꿈, 글자 서식(전화번호 0 보존) */
export function addStyledSheet(
  wb: ExcelJS.Workbook,
  name: string,
  columns: { key: string; header: string; width: number; numeric?: boolean }[]
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    if (!c.numeric) col.numFmt = '@';
    col.alignment = { vertical: 'top', wrapText: true };
  });
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: 'middle', horizontal: 'center' };
  header.height = 22;
  columns.forEach((_, i) => {
    const cell = header.getCell(i + 1);
    cell.fill = HEADER_FILL;
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFB0B8C4' } } };
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

/** 드롭다운 (2번째 줄부터 데이터 끝 + 여유 줄까지) */
export function addListValidation(ws: ExcelJS.Worksheet, col: number, values: string[], title: string, error: string) {
  const lastRow = ws.rowCount + EXTRA_VALIDATION_ROWS;
  for (let r = 2; r <= lastRow; r++) {
    ws.getRow(r).getCell(col).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${values.join(',')}"`],
      showErrorMessage: true,
      errorTitle: title,
      error,
    };
  }
}

export const inSheet = (sheet: string) => (i: Issue): Issue => ({ ...i, sheet: i.sheet ?? sheet });

/**
 * 같은 FAQ의 두 번째 이후 답변 줄 — FAQ 칸(번호·분류·질문 등)을 회색으로 칠하고 입력을 막음 (데이터 유효성 검사).
 * 적으면 "비워 두세요" 안내가 뜸. 시트 보호는 쓰지 않음 (정렬·필터·줄 추가가 막혀서)
 */
export const fillContinuation = (row: ExcelJS.Row, cols: number[]) =>
  cols.forEach((c) => {
    const cell = row.getCell(c);
    cell.fill = CONT_FILL;
    cell.dataValidation = {
      type: 'custom',
      allowBlank: true,
      formulae: [`LEN(${cell.address})=0`],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: '회색 칸은 비워 두세요',
      error: '위 FAQ의 두 번째 이후 답변 줄이에요. 답변·링크·이메일·전화만 적어 주세요. 새 FAQ는 새 줄에 질문부터 적어 주세요.',
    };
  });

const headerKey = (s: string) => s.normalize('NFKC').replace(/[\s*]/g, '');

/** 첫 줄 제목으로 칸 위치 찾기 (칸 순서가 바뀌어도 읽음) */
export function findColumns<K extends string>(
  ws: ExcelJS.Worksheet,
  columns: { key: K; header: string }[]
): Record<K, number> {
  const colOf = {} as Record<K, number>;
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const k = headerKey(cellText(cell.value));
    const def = columns.find((c) => headerKey(c.header) === k);
    if (def && !colOf[def.key]) colOf[def.key] = colNumber;
  });
  return colOf;
}

/** 분류 순서 → 번호 순 (orderKeys: category_order, subcategory_order, ...) */
export function sortRows<T extends { id: number }>(rows: T[], orderKeys: string[] = ['category_order', 'subcategory_order']): T[] {
  const num = (v: unknown) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? Number.MAX_SAFE_INTEGER : Number(v));
  return [...rows].sort((a: any, b: any) => {
    for (const k of orderKeys) {
      const d = num(a[k]) - num(b[k]);
      if (d) return d;
    }
    return num(a.id) - num(b.id);
  });
}

/** 'FAQ' 시트 (행정실 FAQ) — 답변 카드 하나가 한 줄 */
export function addFaqSheet(wb: ExcelJS.Workbook, rows: DbFaqRow[], name: string = SHEET_NAME): ExcelJS.Worksheet {
  const ws = addStyledSheet(wb, name, COLUMNS.map((c) => ({ ...c, numeric: c.key === 'id' })));
  const faqLevelCols = COLUMNS.map((c, i) => (c.faqLevel ? i + 1 : 0)).filter(Boolean);

  for (const row of sortRows(rows)) {
    const view = dbRowToView(row);
    const cards = view.cards.length ? view.cards : [{ answer: '', answer_en: '', url: '', email: '', phone: '' }];
    cards.forEach((card, i) => {
      const values: Record<ColumnKey, string | number> = {
        id: i === 0 ? Number(row.id) : '',
        audience: i === 0 ? AUDIENCE_LABEL[view.audience] : '',
        maincategory_ko: i === 0 ? view.maincategory_ko : '',
        maincategory_en: i === 0 ? view.maincategory_en : '',
        subcategory_ko: i === 0 ? view.subcategory_ko : '',
        subcategory_en: i === 0 ? view.subcategory_en : '',
        question_ko: i === 0 ? view.question_ko : '',
        question_en: i === 0 ? view.question_en : '',
        answer: card.answer,
        answer_en: card.answer_en,
        url: card.url,
        email: card.email,
        phone: card.phone,
        manager: i === 0 ? view.manager : '',
        delete: '',
      };
      const added = ws.addRow(values);
      if (i > 0) fillContinuation(added, faqLevelCols);
    });
  }

  // 대상·삭제 드롭다운
  addListValidation(
    ws,
    COLUMNS.findIndex((c) => c.key === 'audience') + 1,
    [AUDIENCE_LABEL.undergraduate, AUDIENCE_LABEL.graduate, AUDIENCE_LABEL.all],
    '대상',
    '학부, 대학원, 공통 중에서 골라 주세요.'
  );
  addListValidation(ws, COLUMNS.findIndex((c) => c.key === 'delete') + 1, [DELETE_MARK], '삭제', "FAQ를 지우려면 '삭제'를 골라 주세요.");
  return ws;
}

// ───────────────────────── 엑셀 읽기 ─────────────────────────

/** 'FAQ' 시트 읽기 — 시트가 없으면 null (그 시트는 바뀐 게 없는 것으로) */
export function parseFaqSheet(
  ws: ExcelJS.Worksheet | undefined,
  sheetName: string = SHEET_NAME,
  defaultAudience: Audience = DEFAULT_AUDIENCE,
  rowOffset = 0 // 여러 시트를 합칠 때 줄 번호가 겹치지 않게 (hobitWorkbook이 끝에 되돌림)
): { faqs: ParsedFaq[]; problems: Issue[]; warnings: Issue[] } | null {
  if (!ws) return null;
  const SHEET = sheetName;
  const problems: Issue[] = [];
  const warnings: Issue[] = [];
  const faqs: ParsedFaq[] = [];

  const colOf = findColumns(ws, COLUMNS);
  const missing = COLUMNS.filter((c) => c.key !== 'delete' && !colOf[c.key]);
  if (missing.length) {
    problems.push({
      row: 1,
      message: `칸 제목 ${missing.map((c) => `'${c.header}'`).join(', ')}을(를) 찾지 못했어요. 받은 엑셀의 첫 줄(칸 제목)은 그대로 둬 주세요.`,
    });
    return { faqs, problems: problems.map(inSheet(SHEET)), warnings };
  }

  let cur: ParsedFaq | null = null;
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const raw = (k: ColumnKey) => (colOf[k] ? row.getCell(colOf[k]).value : null);
    const text = (k: ColumnKey) => cellText(raw(k));

    const allEmpty = COLUMNS.every((c) => !colOf[c.key] || normLine(text(c.key)) === '');
    if (allEmpty) continue;

    const idText = normLine(text('id'));
    const question = normLine(text('question_ko'));
    const delText = normLine(text('delete'));
    const card: ExcelCard = {
      answer: normMulti(text('answer')),
      answer_en: normMulti(text('answer_en')),
      url: normList(text('url')),
      email: normList(text('email')),
      phone: normList(text('phone')),
    };
    if (typeof raw('phone') === 'number') {
      warnings.push({ row: r, message: "전화 칸이 숫자로 저장돼서 맨 앞 0이 빠졌을 수 있어요. 확인해 주세요." });
    }

    let id: number | null = null;
    let badId = false;
    if (idText) {
      if (/^\d+$/.test(idText)) id = Number(idText);
      else badId = true;
    }

    if (!question) {
      // 질문이 빈 줄 = 위 FAQ의 다음 답변
      if (!cur) {
        problems.push({ row: r, message: '질문이 비어 있어요. FAQ 첫 줄에는 질문을 꼭 적어 주세요.' });
        continue;
      }
      if (badId || (id !== null && id !== cur.id)) {
        problems.push({ row: r, message: `번호 ${idText}인 줄의 질문이 비어 있어요. 질문을 적어 주세요.` });
        continue;
      }
      const main = normLine(text('maincategory_ko'));
      const sub = normLine(text('subcategory_ko'));
      if ((main && main !== cur.view.maincategory_ko) || (sub && sub !== cur.view.subcategory_ko)) {
        problems.push({
          row: r,
          message: '질문이 비어 있어서 위 FAQ의 다음 답변으로 읽었는데, 대분류·소분류가 위 FAQ와 달라요. 새 FAQ라면 질문을 적어 주세요.',
        });
        continue;
      }
      if (delText) {
        problems.push({
          row: r,
          message: "'삭제'는 FAQ 첫 줄(질문이 있는 줄)에만 쓸 수 있어요. 답변 하나만 지우려면 그 줄을 통째로 지워 주세요.",
        });
        continue;
      }
      if (!cardIsEmpty(card)) {
        cur.view.cards.push(card);
        cur.cardRows.push(r);
      }
      continue;
    }

    // 새 FAQ 시작
    if (badId) {
      problems.push({ row: r, message: `번호 칸('${idText}')을 읽지 못했어요. 번호 칸은 고치지 말고, 새 FAQ는 번호를 비워 주세요.` });
    }
    const audienceText = normLine(text('audience'));
    let audience: Audience = defaultAudience;
    let audienceBlank = false;
    if (!audienceText) audienceBlank = true;
    else {
      const a = audienceFromLabel(audienceText);
      if (a) audience = a;
      else problems.push({ row: r, message: `대상에는 학부, 대학원, 공통만 쓸 수 있어요. (지금: '${audienceText}')` });
    }
    let del = false;
    if (delText === DELETE_MARK) del = true;
    else if (delText) problems.push({ row: r, message: `삭제 칸에는 '삭제'만 쓸 수 있어요. (지금: '${delText}')` });

    cur = {
      row: r,
      id,
      badId,
      del,
      audienceBlank,
      view: {
        audience,
        maincategory_ko: normLine(text('maincategory_ko')),
        maincategory_en: normLine(text('maincategory_en')),
        subcategory_ko: normLine(text('subcategory_ko')),
        subcategory_en: normLine(text('subcategory_en')),
        question_ko: question,
        question_en: normLine(text('question_en')),
        manager: normLine(text('manager')),
        cards: [],
      },
      cardRows: [],
    };
    if (!cardIsEmpty(card)) {
      cur.view.cards.push(card);
      cur.cardRows.push(r);
    }
    faqs.push(cur);
  }

  // 줄 번호를 합친 파일 기준으로 (시트별 문제는 이미 시트 이름이 붙어 있어 그대로)
  if (rowOffset) {
    for (const f of faqs) {
      f.row += rowOffset;
      f.cardRows = f.cardRows.map((x) => x + rowOffset);
    }
  }
  return { faqs, problems: problems.map(inSheet(SHEET)), warnings: warnings.map(inSheet(SHEET)) };
}

// ───────────────────────── 비교 (DB ↔ 엑셀) ─────────────────────────

export interface Change {
  field: string;
  label: string;
  before: string;
  after: string;
  auto_translate?: boolean; // 영어 칸이 비어 있어 적용할 때 번역함
}

export interface PlanCreated {
  row: number;
  sheet?: string; // 행정실 FAQ 시트 이름 (학부 FAQ 등)
  view: FaqView;
}
export interface PlanUpdated {
  id: number;
  row: number;
  sheet?: string;
  before: FaqView;
  after: FaqView;
  changes: Change[];
}
export interface PlanDeleted {
  id: number;
  row: number;
  sheet?: string;
  before: FaqView;
}

export interface ImportPlan {
  created: PlanCreated[];
  updated: PlanUpdated[];
  deleted: PlanDeleted[];
  unchanged: number;
  missingFromFile: number[];
  problems: Issue[];
  warnings: Issue[];
  translateCount: number; // 자동 번역할 영어 칸 수
}

const SCALAR_FIELDS: (keyof Omit<FaqView, 'cards'>)[] = [
  'audience',
  'maincategory_ko',
  'maincategory_en',
  'subcategory_ko',
  'subcategory_en',
  'question_ko',
  'question_en',
  'manager',
];
const CARD_FIELDS: (keyof ExcelCard)[] = ['answer', 'answer_en', 'url', 'email', 'phone'];

const showValue = (field: string, v: string) => (field === 'audience' ? AUDIENCE_LABEL[v as Audience] ?? v : v);

export function diffViews(before: FaqView, after: FaqView, autoTranslate = false): Change[] {
  const changes: Change[] = [];
  const isAuto = (field: string, v: string) => autoTranslate && field.endsWith('_en') && v === '';
  for (const f of SCALAR_FIELDS) {
    if (before[f] !== after[f]) {
      const c: Change = { field: f, label: FIELD_LABEL[f], before: showValue(f, before[f]), after: showValue(f, after[f]) };
      if (isAuto(f, after[f])) c.auto_translate = true;
      changes.push(c);
    }
  }
  const n = Math.max(before.cards.length, after.cards.length);
  const empty: ExcelCard = { answer: '', answer_en: '', url: '', email: '', phone: '' };
  for (let i = 0; i < n; i++) {
    const b = before.cards[i] ?? empty;
    const a = after.cards[i] ?? empty;
    for (const f of CARD_FIELDS) {
      if (b[f] !== a[f]) {
        const field = `cards.${i}.${f}`;
        const c: Change = { field, label: n > 1 ? `${FIELD_LABEL[f]} ${i + 1}` : FIELD_LABEL[f], before: b[f], after: a[f] };
        if (f === 'answer_en' && autoTranslate && a[f] === '' && a.answer) c.auto_translate = true;
        changes.push(c);
      }
    }
  }
  return changes;
}

/** 비어 있어 자동 번역할 영어 칸 이름들 (한국어가 있는 칸만) */
export function blankEnglishFields(v: FaqView): string[] {
  const out: string[] = [];
  if (!v.maincategory_en && v.maincategory_ko) out.push('대분류(영어)');
  if (!v.subcategory_en && v.subcategory_ko) out.push('소분류(영어)');
  if (!v.question_en && v.question_ko) out.push('질문(영어)');
  if (v.cards.some((c) => !c.answer_en && c.answer)) out.push('답변(영어)');
  return out;
}

const catKey = (main: string, sub: string) => `${main}\u0000${sub}`;

/**
 * 엑셀에서 읽은 FAQ와 지금 DB를 비교해 바뀔 내용을 만듦
 *   autoTranslate: 비어 있는 영어 칸을 적용할 때 번역하는지 (안내 문구만 달라짐)
 */
export function buildImportPlan(
  parsed: { faqs: ParsedFaq[]; problems: Issue[]; warnings: Issue[] },
  dbRows: DbFaqRow[],
  opts: { autoTranslate?: boolean; rowLabel?: (row: number) => string } = {}
): ImportPlan {
  const autoTranslate = !!opts.autoTranslate;
  const rowName = opts.rowLabel ?? ((row: number) => `${row}번째 줄`);
  const problems: Issue[] = [...parsed.problems];
  const warnings: Issue[] = [...parsed.warnings];

  const dbById = new Map<number, DbFaqRow>();
  const dbViews = new Map<number, FaqView>();
  for (const r of sortRows(dbRows)) {
    dbById.set(Number(r.id), r);
    dbViews.set(Number(r.id), dbRowToView(r));
  }

  // 기존 분류의 영어 이름 (영어 칸이 비어 있으면 여기서 채움)
  const mainEn = new Map<string, string>();
  const subEn = new Map<string, string>();
  const existingSubs = new Map<string, Set<string>>();
  for (const v of dbViews.values()) {
    if (v.maincategory_en && !mainEn.has(v.maincategory_ko)) mainEn.set(v.maincategory_ko, v.maincategory_en);
    const k = catKey(v.maincategory_ko, v.subcategory_ko);
    if (v.subcategory_en && !subEn.has(k)) subEn.set(k, v.subcategory_en);
    if (!existingSubs.has(v.maincategory_ko)) existingSubs.set(v.maincategory_ko, new Set());
    existingSubs.get(v.maincategory_ko)!.add(v.subcategory_ko);
  }
  // 파일 안에서 새 분류의 영어 이름을 한 줄에만 적은 경우도 같이 채움
  const fileMainEn = new Map<string, string>();
  const fileSubEn = new Map<string, string>();
  for (const f of parsed.faqs) {
    if (f.del) continue;
    const v = f.view;
    if (v.maincategory_en && !fileMainEn.has(v.maincategory_ko)) fileMainEn.set(v.maincategory_ko, v.maincategory_en);
    const k = catKey(v.maincategory_ko, v.subcategory_ko);
    if (v.subcategory_en && !fileSubEn.has(k)) fileSubEn.set(k, v.subcategory_en);
  }

  const created: PlanCreated[] = [];
  const updated: PlanUpdated[] = [];
  const deleted: PlanDeleted[] = [];
  let unchanged = 0;
  const seen = new Map<number, number>(); // 번호 → 줄
  const fileViews = new Map<number, ParsedFaq>(); // 번호 → 파일의 FAQ (삭제 아님)

  for (const f of parsed.faqs) {
    if (f.badId) continue;
    if (f.id !== null) {
      if (!dbById.has(f.id)) {
        problems.push({ row: f.row, message: `번호 ${f.id}인 FAQ가 없어요. 번호는 고치지 말고, 새 FAQ는 번호를 비워 주세요.` });
        continue;
      }
      if (seen.has(f.id)) {
        problems.push({ row: f.row, message: `같은 번호(${f.id})가 ${rowName(seen.get(f.id)!)}에도 있어요. 같은 FAQ는 한 번만 적어 주세요.` });
        continue;
      }
      seen.set(f.id, f.row);
    }

    if (f.del) {
      if (f.id === null) warnings.push({ row: f.row, message: "번호가 없는 새 줄에 '삭제'를 적어서 건너뛰었어요." });
      else deleted.push({ id: f.id, row: f.row, before: dbViews.get(f.id)! });
      continue;
    }

    const v = f.view;
    if (!v.maincategory_en) v.maincategory_en = mainEn.get(v.maincategory_ko) ?? fileMainEn.get(v.maincategory_ko) ?? '';
    if (!v.subcategory_en) {
      const k = catKey(v.maincategory_ko, v.subcategory_ko);
      v.subcategory_en = subEn.get(k) ?? fileSubEn.get(k) ?? '';
    }

    // 꼭 필요한 칸·길이
    const before = problems.length;
    if (!v.maincategory_ko) problems.push({ row: f.row, message: '대분류가 비어 있어요.' });
    if (!v.subcategory_ko) problems.push({ row: f.row, message: '소분류가 비어 있어요.' });
    if (!v.cards.some((c) => c.answer)) problems.push({ row: f.row, message: '답변이 비어 있어요. 답변을 하나 이상 적어 주세요.' });
    else {
      v.cards.forEach((c, i) => {
        if (!c.answer) problems.push({ row: f.cardRows[i], message: '답변 칸이 비어 있어요. 이 줄의 답변을 적거나 줄을 지워 주세요.' });
      });
    }
    for (const [field, max] of Object.entries(MAX_LEN) as [keyof FaqView, number][]) {
      const s = v[field] as string;
      if (s.length > max) problems.push({ row: f.row, message: `${FIELD_LABEL[field]} 칸이 너무 길어요. ${max}자까지 쓸 수 있어요. (지금 ${s.length}자)` });
    }
    const answers = viewToAnswers(v);
    if (Buffer.byteLength(JSON.stringify(answers.answer_ko)) > MAX_TEXT_BYTES || Buffer.byteLength(JSON.stringify(answers.answer_en)) > MAX_TEXT_BYTES) {
      problems.push({ row: f.row, message: '답변이 너무 길어요. 답변을 줄이거나 나눠 주세요.' });
    }
    if (f.audienceBlank) warnings.push({ row: f.row, message: `대상이 비어 있어서 '${AUDIENCE_LABEL[v.audience]}'(으)로 둘게요.` });
    if (problems.length !== before) continue;

    if (f.id === null) {
      created.push({ row: f.row, view: v });
    } else {
      fileViews.set(f.id, f);
      const prev = dbViews.get(f.id)!;
      const changes = diffViews(prev, v, autoTranslate);
      if (changes.length) {
        updated.push({ id: f.id, row: f.row, before: prev, after: v, changes });
        // 한국어만 고치고 영어는 예전 그대로인 경우
        if (prev.question_ko !== v.question_ko && v.question_en && prev.question_en === v.question_en) {
          warnings.push({ row: f.row, message: '질문은 바뀌었는데 질문(영어)은 그대로예요. 영어 칸을 비우면 적용할 때 새로 번역해요.' });
        }
        v.cards.forEach((c, i) => {
          const p = prev.cards[i];
          if (p && p.answer !== c.answer && c.answer_en && p.answer_en === c.answer_en) {
            warnings.push({ row: f.cardRows[i], message: '답변은 바뀌었는데 답변(영어)은 그대로예요. 영어 칸을 비우면 적용할 때 새로 번역해요.' });
          }
        });
      } else unchanged++;
    }
  }

  const missingFromFile = [...dbById.keys()].filter((id) => !seen.has(id));

  // 같은 질문이 둘 (새로 넣거나 질문을 바꾼 FAQ만 — 원래 겹쳐 있던 건 막지 않음)
  type Entry = { label: string; row: number | null; touched: boolean; question: string };
  const entries: Entry[] = [];
  const deletedIds = new Set(deleted.map((d) => d.id));
  const updatedById = new Map(updated.map((u) => [u.id, u]));
  for (const [id, prev] of dbViews) {
    if (deletedIds.has(id)) continue;
    const f = fileViews.get(id);
    const u = updatedById.get(id);
    const q = f ? f.view.question_ko : prev.question_ko;
    entries.push({ label: `번호 ${id}`, row: f?.row ?? null, touched: !!u && u.before.question_ko !== u.after.question_ko, question: q });
  }
  for (const c of created) entries.push({ label: rowName(c.row), row: c.row, touched: true, question: c.view.question_ko });
  const byQuestion = new Map<string, Entry[]>();
  for (const e of entries) {
    const k = e.question.toLowerCase();
    if (!byQuestion.has(k)) byQuestion.set(k, []);
    byQuestion.get(k)!.push(e);
  }
  const dupRows = new Set<number>();
  for (const group of byQuestion.values()) {
    if (group.length < 2) continue;
    for (const e of group) {
      if (!e.touched || e.row === null) continue;
      const others = group.filter((o) => o !== e).map((o) => o.label);
      problems.push({ row: e.row, message: `질문이 ${others.join(', ')}의 질문과 똑같아요. 질문을 조금 다르게 적어 주세요.` });
      dupRows.add(e.row);
    }
  }

  // 새 분류 이름이 기존 이름과 띄어쓰기·문장부호만 다른 경우
  const touchedViews: { row: number; v: FaqView }[] = [
    ...created.map((c) => ({ row: c.row, v: c.view })),
    ...updated.map((u) => ({ row: u.row, v: u.after })),
  ];
  const warnedCat = new Set<string>();
  const existingMains = [...existingSubs.keys()];
  for (const { row, v } of touchedViews) {
    if (!existingSubs.has(v.maincategory_ko)) {
      const similar = existingMains.find((m) => looseKey(m) === looseKey(v.maincategory_ko));
      const key = `m:${v.maincategory_ko}`;
      if (similar && !warnedCat.has(key)) {
        warnedCat.add(key);
        warnings.push({ row, message: `새 대분류 '${v.maincategory_ko}' — 기존 '${similar}' 과 비슷해요. 같은 분류라면 기존 이름과 똑같이 적어 주세요.` });
      }
    } else if (!existingSubs.get(v.maincategory_ko)!.has(v.subcategory_ko)) {
      const similar = [...existingSubs.get(v.maincategory_ko)!].find((s) => looseKey(s) === looseKey(v.subcategory_ko));
      const key = `s:${v.maincategory_ko}:${v.subcategory_ko}`;
      if (similar && !warnedCat.has(key)) {
        warnedCat.add(key);
        warnings.push({ row, message: `새 소분류 '${v.subcategory_ko}' — 기존 '${similar}' 과 비슷해요. 같은 분류라면 기존 이름과 똑같이 적어 주세요.` });
      }
    }
  }

  // 비어 있는 영어 칸
  let translateCount = 0;
  for (const { row, v } of touchedViews) {
    const blanks = blankEnglishFields(v);
    if (!blanks.length) continue;
    translateCount += blanks.length;
    warnings.push({
      row,
      message: autoTranslate
        ? `영어 칸이 비어 있어요 (${blanks.join(', ')}). 적용할 때 자동으로 번역해요.`
        : `영어 칸이 비어 있어요 (${blanks.join(', ')}). 영어로 물어보면 빈 답이 나갈 수 있어요.`,
    });
  }

  const byRow = (a: Issue, b: Issue) => (a.row ?? 0) - (b.row ?? 0);
  return {
    created: created.filter((c) => !dupRows.has(c.row)),
    updated: updated.filter((u) => !dupRows.has(u.row)),
    deleted,
    unchanged,
    missingFromFile,
    problems: problems.map(inSheet(SHEET_NAME)).sort(byRow),
    warnings: warnings.map(inSheet(SHEET_NAME)).sort(byRow),
    translateCount,
  };
}

// ───────────────────────── 분류 순서 ─────────────────────────

/**
 * 새로 넣거나 분류를 옮긴 FAQ의 category_order / subcategory_order
 *   기존 분류는 원래 순서 그대로, 새 대분류는 맨 뒤(max+1), 새 소분류는 그 대분류 안 맨 뒤
 *   (createFAQ.ts·updateFAQ.ts와 같은 방식 — 대분류 이름으로 기존 순서를 찾음)
 */
export function makeOrderAssigner(dbRows: DbFaqRow[]) {
  const mainOrder = new Map<string, number>();
  const subOrder = new Map<string, number>();
  const maxSub = new Map<string, number>();
  let maxMain = 0;
  for (const r of sortRows(dbRows)) {
    const main = normLine(r.maincategory_ko);
    const sub = normLine(r.subcategory_ko);
    const co = Number(r.category_order ?? 0);
    const so = Number(r.subcategory_order ?? 1);
    if (!mainOrder.has(main)) mainOrder.set(main, co);
    if (!subOrder.has(catKey(main, sub))) subOrder.set(catKey(main, sub), so);
    maxMain = Math.max(maxMain, co);
    maxSub.set(main, Math.max(maxSub.get(main) ?? 0, so));
  }
  return (main: string, sub: string): { category_order: number; subcategory_order: number } => {
    if (!mainOrder.has(main)) mainOrder.set(main, ++maxMain);
    const k = catKey(main, sub);
    if (!subOrder.has(k)) {
      const next = (maxSub.get(main) ?? 0) + 1;
      subOrder.set(k, next);
      maxSub.set(main, next);
    }
    return { category_order: mainOrder.get(main)!, subcategory_order: subOrder.get(k)! };
  };
}
