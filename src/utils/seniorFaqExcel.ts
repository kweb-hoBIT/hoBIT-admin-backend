/**
 * '선배 FAQ' 시트 (senior_faqs) — 행정실 FAQ 시트와 같은 방식, 선배 FAQ 하나가 한 줄
 *   번호 | 대분류 | 대분류(영어) | 소분류 | 소분류(영어) | 세부 항목 | 세부 항목(영어)
 *     | 제목1 | 제목1(영어) | 답변1 | 답변1(영어) | 링크1 | 위도1 | 경도1 | 제목2 | … | 담당자 | 삭제
 *   답변 묶음 수 = 3과 데이터의 가장 많은 답변 수 중 큰 값, 4번째부터는 접어 둠
 * 예전 모양 (답변 카드 하나가 한 줄, 칸 제목 '답변') 파일도 읽음 — 세부 항목 칸이 빈 줄은 바로 위 선배 FAQ의 다음 답변
 * 선배 FAQ 답변 카드는 행정실 FAQ와 모양이 달라요 (DB answer_ko/answer_en):
 *   [{ "title": "...", "answer": "...", "url": "...", "map": { "latitude": "", "longitude": "" } }]
 *   제목은 한국어·영어가 따로, 링크·지도는 영어 카드에도 똑같이
 * 대상 칸 없음 (선배 FAQ는 학부·대학원 공통)
 */
import ExcelJS from 'exceljs';
import {
  addListValidation,
  sortedUnique,
  addStyledSheet,
  cellText,
  Change,
  DELETE_MARK,
  findColumns,
  findGroups,
  GroupField,
  groupColumns,
  groupValues,
  isGroupedSheet,
  inSheet,
  Issue,
  looseKey,
  normLine,
  normList,
  normMulti,
  readGroups,
  sortRows,
  styleGroupedSheet,
  VISIBLE_GROUPS,
} from './faqExcel';

export const SENIOR_SHEET_NAME = '선배 FAQ';
const SHEET = SENIOR_SHEET_NAME;
const ORDER_KEYS = ['category_order', 'subcategory_order', 'detailcategory_order'];

export interface SeniorDbRow {
  id: number;
  maincategory_ko: string;
  maincategory_en: string;
  subcategory_ko: string;
  subcategory_en: string;
  detailcategory_ko: string;
  detailcategory_en: string;
  answer_ko: string | any[] | null;
  answer_en: string | any[] | null;
  manager: string;
  category_order?: number | null;
  subcategory_order?: number | null;
  detailcategory_order?: number | null;
  [key: string]: any;
}

export interface SeniorAnswerCard {
  title: string;
  answer: string;
  url: string;
  map: { latitude: string; longitude: string };
}

export interface SeniorCard {
  title: string;
  title_en: string;
  answer: string;
  answer_en: string;
  url: string;
  latitude: string;
  longitude: string;
}

export interface SeniorView {
  maincategory_ko: string;
  maincategory_en: string;
  subcategory_ko: string;
  subcategory_en: string;
  detailcategory_ko: string;
  detailcategory_en: string;
  manager: string;
  cards: SeniorCard[];
}

export interface ParsedSenior {
  row: number;
  id: number | null;
  badId: boolean;
  del: boolean;
  view: SeniorView;
  cardRows: number[];
  cardGroups?: number[]; // 새 모양: 각 카드의 답변 묶음 번호
}

type Key =
  | 'id' | 'maincategory_ko' | 'maincategory_en' | 'subcategory_ko' | 'subcategory_en' | 'detailcategory_ko' | 'detailcategory_en'
  | 'title' | 'title_en' | 'answer' | 'answer_en' | 'url' | 'latitude' | 'longitude' | 'manager' | 'delete';

/** 예전 모양 (답변 카드 하나가 한 줄) — 올린 파일을 읽을 때만 씀 */
export const LEGACY_SENIOR_COLUMNS: { key: Key; header: string; width: number; level: boolean }[] = [
  { key: 'id', header: '번호', width: 7, level: true },
  { key: 'maincategory_ko', header: '대분류', width: 14, level: true },
  { key: 'maincategory_en', header: '대분류(영어)', width: 18, level: true },
  { key: 'subcategory_ko', header: '소분류', width: 14, level: true },
  { key: 'subcategory_en', header: '소분류(영어)', width: 18, level: true },
  { key: 'detailcategory_ko', header: '세부 항목', width: 18, level: true },
  { key: 'detailcategory_en', header: '세부 항목(영어)', width: 20, level: true },
  { key: 'title', header: '제목', width: 18, level: false },
  { key: 'title_en', header: '제목(영어)', width: 20, level: false },
  { key: 'answer', header: '답변', width: 60, level: false },
  { key: 'answer_en', header: '답변(영어)', width: 60, level: false },
  { key: 'url', header: '링크', width: 32, level: false },
  { key: 'latitude', header: '위도', width: 11, level: false },
  { key: 'longitude', header: '경도', width: 11, level: false },
  { key: 'manager', header: '담당자', width: 12, level: true },
  { key: 'delete', header: '삭제', width: 8, level: true },
];

