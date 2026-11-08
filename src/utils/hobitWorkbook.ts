/**
 * hoBIT 데이터 엑셀 (시트 여러 개짜리 파일 하나)
 *   사용 방법 · 학부 FAQ · 대학원 FAQ · 공통 FAQ (행정실 FAQ를 대상별로) · 선배 FAQ · 담당자 · 이메일
 *   예전 파일의 'FAQ' 시트(한 시트에 모두)도 그대로 읽음
 * 올릴 때 없는 시트는 '바뀐 것 없음'으로 봄 (예전에 받은 FAQ만 있는 파일도 그대로 올릴 수 있음)
 * 적용 순서: FAQ → 선배 FAQ → 담당자 이름 바꾸기 → 이메일 바꾸기 (방금 고친 줄에도 이름·이메일 바꾸기가 적용됨)
 */
import ExcelJS from 'exceljs';
import {
  addFaqSheet,
  addStyledSheet,
  buildImportPlan,
  cellText,
  DbFaqRow,
  dbRowToView,
  findColumns,
  ImportPlan,
  Issue,
  normLine,
  parseCards,
  parseFaqSheet,
  SHEET_NAME as FAQ_SHEET,
  FAQ_SHEETS,
  ROW_SHEET_STEP,
} from './faqExcel';
import { addSeniorSheet, buildSeniorPlan, parseSeniorSheet, SENIOR_SHEET_NAME, SeniorDbRow, SeniorPlan } from './seniorFaqExcel';

export const HELP_SHEET = '사용 방법';
export const MANAGER_SHEET = '담당자';
export const EMAIL_SHEET = '이메일';

export interface HobitData {
  faqs: DbFaqRow[];
  seniorFaqs: SeniorDbRow[];
}

// ───────────────────────── 사용 방법 ─────────────────────────

const HELP_LINES: [string, boolean?][] = [
  ['hoBIT 데이터 엑셀 사용 방법', true],
  [''],
  ['기본', true],
  ['• 시트(아래 탭)마다 내용이 달라요: 학부 FAQ · 대학원 FAQ · 공통 FAQ (행정실 FAQ) · 선배 FAQ · 담당자 · 이메일'],
  ['• 다 고친 뒤 관리자 사이트 FAQ 화면의 [엑셀로 올리기]로 올리면, 바뀌는 내용을 먼저 보여 드려요. [적용하기]를 눌러야 실제로 바뀌어요.'],
  ['• 적용하기 전에 지금 상태를 자동으로 저장해 둬요. 잘못 올렸다면 [이전 상태로 되돌리기]를 쓰면 돼요.'],
  ['• 고치지 않을 시트는 그대로 두거나 지워도 돼요. 없는 시트는 바뀐 게 없는 걸로 봐요.'],
  ['• 첫 줄(칸 제목)과 번호 칸은 고치지 마세요. 번호로 어떤 항목인지 찾아요.'],
  [''],
  ['학부 FAQ · 대학원 FAQ · 공통 FAQ 시트 (행정실 FAQ)', true],
  ['• 행정실 FAQ를 대상별로 나눠 둔 시트예요. 학부: 학부 모드에서만 / 대학원: 대학원 모드에서만 / 공통: 둘 다 보여요.'],
  ['• 새 FAQ는 맞는 시트에 적으면 그 대상이 돼요. 대상을 바꾸려면 대상 칸에서 고르거나, FAQ 줄들(답변 줄 포함)을 다른 시트로 옮겨요.'],
  ['• 한 줄이 답변 하나예요. FAQ 첫 줄에 번호·대상·분류·질문·담당자를 적어요.'],
  ['• 답변이 여러 개인 FAQ는 바로 아래 줄에 질문 칸을 비우고 답변·링크·이메일·전화만 적어요.'],
  ['• 회색 칸은 위 FAQ의 두 번째 이후 답변 줄이라 입력이 막혀 있어요 (적으면 안내가 떠요). 새 FAQ는 새 줄에 적어 주세요.'],
  ['• 새 FAQ: 새 줄에 번호는 비우고 대상·대분류·소분류·질문·답변을 적어요. 답변이 두 개라면 그 아래 줄에 질문 칸을 비우고 두 번째 답변을 적어요.'],
  ['• 답변 하나만 지우려면 그 줄을 지우면 돼요. (FAQ 첫 줄은 지우지 마세요)'],
  [''],
  ['선배 FAQ 시트', true],
  ['• 행정실 FAQ 시트와 같아요. 세부 항목이 있는 줄이 새 항목의 첫 줄이고, 세부 항목이 빈 줄은 바로 위 항목의 다음 답변이에요.'],
  ['• 위도·경도는 지도를 보여 줄 때만 적어요. 대상 칸은 없어요 (선배 FAQ는 학부·대학원 모두에서 보여요).'],
  [''],
  ['지우기', true],
  ["• 지우려면 그 항목 첫 줄의 '삭제' 칸에서 '삭제'를 골라요."],
  ['• 엑셀에서 줄을 지워도 FAQ는 지워지지 않고 그대로 남아요. (실수로 지우는 일을 막으려고요)'],
  [''],
  ['영어 칸', true],
  ['• 영어 칸을 비워 두면 올릴 때 자동으로 번역해요. 한국어를 고쳤다면 영어 칸을 비워 두는 게 좋아요.'],
  ['• 분류 이름은 기존 이름과 똑같이 적어 주세요. 띄어쓰기만 달라도 새 분류가 생겨요.'],
  [''],
  ['담당자 시트', true],
  ['• 지금 쓰이는 담당자 이름과 FAQ 수예요. 바꿀 이름 칸에 적으면 행정실 FAQ·선배 FAQ의 그 담당자가 모두 새 이름으로 바뀌어요.'],
  ['• 바꿀 이름 칸을 비워 두면 그대로예요. FAQ 수 칸은 읽기만 해요.'],
  [''],
  ['이메일 시트', true],
  ['• 답변에 쓰인 이메일과 쓰인 답변 수예요. 바꿀 이메일 칸에 적으면 그 이메일이 쓰인 모든 답변에서 바뀌어요.'],
  ['• 바꿀 이메일 칸을 비워 두면 그대로예요.'],
  [''],
  ['그 밖에', true],
  ["• 분류 순서는 엑셀 줄 순서와 상관없어요. 순서는 관리자 사이트의 '카테고리 순서' 화면에서 바꿔요."],
];