// 새 모양 — 선배 FAQ 칸 (답변 묶음 앞뒤)
type FixedKey = Exclude<Key, keyof SeniorCard>;
const HEAD_COLUMNS: { key: FixedKey; header: string; width: number }[] = [
  { key: 'id', header: '번호', width: 7 },
  { key: 'maincategory_ko', header: '대분류', width: 12 },
  { key: 'maincategory_en', header: '대분류(영어)', width: 14 },
  { key: 'subcategory_ko', header: '소분류', width: 12 },
  { key: 'subcategory_en', header: '소분류(영어)', width: 14 },
  { key: 'detailcategory_ko', header: '세부 항목', width: 16 },
  { key: 'detailcategory_en', header: '세부 항목(영어)', width: 18 },
];
const TAIL_COLUMNS: { key: FixedKey; header: string; width: number }[] = [
  { key: 'manager', header: '담당자', width: 12 },
  { key: 'delete', header: '삭제', width: 8 },
];
export const SENIOR_FIXED_COLUMNS = [...HEAD_COLUMNS, ...TAIL_COLUMNS];
export const SENIOR_CARD_FIELDS: GroupField<keyof SeniorCard>[] = [
  { key: 'title', header: '제목', width: 16, norm: (v) => normLine(v) },
  { key: 'title_en', header: '제목(영어)', width: 18, norm: (v) => normLine(v) },
  { key: 'answer', header: '답변', width: 50, norm: (v) => normMulti(v) },
  { key: 'answer_en', header: '답변(영어)', width: 50, norm: (v) => normMulti(v) },
  { key: 'url', header: '링크', width: 28, norm: (v) => normList(v) },
  { key: 'latitude', header: '위도', width: 10, norm: (v) => normLine(v) },
  { key: 'longitude', header: '경도', width: 10, norm: (v) => normLine(v) },
];

const LABEL: Record<string, string> = {
  maincategory_ko: '대분류',
  maincategory_en: '대분류(영어)',
  subcategory_ko: '소분류',
  subcategory_en: '소분류(영어)',
  detailcategory_ko: '세부 항목',
  detailcategory_en: '세부 항목(영어)',
  manager: '담당자',
  title: '제목',
  title_en: '제목(영어)',
  answer: '답변',
  answer_en: '답변(영어)',
  url: '링크',
  latitude: '위도',
  longitude: '경도',
};

const MAX_LEN: Partial<Record<keyof SeniorView, number>> = {
  maincategory_ko: 300,
  maincategory_en: 300,
  subcategory_ko: 300,
  subcategory_en: 300,
  detailcategory_ko: 300,
  detailcategory_en: 300,
  manager: 45,
};

// ───────────────────────── DB 줄 ↔ 엑셀 모양 ─────────────────────────

function parseSeniorCards(raw: unknown): SeniorAnswerCard[] {
  if (raw === null || raw === undefined || raw === '') return [];
  let v: unknown = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw);
    } catch {
      return [{ title: '', answer: raw, url: '', map: { latitude: '', longitude: '' } }];
    }
  }
  const list = Array.isArray(v) ? v : v && typeof v === 'object' && Object.keys(v).length ? [v] : [];
  return list.map((c: any) => ({
    title: String(c?.title ?? ''),
    answer: String(c?.answer ?? ''),
    url: String(c?.url ?? ''),
    map: { latitude: String(c?.map?.latitude ?? ''), longitude: String(c?.map?.longitude ?? '') },
  }));
}
export { parseSeniorCards };

const cardIsEmpty = (c: SeniorCard) => !c.title && !c.title_en && !c.answer && !c.answer_en && !c.url && !c.latitude && !c.longitude;

export function seniorRowToView(row: SeniorDbRow): SeniorView {
  const ko = parseSeniorCards(row.answer_ko);
  const en = parseSeniorCards(row.answer_en);
  const cards: SeniorCard[] = [];
  for (let i = 0; i < Math.max(ko.length, en.length); i++) {
    const k = ko[i];
    const e = en[i];
    const card: SeniorCard = {
      title: normLine(k?.title),
      title_en: normLine(e?.title),
      answer: normMulti(k?.answer),
      answer_en: normMulti(e?.answer),
      url: normList(k?.url || e?.url),
      latitude: normLine(k?.map.latitude || e?.map.latitude),
      longitude: normLine(k?.map.longitude || e?.map.longitude),
    };
    if (!cardIsEmpty(card)) cards.push(card);
  }
  return {
    maincategory_ko: normLine(row.maincategory_ko),
    maincategory_en: normLine(row.maincategory_en),
    subcategory_ko: normLine(row.subcategory_ko),
    subcategory_en: normLine(row.subcategory_en),
    detailcategory_ko: normLine(row.detailcategory_ko),
    detailcategory_en: normLine(row.detailcategory_en),
    manager: normLine(row.manager),
    cards,
  };
}

export function seniorViewToAnswers(v: SeniorView): { answer_ko: SeniorAnswerCard[]; answer_en: SeniorAnswerCard[] } {
  const map = (c: SeniorCard) => ({ latitude: c.latitude, longitude: c.longitude });
  return {
    answer_ko: v.cards.map((c) => ({ title: c.title, answer: c.answer, url: c.url, map: map(c) })),
    answer_en: v.cards.map((c) => ({ title: c.title_en, answer: c.answer_en, url: c.url, map: map(c) })),
  };
}

// ───────────────────────── 엑셀 만들기 ─────────────────────────

/** 선배 FAQ 시트 — 선배 FAQ 하나가 한 줄. 답변 묶음은 3개 이상, 데이터의 가장 많은 답변 수만큼 (카드를 빠뜨리지 않음) */
export function addSeniorSheet(wb: ExcelJS.Workbook, rows: SeniorDbRow[]): ExcelJS.Worksheet {
  const views = sortRows(rows, ORDER_KEYS).map((row) => ({ id: Number(row.id), v: seniorRowToView(row) }));
  const groups = Math.max(VISIBLE_GROUPS, ...views.map((x) => x.v.cards.length));
  const columns = [...HEAD_COLUMNS, ...groupColumns(SENIOR_CARD_FIELDS, groups), ...TAIL_COLUMNS];
  const ws = addStyledSheet(wb, SHEET, columns.map((c) => ({ ...c, numeric: c.key === 'id' })));
  for (const { id, v } of views) {
    ws.addRow({
      id,
      maincategory_ko: v.maincategory_ko,
      maincategory_en: v.maincategory_en,
      subcategory_ko: v.subcategory_ko,
      subcategory_en: v.subcategory_en,
      detailcategory_ko: v.detailcategory_ko,
      detailcategory_en: v.detailcategory_en,
      ...groupValues(SENIOR_CARD_FIELDS, v.cards as unknown as Record<keyof SeniorCard, string>[]),
      manager: v.manager,
      delete: '',
    });
  }
  styleGroupedSheet(ws, {
    firstGroupCol: HEAD_COLUMNS.length + 1,
    perGroup: SENIOR_CARD_FIELDS.length,
    groups,
    freezeCol: HEAD_COLUMNS.findIndex((c) => c.key === 'detailcategory_ko') + 1, // 번호 ~ 세부 항목
  });
  addListValidation(ws, columns.findIndex((c) => c.key === 'delete') + 1, [DELETE_MARK], '삭제', "선배 FAQ를 지우려면 '삭제'를 골라 주세요.");
  // 분류·담당자 — 칸을 누르면 지금 쓰는 값에서 고름 (새 값도 적을 수 있음)
  const colOf = (key: string) => columns.findIndex((x) => x.key === key) + 1;
  const pick = (key: 'maincategory_ko' | 'subcategory_ko' | 'detailcategory_ko' | 'manager') => sortedUnique(rows.map((r) => (r as any)[key]));
  addListValidation(ws, colOf('maincategory_ko'), pick('maincategory_ko'), '대분류', '지금 쓰는 대분류에서 골라 주세요.', { strict: false });
  addListValidation(ws, colOf('subcategory_ko'), pick('subcategory_ko'), '소분류', '지금 쓰는 소분류에서 골라 주세요.', { strict: false });
  addListValidation(ws, colOf('detailcategory_ko'), pick('detailcategory_ko'), '세부 항목', '지금 쓰는 세부 항목에서 골라 주세요.', { strict: false });
  addListValidation(ws, colOf('manager'), pick('manager'), '담당자', '담당자 목록에서 골라 주세요.', { strict: false });
  return ws;
}