function addHelpSheet(wb: ExcelJS.Workbook) {
  const help = wb.addWorksheet(HELP_SHEET);
  help.getColumn(1).width = 120;
  HELP_LINES.forEach(([text, bold], i) => {
    const cell = help.getCell(i + 1, 1);
    cell.value = text;
    cell.alignment = { wrapText: true, vertical: 'top' };
    if (bold) cell.font = { bold: true, size: i === 0 ? 14 : 11 };
  });
}

// ───────────────────────── 담당자 · 이메일 모으기 ─────────────────────────

/** 담당자 이름별 FAQ 수 (정리한 이름 기준, 원래 DB 값들도 같이) */
export function collectManagers(data: HobitData) {
  const map = new Map<string, { name: string; raw: Set<string>; faq: number; senior: number }>();
  const add = (raw: string, kind: 'faq' | 'senior') => {
    const name = normLine(raw);
    if (!name) return;
    if (!map.has(name)) map.set(name, { name, raw: new Set(), faq: 0, senior: 0 });
    const m = map.get(name)!;
    m.raw.add(String(raw));
    m[kind]++;
  };
  data.faqs.forEach((r) => add(r.manager, 'faq'));
  data.seniorFaqs.forEach((r) => add(r.manager, 'senior'));
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

/** 이메일 칸 하나 → 이메일들 (쉼표·세미콜론·줄바꿈으로 여러 개) */
export const splitEmails = (field: string) =>
  String(field ?? '')
    .split(/[,;\n]/)
    .map((e) => normLine(e))
    .filter(Boolean);

/** 이메일별 쓰인 답변 수 (행정실 FAQ 한국어 카드 기준 — 선배 FAQ 카드에는 이메일 칸이 없음) */
export function collectEmails(data: HobitData) {
  const map = new Map<string, number>();
  for (const r of data.faqs) {
    const cards = [...parseCards(r.answer_ko)];
    const en = parseCards(r.answer_en);
    en.forEach((c, i) => {
      if (!cards[i]) cards.push(c);
    });
    for (const c of cards) for (const e of new Set(splitEmails(c.email))) map.set(e, (map.get(e) ?? 0) + 1);
  }
  return [...map.entries()].map(([email, count]) => ({ email, count })).sort((a, b) => a.email.localeCompare(b.email));
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 카드 이메일 칸 안의 이메일만 바꿈 (구분 기호·나머지 이메일은 그대로) */
export function replaceEmailInField(field: string, from: string, to: string): string {
  const re = new RegExp(`(^|[,;\\n])(\\s*)${escapeRe(from)}(?=\\s*(?:[,;\\n]|$))`, 'g');
  return String(field ?? '').replace(re, (_m, sep, sp) => `${sep}${sp}${to}`);
}

// ───────────────────────── 엑셀 만들기 ─────────────────────────

const MANAGER_COLUMNS = [
  { key: 'name', header: '담당자', width: 20 },
  { key: 'faq', header: '행정실 FAQ 수', width: 14, numeric: true },
  { key: 'senior', header: '선배 FAQ 수', width: 13, numeric: true },
  { key: 'to', header: '바꿀 이름 (비우면 그대로)', width: 28 },
] as const;
const EMAIL_COLUMNS = [
  { key: 'email', header: '이메일', width: 34 },
  { key: 'count', header: '쓰인 답변 수', width: 13, numeric: true },
  { key: 'to', header: '바꿀 이메일 (비우면 그대로)', width: 34 },
] as const;

const READONLY_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FF7A7F87' } };

export function buildHobitWorkbook(data: HobitData): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'hoBIT';
  wb.created = new Date();
  addHelpSheet(wb);
  // 행정실 FAQ는 대상별 시트로 (대상 값이 이상하면 학부 시트)
  for (const sh of FAQ_SHEETS) {
    addFaqSheet(wb, data.faqs.filter((f) => dbRowToView(f).audience === sh.audience), sh.name); // 대상이 비면 처음 규칙
  }
  addSeniorSheet(wb, data.seniorFaqs);

  const ms = addStyledSheet(wb, MANAGER_SHEET, MANAGER_COLUMNS.map((c) => ({ ...c })));
  for (const m of collectManagers(data)) {
    const row = ms.addRow({ name: m.name, faq: m.faq, senior: m.senior, to: '' });
    row.getCell(2).font = READONLY_FONT;
    row.getCell(3).font = READONLY_FONT;
  }

  const es = addStyledSheet(wb, EMAIL_SHEET, EMAIL_COLUMNS.map((c) => ({ ...c })));
  for (const e of collectEmails(data)) {
    const row = es.addRow({ email: e.email, count: e.count, to: '' });
    row.getCell(2).font = READONLY_FONT;
  }
  return wb;
}

export async function buildHobitXlsx(data: Partial<HobitData>): Promise<Buffer> {
  const wb = buildHobitWorkbook({ faqs: data.faqs ?? [], seniorFaqs: data.seniorFaqs ?? [] });
  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

// ───────────────────────── 엑셀 읽기 ─────────────────────────

type Pair = { row: number; from: string; to: string };

function parsePairs(
  ws: ExcelJS.Worksheet | undefined,
  sheet: string,
  cols: readonly { key: string; header: string }[],
  fromKey: string
): { pairs: Pair[]; problems: Issue[] } | null {
  if (!ws) return null;
  const colOf = findColumns(ws, cols as { key: string; header: string }[]);
  const need = [fromKey, 'to'];
  const missing = cols.filter((c) => need.includes(c.key) && !colOf[c.key]);
  if (missing.length) {
    return {
      pairs: [],
      problems: [{ sheet, row: 1, message: `칸 제목 ${missing.map((c) => `'${c.header}'`).join(', ')}을(를) 찾지 못했어요. 첫 줄(칸 제목)은 그대로 둬 주세요.` }],
    };
  }
  const pairs: Pair[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const from = normLine(cellText(row.getCell(colOf[fromKey]).value));
    const to = normLine(cellText(row.getCell(colOf.to).value));
    if (!from && !to) continue;
    pairs.push({ row: r, from, to });
  }
  return { pairs, problems: [] };
}

export interface ParsedHobit {
  faq: ReturnType<typeof parseFaqSheet>;
  senior: ReturnType<typeof parseSeniorSheet>;
  managers: ReturnType<typeof parsePairs>;
  emails: ReturnType<typeof parsePairs>;
  problems: Issue[];
}

/** 행정실 FAQ 시트들(학부·대학원·공통 + 예전 'FAQ')을 하나로 합침 — 줄 번호는 시트별로 겹치지 않게 바꿔 두고 나중에 되돌림 */
function parseFaqSheets(get: (name: string) => ExcelJS.Worksheet | undefined): ReturnType<typeof parseFaqSheet> {
  const sheets = [...FAQ_SHEETS, { name: FAQ_SHEET, audience: 'undergraduate' as const }];
  let found = false;
  const out = { faqs: [] as NonNullable<ReturnType<typeof parseFaqSheet>>['faqs'], problems: [] as Issue[], warnings: [] as Issue[] };
  sheets.forEach((sh, i) => {
    const p = parseFaqSheet(get(sh.name), sh.name, sh.audience, (i + 1) * ROW_SHEET_STEP);
    if (!p) return;
    found = true;
    out.faqs.push(...p.faqs);
    out.problems.push(...p.problems);
    out.warnings.push(...p.warnings);
  });
  return found ? out : null;
}

const FAQ_SHEET_NAMES = [...FAQ_SHEETS.map((s) => s.name), FAQ_SHEET];
/** 합칠 때 바꿔 둔 줄 번호 → (시트, 실제 줄) */
export const decodeFaqRow = (row: number | null): { sheet?: string; row: number | null } =>
  row !== null && row >= ROW_SHEET_STEP
    ? { sheet: FAQ_SHEET_NAMES[Math.floor(row / ROW_SHEET_STEP) - 1], row: row % ROW_SHEET_STEP }
    : { row };
const decodeIssue = (i: Issue): Issue => {
  const d = decodeFaqRow(i.row);
  return d.sheet ? { ...i, sheet: d.sheet, row: d.row } : i;
};
const faqRowLabel = (row: number) => {
  const d = decodeFaqRow(row);
  return d.sheet ? `${d.sheet} ${d.row}번째 줄` : `${row}번째 줄`;
};

export async function parseHobitXlsx(buffer: Buffer): Promise<ParsedHobit> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as any);
  } catch {
    return {
      faq: null,
      senior: null,
      managers: null,
      emails: null,
      problems: [{ row: null, message: '엑셀 파일을 열지 못했어요. 받은 엑셀(.xlsx) 파일을 저장해서 다시 올려 주세요.' }],
    };
  }
  const get = (name: string) => wb.worksheets.find((w) => w.name.trim() === name);
  const parsed: ParsedHobit = {
    faq: parseFaqSheets(get),
    senior: parseSeniorSheet(get(SENIOR_SHEET_NAME)),
    managers: parsePairs(get(MANAGER_SHEET), MANAGER_SHEET, MANAGER_COLUMNS, 'name'),
    emails: parsePairs(get(EMAIL_SHEET), EMAIL_SHEET, EMAIL_COLUMNS, 'email'),
    problems: [],
  };
  if (!parsed.faq && !parsed.senior && !parsed.managers && !parsed.emails) {
    parsed.problems.push({ row: null, message: "'학부 FAQ', '대학원 FAQ', '공통 FAQ', '선배 FAQ', '담당자', '이메일' 시트를 하나도 찾지 못했어요. [엑셀로 받기]로 받은 파일을 고쳐서 올려 주세요." });
  }
  return parsed;
}