// ───────────────────────── 엑셀 읽기 ─────────────────────────

const missingHeaderMessage = (headers: string[]) =>
  `칸 제목 ${headers.map((h) => `'${h}'`).join(', ')}을(를) 찾지 못했어요. 받은 엑셀의 첫 줄(칸 제목)은 그대로 둬 주세요.`;

/** 선배 FAQ 시트 읽기 (새 모양·예전 모양 자동 구분) — 시트가 없으면 null */
export function parseSeniorSheet(ws: ExcelJS.Worksheet | undefined): { items: ParsedSenior[]; problems: Issue[]; warnings: Issue[] } | null {
  if (!ws) return null;
  return isGroupedSheet(ws) ? parseGroupedSeniorSheet(ws) : parseLegacySeniorSheet(ws);
}

/** 새 모양 (선배 FAQ 하나가 한 줄) 읽기 */
function parseGroupedSeniorSheet(ws: ExcelJS.Worksheet): { items: ParsedSenior[]; problems: Issue[]; warnings: Issue[] } {
  const problems: Issue[] = [];
  const items: ParsedSenior[] = [];
  const done = () => ({ items, problems: problems.map(inSheet(SHEET)), warnings: [] as Issue[] });

  const colOf = findColumns(ws, SENIOR_FIXED_COLUMNS);
  const { groups, missing: missingGroup } = findGroups(ws, SENIOR_CARD_FIELDS);
  const missing = [...SENIOR_FIXED_COLUMNS.filter((c) => c.key !== 'delete' && !colOf[c.key]).map((c) => c.header), ...missingGroup];
  if (missing.length) {
    problems.push({ row: 1, message: missingHeaderMessage(missing) });
    return done();
  }

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const text = (k: FixedKey) => (colOf[k] ? cellText(row.getCell(colOf[k]).value) : '');
    const { cards, nums } = readGroups(row, groups, SENIOR_CARD_FIELDS);
    if (!cards.length && SENIOR_FIXED_COLUMNS.every((c) => normLine(text(c.key)) === '')) continue;

    const idText = normLine(text('id'));
    const detail = normLine(text('detailcategory_ko'));
    const delText = normLine(text('delete'));
    let id: number | null = null;
    let badId = false;
    if (idText) {
      if (/^\d+$/.test(idText)) id = Number(idText);
      else badId = true;
    }
    if (!detail) {
      problems.push({
        row: r,
        message: idText
          ? `번호 ${idText}인 줄의 세부 항목이 비어 있어요. 세부 항목을 적어 주세요.`
          : '세부 항목이 비어 있어요. 선배 FAQ 하나는 한 줄에 적어요. 두 번째 답변은 같은 줄의 제목2·답변2 칸에 적어 주세요.',
      });
      continue;
    }
    if (badId) problems.push({ row: r, message: `번호 칸('${idText}')을 읽지 못했어요. 번호 칸은 고치지 말고, 새 선배 FAQ는 번호를 비워 주세요.` });
    let del = false;
    if (delText === DELETE_MARK) del = true;
    else if (delText) problems.push({ row: r, message: `삭제 칸에는 '삭제'만 쓸 수 있어요. (지금: '${delText}')` });

    items.push({
      row: r,
      id,
      badId,
      del,
      view: {
        maincategory_ko: normLine(text('maincategory_ko')),
        maincategory_en: normLine(text('maincategory_en')),
        subcategory_ko: normLine(text('subcategory_ko')),
        subcategory_en: normLine(text('subcategory_en')),
        detailcategory_ko: detail,
        detailcategory_en: normLine(text('detailcategory_en')),
        manager: normLine(text('manager')),
        cards: cards as unknown as SeniorCard[],
      },
      cardRows: cards.map(() => r),
      cardGroups: nums,
    });
  }
  return done();
}

/** 예전 모양 (답변 카드 하나가 한 줄) 읽기 — 세부 항목 칸이 빈 줄은 바로 위 선배 FAQ의 다음 답변 */
function parseLegacySeniorSheet(ws: ExcelJS.Worksheet): { items: ParsedSenior[]; problems: Issue[]; warnings: Issue[] } {
  const problems: Issue[] = [];
  const warnings: Issue[] = [];
  const items: ParsedSenior[] = [];
  const done = () => ({ items, problems: problems.map(inSheet(SHEET)), warnings: warnings.map(inSheet(SHEET)) });

  const colOf = findColumns(ws, LEGACY_SENIOR_COLUMNS);
  const missing = LEGACY_SENIOR_COLUMNS.filter((c) => c.key !== 'delete' && !colOf[c.key]);
  if (missing.length) {
    problems.push({ row: 1, message: missingHeaderMessage(missing.map((c) => c.header)) });
    return done();
  }

  let cur: ParsedSenior | null = null;
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const text = (k: Key) => (colOf[k] ? cellText(row.getCell(colOf[k]).value) : '');
    if (LEGACY_SENIOR_COLUMNS.every((c) => normLine(text(c.key)) === '')) continue;

    const idText = normLine(text('id'));
    const detail = normLine(text('detailcategory_ko'));
    const delText = normLine(text('delete'));
    const card: SeniorCard = {
      title: normLine(text('title')),
      title_en: normLine(text('title_en')),
      answer: normMulti(text('answer')),
      answer_en: normMulti(text('answer_en')),
      url: normList(text('url')),
      latitude: normLine(text('latitude')),
      longitude: normLine(text('longitude')),
    };
    let id: number | null = null;
    let badId = false;
    if (idText) {
      if (/^\d+$/.test(idText)) id = Number(idText);
      else badId = true;
    }

    if (!detail) {
      if (!cur) {
        problems.push({ row: r, message: '세부 항목이 비어 있어요. 선배 FAQ 첫 줄에는 세부 항목을 꼭 적어 주세요.' });
        continue;
      }
      if (badId || (id !== null && id !== cur.id)) {
        problems.push({ row: r, message: `번호 ${idText}인 줄의 세부 항목이 비어 있어요. 세부 항목을 적어 주세요.` });
        continue;
      }
      const main = normLine(text('maincategory_ko'));
      const sub = normLine(text('subcategory_ko'));
      if ((main && main !== cur.view.maincategory_ko) || (sub && sub !== cur.view.subcategory_ko)) {
        problems.push({
          row: r,
          message: '세부 항목이 비어 있어서 위 선배 FAQ의 다음 답변으로 읽었는데, 대분류·소분류가 위와 달라요. 새 선배 FAQ라면 세부 항목을 적어 주세요.',
        });
        continue;
      }
      if (delText) {
        problems.push({ row: r, message: "'삭제'는 첫 줄(세부 항목이 있는 줄)에만 쓸 수 있어요. 답변 하나만 지우려면 그 줄을 통째로 지워 주세요." });
        continue;
      }
      if (!cardIsEmpty(card)) {
        cur.view.cards.push(card);
        cur.cardRows.push(r);
      }
      continue;
    }

    if (badId) problems.push({ row: r, message: `번호 칸('${idText}')을 읽지 못했어요. 번호 칸은 고치지 말고, 새 선배 FAQ는 번호를 비워 주세요.` });
    let del = false;
    if (delText === DELETE_MARK) del = true;
    else if (delText) problems.push({ row: r, message: `삭제 칸에는 '삭제'만 쓸 수 있어요. (지금: '${delText}')` });

    cur = {
      row: r,
      id,
      badId,
      del,
      view: {
        maincategory_ko: normLine(text('maincategory_ko')),
        maincategory_en: normLine(text('maincategory_en')),
        subcategory_ko: normLine(text('subcategory_ko')),
        subcategory_en: normLine(text('subcategory_en')),
        detailcategory_ko: detail,
        detailcategory_en: normLine(text('detailcategory_en')),
        manager: normLine(text('manager')),
        cards: [],
      },
      cardRows: [],
    };
    if (!cardIsEmpty(card)) {
      cur.view.cards.push(card);
      cur.cardRows.push(r);
    }
    items.push(cur);
  }
  return done();
}

// ───────────────────────── 비교 ─────────────────────────

export interface SeniorPlan {
  created: { row: number; view: SeniorView }[];
  updated: { id: number; row: number; before: SeniorView; after: SeniorView; changes: Change[] }[];
  deleted: { id: number; row: number; before: SeniorView }[];
  unchanged: number;
  missingFromFile: number[];
  problems: Issue[];
  warnings: Issue[];
  translateCount: number;
}

const SCALARS: (keyof Omit<SeniorView, 'cards'>)[] = [
  'maincategory_ko', 'maincategory_en', 'subcategory_ko', 'subcategory_en', 'detailcategory_ko', 'detailcategory_en', 'manager',
];
const CARD_FIELDS: (keyof SeniorCard)[] = ['title', 'title_en', 'answer', 'answer_en', 'url', 'latitude', 'longitude'];