// ───────────────────────── 비교 ─────────────────────────

export interface ManagerRename {
  row: number;
  from: string;
  to: string;
  raw: string[]; // DB에 실제로 있는 값들 (앞뒤 공백 등이 다를 수 있음)
  faq_count: number;
  senior_count: number;
}
export interface EmailReplace {
  row: number;
  from: string;
  to: string;
  count: number;
}

export interface HobitPlan {
  faq: ImportPlan | null;
  senior: SeniorPlan | null;
  managers: ManagerRename[];
  emails: EmailReplace[];
  missingSheets: string[];
  problems: Issue[];
  warnings: Issue[];
}

/** 바꾸기 목록 확인 — 같은 값을 두 번, 서로 이어지는 바꾸기(A→B, B→C), 없는 값 */
function checkPairs(
  pairs: Pair[],
  sheet: string,
  existing: Set<string>,
  noun: string,
  validate: (to: string) => string | null
): { ok: Pair[]; problems: Issue[]; warnings: Issue[] } {
  const problems: Issue[] = [];
  const warnings: Issue[] = [];
  const ok: Pair[] = [];
  // 같은 값이 여러 줄이면 바꿀 값이 적힌 줄을 씀 (서로 다르면 문제)
  const chosen = new Map<string, Pair>();
  for (const p of pairs) {
    if (!p.from) {
      if (p.to) problems.push({ sheet, row: p.row, message: `${noun} 칸이 비어 있어요. 새 ${noun}은(는) 여기서 추가할 수 없어요.` });
      continue;
    }
    const prev = chosen.get(p.from);
    if (!prev || (!prev.to && p.to)) chosen.set(p.from, p);
    else if (p.to && prev.to !== p.to) {
      problems.push({ sheet, row: p.row, message: `'${p.from}'이(가) ${prev.row}번째 줄에도 있는데 바꿀 값이 달라요. 하나만 남겨 주세요.` });
    }
  }
  for (const p of chosen.values()) {
    if (!p.to || p.to === p.from) continue;
    if (!existing.has(p.from)) {
      warnings.push({ sheet, row: p.row, message: `'${p.from}'은(는) 지금 쓰이지 않아서 건너뛰었어요.` });
      continue;
    }
    const err = validate(p.to);
    if (err) {
      problems.push({ sheet, row: p.row, message: err });
      continue;
    }
    ok.push(p);
  }
  const froms = new Set(ok.map((p) => p.from));
  for (const p of ok) {
    if (froms.has(p.to)) {
      problems.push({ sheet, row: p.row, message: `바꿀 값 '${p.to}'도 다른 줄에서 바뀌어요. 한 번에 하나씩만 바꿔 주세요.` });
    } else if (existing.has(p.to)) {
      warnings.push({ sheet, row: p.row, message: `'${p.to}'은(는) 이미 쓰이고 있어서 '${p.from}'과 합쳐져요.` });
    }
  }
  return { ok, problems, warnings };
}

export function buildHobitPlan(parsed: ParsedHobit, data: HobitData, opts: { autoTranslate?: boolean } = {}): HobitPlan {
  const plan: HobitPlan = { faq: null, senior: null, managers: [], emails: [], missingSheets: [], problems: [...parsed.problems], warnings: [] };
  if (parsed.problems.length) return plan;

  if (parsed.faq) {
    plan.faq = buildImportPlan(parsed.faq, data.faqs, { ...opts, rowLabel: faqRowLabel });
    // 줄 번호를 시트별 실제 줄로 되돌림 (항목에는 sheet를 붙임)
    plan.faq.problems = plan.faq.problems.map(decodeIssue);
    plan.faq.warnings = plan.faq.warnings.map(decodeIssue);
    for (const list of [plan.faq.created, plan.faq.updated, plan.faq.deleted] as { row: number; sheet?: string }[][]) {
      for (const it of list) {
        const d = decodeFaqRow(it.row);
        if (d.sheet) Object.assign(it, { sheet: d.sheet, row: d.row });
      }
    }
    plan.problems.push(...plan.faq.problems);
    plan.warnings.push(...plan.faq.warnings);
  } else plan.missingSheets.push('행정실 FAQ');

  if (parsed.senior) {
    plan.senior = buildSeniorPlan(parsed.senior, data.seniorFaqs, opts);
    plan.problems.push(...plan.senior.problems);
    plan.warnings.push(...plan.senior.warnings);
  } else plan.missingSheets.push(SENIOR_SHEET_NAME);

  if (parsed.managers) {
    plan.problems.push(...parsed.managers.problems);
    const managers = collectManagers(data);
    const byName = new Map(managers.map((m) => [m.name, m]));
    const r = checkPairs(parsed.managers.pairs, MANAGER_SHEET, new Set(byName.keys()), '담당자', (to) =>
      to.length > 45 ? `이름이 너무 길어요. 45자까지 쓸 수 있어요. (지금 ${to.length}자)` : null
    );
    plan.problems.push(...r.problems);
    plan.warnings.push(...r.warnings);
    plan.managers = r.ok.map((p) => {
      const m = byName.get(p.from)!;
      return { row: p.row, from: p.from, to: p.to, raw: [...m.raw], faq_count: m.faq, senior_count: m.senior };
    });
  } else plan.missingSheets.push(MANAGER_SHEET);

  if (parsed.emails) {
    plan.problems.push(...parsed.emails.problems);
    const counts = new Map(collectEmails(data).map((e) => [e.email, e.count]));
    const r = checkPairs(parsed.emails.pairs, EMAIL_SHEET, new Set(counts.keys()), '이메일', (to) =>
      /^[^\s@,;]+@[^\s@,;]+$/.test(to) ? null : `'${to}'은(는) 이메일 모양이 아니에요. 이메일 하나만 적어 주세요.`
    );
    plan.problems.push(...r.problems);
    plan.warnings.push(...r.warnings);
    plan.emails = r.ok.map((p) => ({ row: p.row, from: p.from, to: p.to, count: counts.get(p.from) ?? 0 }));
  } else plan.missingSheets.push(EMAIL_SHEET);

  return plan;
}

export const planChangeCount = (p: HobitPlan) =>
  (p.faq ? p.faq.created.length + p.faq.updated.length + p.faq.deleted.length : 0) +
  (p.senior ? p.senior.created.length + p.senior.updated.length + p.senior.deleted.length : 0) +
  p.managers.length +
  p.emails.length;