export function diffSenior(before: SeniorView, after: SeniorView, autoTranslate = false): Change[] {
  const out: Change[] = [];
  for (const f of SCALARS) {
    if (before[f] !== after[f]) {
      const c: Change = { field: f, label: LABEL[f], before: before[f], after: after[f] };
      if (autoTranslate && f.endsWith('_en') && !after[f]) c.auto_translate = true;
      out.push(c);
    }
  }
  const n = Math.max(before.cards.length, after.cards.length);
  const empty: SeniorCard = { title: '', title_en: '', answer: '', answer_en: '', url: '', latitude: '', longitude: '' };
  for (let i = 0; i < n; i++) {
    const b = before.cards[i] ?? empty;
    const a = after.cards[i] ?? empty;
    for (const f of CARD_FIELDS) {
      if (b[f] === a[f]) continue;
      const c: Change = { field: `cards.${i}.${f}`, label: n > 1 ? `${LABEL[f]} ${i + 1}` : LABEL[f], before: b[f], after: a[f] };
      if (autoTranslate && f.endsWith('_en') && !a[f] && a[f.replace('_en', '') as keyof SeniorCard]) c.auto_translate = true;
      out.push(c);
    }
  }
  return out;
}

export function seniorBlankEnglish(v: SeniorView): string[] {
  const out: string[] = [];
  if (!v.maincategory_en && v.maincategory_ko) out.push('대분류(영어)');
  if (!v.subcategory_en && v.subcategory_ko) out.push('소분류(영어)');
  if (!v.detailcategory_en && v.detailcategory_ko) out.push('세부 항목(영어)');
  if (v.cards.some((c) => !c.title_en && c.title)) out.push('제목(영어)');
  if (v.cards.some((c) => !c.answer_en && c.answer)) out.push('답변(영어)');
  return out;
}

const k2 = (a: string, b: string) => `${a}\u0000${b}`;
const k3 = (a: string, b: string, c: string) => `${a}\u0000${b}\u0000${c}`;

export function buildSeniorPlan(
  parsed: { items: ParsedSenior[]; problems: Issue[]; warnings: Issue[] },
  dbRows: SeniorDbRow[],
  opts: { autoTranslate?: boolean } = {}
): SeniorPlan {
  const autoTranslate = !!opts.autoTranslate;
  const problems: Issue[] = [...parsed.problems];
  const warnings: Issue[] = [...parsed.warnings];
  const dbViews = new Map<number, SeniorView>();
  for (const r of sortRows(dbRows, ORDER_KEYS)) dbViews.set(Number(r.id), seniorRowToView(r));

  const mainEn = new Map<string, string>();
  const subEn = new Map<string, string>();
  const subsOf = new Map<string, Set<string>>();
  for (const v of dbViews.values()) {
    if (v.maincategory_en && !mainEn.has(v.maincategory_ko)) mainEn.set(v.maincategory_ko, v.maincategory_en);
    const k = k2(v.maincategory_ko, v.subcategory_ko);
    if (v.subcategory_en && !subEn.has(k)) subEn.set(k, v.subcategory_en);
    if (!subsOf.has(v.maincategory_ko)) subsOf.set(v.maincategory_ko, new Set());
    subsOf.get(v.maincategory_ko)!.add(v.subcategory_ko);
  }
  for (const it of parsed.items) {
    if (it.del) continue;
    const v = it.view;
    if (v.maincategory_en && !mainEn.has(v.maincategory_ko)) mainEn.set(v.maincategory_ko, v.maincategory_en);
    const k = k2(v.maincategory_ko, v.subcategory_ko);
    if (v.subcategory_en && !subEn.has(k)) subEn.set(k, v.subcategory_en);
  }

  const plan: SeniorPlan = { created: [], updated: [], deleted: [], unchanged: 0, missingFromFile: [], problems, warnings, translateCount: 0 };
  const seen = new Map<number, number>();
  const finalOf = new Map<number, SeniorView>(); // 파일로 남는 기존 항목

  for (const it of parsed.items) {
    if (it.badId) continue;
    if (it.id !== null) {
      if (!dbViews.has(it.id)) {
        problems.push({ row: it.row, message: `번호 ${it.id}인 선배 FAQ가 없어요. 번호는 고치지 말고, 새 선배 FAQ는 번호를 비워 주세요.` });
        continue;
      }
      if (seen.has(it.id)) {
        problems.push({ row: it.row, message: `같은 번호(${it.id})가 ${seen.get(it.id)}번째 줄에도 있어요. 같은 항목은 한 번만 적어 주세요.` });
        continue;
      }
      seen.set(it.id, it.row);
    }
    if (it.del) {
      if (it.id === null) warnings.push({ row: it.row, message: "번호가 없는 새 줄에 '삭제'를 적어서 건너뛰었어요." });
      else plan.deleted.push({ id: it.id, row: it.row, before: dbViews.get(it.id)! });
      continue;
    }
    const v = it.view;
    if (!v.maincategory_en) v.maincategory_en = mainEn.get(v.maincategory_ko) ?? '';
    if (!v.subcategory_en) v.subcategory_en = subEn.get(k2(v.maincategory_ko, v.subcategory_ko)) ?? '';

    const before = problems.length;
    if (!v.maincategory_ko) problems.push({ row: it.row, message: '대분류가 비어 있어요.' });
    if (!v.subcategory_ko) problems.push({ row: it.row, message: '소분류가 비어 있어요.' });
    if (!v.cards.some((c) => c.answer)) problems.push({ row: it.row, message: '답변이 비어 있어요. 답변을 하나 이상 적어 주세요.' });
    else v.cards.forEach((c, i) => {
      if (c.answer) return;
      const g = it.cardGroups?.[i];
      problems.push({
        row: it.cardRows[i],
        message: g
          ? `답변${g} 칸이 비어 있어요. 답변${g}을(를) 적거나, 필요 없는 답변이면 답변${g} 묶음 칸(제목${g}·링크${g}·위도${g}·경도${g} 포함)을 모두 비워 주세요.`
          : '답변 칸이 비어 있어요. 이 줄의 답변을 적거나 줄을 지워 주세요.',
      });
    });
    for (const [field, max] of Object.entries(MAX_LEN) as [keyof SeniorView, number][]) {
      const s = v[field] as string;
      if (s.length > max) problems.push({ row: it.row, message: `${LABEL[field]} 칸이 너무 길어요. ${max}자까지 쓸 수 있어요. (지금 ${s.length}자)` });
    }
    const ans = seniorViewToAnswers(v);
    if (Buffer.byteLength(JSON.stringify(ans.answer_ko)) > 65535 || Buffer.byteLength(JSON.stringify(ans.answer_en)) > 65535) {
      problems.push({ row: it.row, message: '답변이 너무 길어요. 답변을 줄이거나 나눠 주세요.' });
    }
    if (problems.length !== before) continue;

    if (it.id === null) plan.created.push({ row: it.row, view: v });
    else {
      finalOf.set(it.id, v);
      const prev = dbViews.get(it.id)!;
      const changes = diffSenior(prev, v, autoTranslate);
      if (changes.length) plan.updated.push({ id: it.id, row: it.row, before: prev, after: v, changes });
      else plan.unchanged++;
    }
  }
  plan.missingFromFile = [...dbViews.keys()].filter((id) => !seen.has(id));

  // 같은 대분류·소분류·세부 항목이 둘 (새로 넣거나 분류를 바꾼 항목만)
  const deletedIds = new Set(plan.deleted.map((d) => d.id));
  const updatedById = new Map(plan.updated.map((u) => [u.id, u]));
  const byKey = new Map<string, { label: string; row: number | null; touched: boolean }[]>();
  const add = (v: SeniorView, e: { label: string; row: number | null; touched: boolean }) => {
    const k = k3(v.maincategory_ko, v.subcategory_ko, v.detailcategory_ko).toLowerCase();
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(e);
  };
  for (const [id, prev] of dbViews) {
    if (deletedIds.has(id)) continue;
    const v = finalOf.get(id) ?? prev;
    const u = updatedById.get(id);
    const moved = !!u && k3(u.before.maincategory_ko, u.before.subcategory_ko, u.before.detailcategory_ko) !== k3(v.maincategory_ko, v.subcategory_ko, v.detailcategory_ko);
    add(v, { label: `번호 ${id}`, row: u?.row ?? seen.get(id) ?? null, touched: moved });
  }
  for (const c of plan.created) add(c.view, { label: `${c.row}번째 줄`, row: c.row, touched: true });
  const dupRows = new Set<number>();
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    for (const e of group) {
      if (!e.touched || e.row === null) continue;
      problems.push({ row: e.row, message: `대분류·소분류·세부 항목이 ${group.filter((o) => o !== e).map((o) => o.label).join(', ')}와 똑같아요. 세부 항목 이름을 다르게 적어 주세요.` });
      dupRows.add(e.row);
    }
  }
  plan.created = plan.created.filter((c) => !dupRows.has(c.row));
  plan.updated = plan.updated.filter((u) => !dupRows.has(u.row));

  // 비슷한 분류 이름, 빈 영어 칸
  const touched = [...plan.created.map((c) => ({ row: c.row, v: c.view })), ...plan.updated.map((u) => ({ row: u.row, v: u.after }))];
  const warned = new Set<string>();
  const mains = [...subsOf.keys()];
  for (const { row, v } of touched) {
    if (!subsOf.has(v.maincategory_ko)) {
      const sim = mains.find((m) => looseKey(m) === looseKey(v.maincategory_ko));
      if (sim && !warned.has('m' + v.maincategory_ko)) {
        warned.add('m' + v.maincategory_ko);
        warnings.push({ row, message: `새 대분류 '${v.maincategory_ko}' — 기존 '${sim}' 과 비슷해요. 같은 분류라면 기존 이름과 똑같이 적어 주세요.` });
      }
    } else if (!subsOf.get(v.maincategory_ko)!.has(v.subcategory_ko)) {
      const sim = [...subsOf.get(v.maincategory_ko)!].find((x) => looseKey(x) === looseKey(v.subcategory_ko));
      if (sim && !warned.has('s' + v.subcategory_ko)) {
        warned.add('s' + v.subcategory_ko);
        warnings.push({ row, message: `새 소분류 '${v.subcategory_ko}' — 기존 '${sim}' 과 비슷해요. 같은 분류라면 기존 이름과 똑같이 적어 주세요.` });
      }
    }
    const blanks = seniorBlankEnglish(v);
    if (blanks.length) {
      plan.translateCount += blanks.length;
      warnings.push({
        row,
        message: autoTranslate
          ? `영어 칸이 비어 있어요 (${blanks.join(', ')}). 적용할 때 자동으로 번역해요.`
          : `영어 칸이 비어 있어요 (${blanks.join(', ')}).`,
      });
    }
  }

  const byRow = (a: Issue, b: Issue) => (a.row ?? 0) - (b.row ?? 0);
  plan.problems = problems.map(inSheet(SHEET)).sort(byRow);
  plan.warnings = warnings.map(inSheet(SHEET)).sort(byRow);
  return plan;
}

/** 새로 넣거나 분류를 옮긴 선배 FAQ의 순서 — 기존 분류는 그대로, 새 분류는 그 안의 맨 뒤 */
export function makeSeniorOrderAssigner(dbRows: SeniorDbRow[]) {
  const main = new Map<string, number>();
  const sub = new Map<string, number>();
  const detail = new Map<string, number>();
  const maxSub = new Map<string, number>();
  const maxDetail = new Map<string, number>();
  let maxMain = 0;
  for (const r of sortRows(dbRows, ORDER_KEYS)) {
    const m = normLine(r.maincategory_ko);
    const s = normLine(r.subcategory_ko);
    const d = normLine(r.detailcategory_ko);
    const co = Number(r.category_order ?? 0);
    const so = Number(r.subcategory_order ?? 1);
    const dO = Number(r.detailcategory_order ?? 1);
    if (!main.has(m)) main.set(m, co);
    if (!sub.has(k2(m, s))) sub.set(k2(m, s), so);
    if (!detail.has(k3(m, s, d))) detail.set(k3(m, s, d), dO);
    maxMain = Math.max(maxMain, co);
    maxSub.set(m, Math.max(maxSub.get(m) ?? 0, so));
    maxDetail.set(k2(m, s), Math.max(maxDetail.get(k2(m, s)) ?? 0, dO));
  }
  return (m: string, s: string, d: string) => {
    if (!main.has(m)) main.set(m, ++maxMain);
    if (!sub.has(k2(m, s))) {
      const n = (maxSub.get(m) ?? 0) + 1;
      sub.set(k2(m, s), n);
      maxSub.set(m, n);
    }
    if (!detail.has(k3(m, s, d))) {
      const n = (maxDetail.get(k2(m, s)) ?? 0) + 1;
      detail.set(k3(m, s, d), n);
      maxDetail.set(k2(m, s), n);
    }
    return { category_order: main.get(m)!, subcategory_order: sub.get(k2(m, s))!, detailcategory_order: detail.get(k3(m, s, d))! };
  };
}
