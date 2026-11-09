/**
 * hoBIT 데이터 엑셀 (시트 여러 개짜리 파일 하나)
 *   사용 방법 · 학부 FAQ · 대학원 FAQ · 공통 FAQ (행정실 FAQ를 대상별로) · 선배 FAQ · 담당자 · 이메일 · 키워드 규칙 · 프로필 항목
 *   예전 파일의 'FAQ' 시트(한 시트에 모두)도 그대로 읽음
 * 올릴 때 없는 시트는 '바뀐 것 없음'으로 봄 (예전에 받은 FAQ만 있는 파일도 그대로 올릴 수 있음)
 * 적용 순서: FAQ → 선배 FAQ → 담당자 이름 바꾸기 → 이메일 바꾸기 → 키워드 규칙 → 프로필 항목
 *   (방금 고친 줄에도 이름·이메일 바꾸기가 적용됨)
 * 범위(scope)
 *   all    — 위 시트 모두 (행정실·개발자 계정)
 *   senior — 사용 방법(근로장학생용) + 선배 FAQ만. 올릴 때도 선배 FAQ 시트만 읽음 (근로장학생 계정)
 */
import ExcelJS from 'exceljs';
import {
  addFaqSheet,
  faqChoicesOf,
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
  maxFaqCards,
  ROW_SHEET_STEP,
} from './faqExcel';
import { addSeniorSheet, buildSeniorPlan, parseSeniorSheet, SENIOR_SHEET_NAME, SeniorDbRow, SeniorPlan } from './seniorFaqExcel';
import {
  addKeywordSheet,
  buildKeywordPlan,
  KEYWORD_SHEET,
  KeywordPlan,
  KeywordRuleDbRow,
  MAX_KEYWORD_PINNED,
  parseKeywordSheet,
  SearchSource,
} from './keywordRuleExcel';
import { addProfileSheet, buildProfilePlan, parseProfileSheet, PROFILE_SHEET, ProfileOptionDbRow, ProfilePlan } from './profileOptionExcel';

export const HELP_SHEET = '사용 방법';
export const MANAGER_SHEET = '담당자';
export const EMAIL_SHEET = '이메일';
export { KEYWORD_SHEET, PROFILE_SHEET };

export type ExcelScope = 'all' | 'senior';

export interface HobitData {
  faqs: DbFaqRow[];
  seniorFaqs: SeniorDbRow[];
  keywordRules?: KeywordRuleDbRow[];
  profileOptions?: ProfileOptionDbRow[];
}

export interface WorkbookOptions {
  scope?: ExcelScope;
  /** 키워드 규칙 '먼저 찾아볼 곳' 선택지 (RAG GET /search/sources). 못 받았으면 null — id를 그대로 보여 줌 */
  sources?: SearchSource[] | null;
}

// ───────────────────────── 사용 방법 ─────────────────────────

type HelpLine = [string, boolean?];

const HELP_LINES: HelpLine[] = [
  ['hoBIT 데이터 엑셀 사용 방법', true],
  [''],
  ['기본', true],
  ['• 시트(아래 탭)마다 내용이 달라요: 학부 FAQ · 대학원 FAQ · 공통 FAQ (행정실 FAQ) · 선배 FAQ · 담당자 · 이메일 · 키워드 규칙 · 프로필 항목'],
  ['• 다 고친 뒤 관리자 사이트 FAQ 화면의 [엑셀로 올리기]로 올리면, 바뀌는 내용을 먼저 보여 드려요. [적용하기]를 눌러야 실제로 바뀌어요.'],
  ['• 적용하기 전에 지금 상태를 자동으로 저장해 둬요. 잘못 올렸다면 [이전 상태로 되돌리기]를 쓰면 돼요.'],
  ['• 고치지 않을 시트는 그대로 두거나 지워도 돼요. 없는 시트는 바뀐 게 없는 걸로 봐요.'],
  ['• 첫 줄(칸 제목)과 번호 칸은 고치지 마세요. 번호로 어떤 항목인지 찾아요.'],
  [''],
  ['학부 FAQ · 대학원 FAQ · 공통 FAQ 시트 (행정실 FAQ)', true],
  ['• 행정실 FAQ를 대상별로 나눠 둔 시트예요. 학부: 학부 모드에서만 / 대학원: 대학원 모드에서만 / 공통: 둘 다 보여요.'],
  ['• 한 줄이 FAQ 하나예요. 번호·대상·분류·질문과 답변들, 담당자가 모두 한 줄에 있어요.'],
  ['• 답변 하나는 답변1 · 답변1(영어) · 링크1 · 이메일1 · 전화1 칸 다섯 개가 한 묶음이에요. 칸 제목 색이 묶음마다 번갈아 달라요.'],
  ['• 답변을 하나 더 넣으려면 그 줄의 다음 빈 묶음(예: 답변2 · 답변2(영어) · 링크2 · 이메일2 · 전화2)을 채우면 돼요.'],
  ['• 답변 하나를 지우려면 그 묶음의 다섯 칸을 모두 비우면 돼요. 중간 묶음을 비워도 남은 답변은 순서대로 이어 붙여요.'],
  ['• 4~7번째 답변 칸은 접혀 있어요. 왼쪽 위의 숫자 [2]를 누르거나, 칸 제목 위쪽의 [+]를 누르면 펼쳐져요. [1]을 누르면 다시 접혀요.'],
  ['• 왼쪽 칸(번호 ~ 질문)과 첫 줄은 고정돼 있어서, 오른쪽으로 넘겨도 어떤 FAQ인지 보여요.'],
  ['• 새 FAQ는 맞는 시트의 빈 줄에 번호는 비우고 대상·대분류·소분류·질문·답변1을 적어요. 그 시트가 대상이 돼요.'],
  ['• 대상을 바꾸려면 대상 칸에서 고르거나, 그 줄을 다른 시트로 옮겨요. (대상 칸이 시트보다 우선이에요)'],
  ['• 줄마다 FAQ 하나라서 정렬·필터를 써도 괜찮아요. 줄 순서는 바뀌어도 상관없어요.'],
  [''],
  ['선배 FAQ 시트', true],
  ['• 행정실 FAQ 시트와 같아요. 한 줄이 선배 FAQ 하나이고, 답변 하나는 제목 · 제목(영어) · 답변 · 답변(영어) · 링크 · 위도 · 경도 칸 일곱 개가 한 묶음이에요.'],
  ['• 답변 칸이 세 묶음보다 많으면 4번째부터는 접혀 있어요. 펼치는 방법은 위와 같아요.'],
  ['• 위도·경도는 지도를 보여 줄 때만 적어요. 대상 칸은 없어요 (선배 FAQ는 학부·대학원 모두에서 보여요).'],
  [''],
  ['지우기', true],
  ["• FAQ를 지우려면 그 줄의 '삭제' 칸에서 '삭제'를 골라요. FAQ는 이 방법으로만 지워져요."],
  ['• 엑셀에서 줄을 지워도 FAQ는 지워지지 않고 그대로 남아요. (파일에 없는 FAQ는 그대로 둬요 — 실수로 지우는 일을 막으려고요)'],
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
  ['키워드 규칙 시트', true],
  ['• 한 줄이 키워드 규칙 하나예요. 대표 키워드와 연관 단어를 적으면, 학생이 연관 단어로 물어봐도 대표 키워드로 함께 찾아요.'],
  ['• 연관 단어와 먼저 찾아볼 곳은 쉼표(,)로 나눠 여러 개 적어요.'],
  [`• 고정 FAQ 번호에는 맨 위에 보여 줄 FAQ 번호를 쉼표로 나눠 적어요 (최대 ${MAX_KEYWORD_PINNED}개, 앞에 적은 것부터). FAQ 번호는 FAQ 시트의 번호 칸이에요.`],
  ['• 회색 글자인 고정 FAQ 질문 칸은 어떤 FAQ인지 보여 주는 칸이라, 고쳐도 반영되지 않아요.'],
  ['• 대표 키워드는 규칙마다 달라야 해요 (띄어쓰기·대소문자만 다른 것도 같은 키워드로 봐요).'],
  ['• 새 규칙은 빈 줄에 번호를 비우고 적어요. 지우려면 삭제 칸에서 \'삭제\'를 골라요.'],
  [''],
  ['프로필 항목 시트', true],
  ['• 학생이 고르는 학과 · 전공 유형 · 학적 상태 · 대학원 학과예요. 한 줄이 항목 하나예요.'],
  ['• 종류는 드롭다운에서 골라요. 이미 있는 항목의 종류는 바꿀 수 없어요.'],
  ['• 이름은 한국어로, 영어 이름은 꼭 적어요. 다른 이름(줄임말·예전 이름)은 쉼표로 나눠 적어요.'],
  ['• 이름을 바꾸면 예전 이름은 다른 이름에 자동으로 남겨요 (예전 이름으로 저장된 학생 정보도 계속 맞게).'],
  ['• 같은 종류 안에서 이름이나 다른 이름이 겹치면 안 돼요.'],
  ['• 첫 입학 학번은 학과에만 적어요 (22 또는 2022). 그 전 학번 학생에게는 없는 학과로 안내해요.'],
  ["• 학생 선택지에서 잠시 빼려면 숨김 칸에서 '숨김'을 골라요. 학생 정보·문서가 있는 학과는 지우기보다 숨김을 권해요."],
  ['• 순서는 같은 종류 안에서 보여 주는 순서예요 (작은 숫자가 위). 비우면 그대로, 새 항목은 맨 뒤에 붙어요.'],
  ['• 종류마다 최소 1개는 남아 있어야 해요. 바꾼 내용은 1분쯤 뒤에 학생 화면에 보여요.'],
  [''],
  ['그 밖에', true],
  ["• 분류 순서는 엑셀 줄 순서와 상관없어요. 순서는 관리자 사이트의 '카테고리 순서' 화면에서 바꿔요."],
];

/** 근로장학생 계정용 (선배 FAQ만) */
const SENIOR_HELP_LINES: HelpLine[] = [
  ['hoBIT 선배 FAQ 엑셀 사용 방법', true],
  [''],
  ['기본', true],
  ['• 이 파일에는 선배 FAQ 시트만 있어요. 다른 시트를 더해서 올려도 선배 FAQ 시트만 반영해요.'],
  ['• 다 고친 뒤 관리자 사이트 선배 FAQ 화면의 [엑셀로 올리기]로 올리면, 바뀌는 내용을 먼저 보여 드려요. [적용하기]를 눌러야 실제로 바뀌어요.'],
  ['• 적용하기 전에 지금 선배 FAQ를 자동으로 저장해 둬요. 잘못 올렸다면 [이전 상태로 되돌리기]를 쓰면 돼요.'],
  ['• 첫 줄(칸 제목)과 번호 칸은 고치지 마세요. 번호로 어떤 항목인지 찾아요.'],
  [''],
  ['선배 FAQ 시트', true],
  ['• 한 줄이 선배 FAQ 하나예요. 답변 하나는 제목 · 제목(영어) · 답변 · 답변(영어) · 링크 · 위도 · 경도 칸 일곱 개가 한 묶음이에요.'],
  ['• 답변을 하나 더 넣으려면 그 줄의 다음 빈 묶음(예: 제목2 · 답변2 …)을 채우면 돼요. 묶음 칸을 모두 비우면 그 답변이 지워져요.'],
  ['• 답변 칸이 세 묶음보다 많으면 4번째부터는 접혀 있어요. 왼쪽 위의 숫자 [2]나 칸 제목 위쪽의 [+]를 누르면 펼쳐져요.'],
  ['• 위도·경도는 지도를 보여 줄 때만 적어요.'],
  ['• 새 선배 FAQ는 빈 줄에 번호는 비우고 대분류·소분류·세부 항목·답변1을 적어요.'],
  [''],
  ['지우기', true],
  ["• 선배 FAQ를 지우려면 그 줄의 '삭제' 칸에서 '삭제'를 골라요. 이 방법으로만 지워져요."],
  ['• 엑셀에서 줄을 지워도 선배 FAQ는 그대로 남아요.'],
  [''],
  ['영어 칸', true],
  ['• 영어 칸을 비워 두면 올릴 때 자동으로 번역해요. 한국어를 고쳤다면 영어 칸을 비워 두는 게 좋아요.'],
  ['• 분류 이름은 기존 이름과 똑같이 적어 주세요. 띄어쓰기만 달라도 새 분류가 생겨요.'],
];

function addHelpSheet(wb: ExcelJS.Workbook, scope: ExcelScope, sources?: SearchSource[] | null) {
  const help = wb.addWorksheet(HELP_SHEET);
  help.getColumn(1).width = 120;
  const lines: HelpLine[] = scope === 'senior' ? SENIOR_HELP_LINES : [...HELP_LINES];
  if (scope !== 'senior' && sources?.length) {
    const at = lines.findIndex(([t]) => t === '프로필 항목 시트') - 1; // 키워드 규칙 설명 끝
    lines.splice(at, 0, [`• 먼저 찾아볼 곳에 쓸 수 있는 이름: ${sources.map((x) => x.label).join(', ')}`]);
  }
  lines.forEach(([text, bold], i) => {
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

export function buildHobitWorkbook(data: HobitData, opts: WorkbookOptions = {}): ExcelJS.Workbook {
  const scope = opts.scope ?? 'all';
  const wb = new ExcelJS.Workbook();
  wb.creator = 'hoBIT';
  wb.created = new Date();
  addHelpSheet(wb, scope, opts.sources);
  if (scope === 'senior') {
    addSeniorSheet(wb, data.seniorFaqs);
    return wb;
  }
  // 행정실 FAQ는 대상별 시트로 (대상 값이 이상하면 학부 시트)
  // 세 시트의 답변 묶음 수는 똑같이 (가장 많은 답변 수 기준 — 시트끼리 줄을 옮겨도 칸이 맞게)
  const groups = maxFaqCards(data.faqs);
  const choices = faqChoicesOf(data.faqs.map(dbRowToView), collectManagers(data).map((m) => m.name)); // 드롭다운은 학부·대학원·공통 FAQ 전체 기준
  for (const sh of FAQ_SHEETS) {
    addFaqSheet(wb, data.faqs.filter((f) => dbRowToView(f).audience === sh.audience), sh.name, groups, choices); // 대상이 비면 처음 규칙
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

  addKeywordSheet(wb, data.keywordRules ?? [], data.faqs, opts.sources);
  addProfileSheet(wb, data.profileOptions ?? []);
  return wb;
}

export async function buildHobitXlsx(data: Partial<HobitData>, opts: WorkbookOptions = {}): Promise<Buffer> {
  const wb = buildHobitWorkbook(
    { faqs: data.faqs ?? [], seniorFaqs: data.seniorFaqs ?? [], keywordRules: data.keywordRules ?? [], profileOptions: data.profileOptions ?? [] },
    opts
  );
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
  scope: ExcelScope;
  faq: ReturnType<typeof parseFaqSheet>;
  senior: ReturnType<typeof parseSeniorSheet>;
  managers: ReturnType<typeof parsePairs>;
  emails: ReturnType<typeof parsePairs>;
  keywords: ReturnType<typeof parseKeywordSheet>;
  profileOptions: ReturnType<typeof parseProfileSheet>;
  /** 범위 밖이라 읽지 않은 시트 (선배 FAQ만 올릴 때) */
  ignoredSheets: string[];
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

/** 선배 FAQ 말고 이 파일이 읽을 수 있는 시트 이름들 */
const OTHER_DATA_SHEETS = [...FAQ_SHEET_NAMES, MANAGER_SHEET, EMAIL_SHEET, KEYWORD_SHEET, PROFILE_SHEET];

export async function parseHobitXlsx(buffer: Buffer, opts: { scope?: ExcelScope } = {}): Promise<ParsedHobit> {
  const scope = opts.scope ?? 'all';
  const empty: ParsedHobit = { scope, faq: null, senior: null, managers: null, emails: null, keywords: null, profileOptions: null, ignoredSheets: [], problems: [] };
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as any);
  } catch {
    return { ...empty, problems: [{ row: null, message: '엑셀 파일을 열지 못했어요. 받은 엑셀(.xlsx) 파일을 저장해서 다시 올려 주세요.' }] };
  }
  const get = (name: string) => wb.worksheets.find((w) => w.name.trim() === name);

  if (scope === 'senior') {
    const parsed: ParsedHobit = { ...empty, senior: parseSeniorSheet(get(SENIOR_SHEET_NAME)) };
    parsed.ignoredSheets = OTHER_DATA_SHEETS.filter((n) => get(n));
    if (!parsed.senior) {
      parsed.problems.push({ row: null, message: "'선배 FAQ' 시트를 찾지 못했어요. [엑셀로 받기]로 받은 파일을 고쳐서 올려 주세요." });
    }
    return parsed;
  }

  const parsed: ParsedHobit = {
    ...empty,
    faq: parseFaqSheets(get),
    senior: parseSeniorSheet(get(SENIOR_SHEET_NAME)),
    managers: parsePairs(get(MANAGER_SHEET), MANAGER_SHEET, MANAGER_COLUMNS, 'name'),
    emails: parsePairs(get(EMAIL_SHEET), EMAIL_SHEET, EMAIL_COLUMNS, 'email'),
    keywords: parseKeywordSheet(get(KEYWORD_SHEET)),
    profileOptions: parseProfileSheet(get(PROFILE_SHEET)),
  };
  if (!parsed.faq && !parsed.senior && !parsed.managers && !parsed.emails && !parsed.keywords && !parsed.profileOptions) {
    parsed.problems.push({
      row: null,
      message: "'학부 FAQ', '대학원 FAQ', '공통 FAQ', '선배 FAQ', '담당자', '이메일', '키워드 규칙', '프로필 항목' 시트를 하나도 찾지 못했어요. [엑셀로 받기]로 받은 파일을 고쳐서 올려 주세요.",
    });
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
  scope: ExcelScope;
  faq: ImportPlan | null;
  senior: SeniorPlan | null;
  managers: ManagerRename[];
  emails: EmailReplace[];
  keywords: KeywordPlan | null;
  profileOptions: ProfilePlan | null;
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

export function buildHobitPlan(
  parsed: ParsedHobit,
  data: HobitData,
  opts: { autoTranslate?: boolean; sources?: SearchSource[] | null } = {}
): HobitPlan {
  const plan: HobitPlan = {
    scope: parsed.scope,
    faq: null,
    senior: null,
    managers: [],
    emails: [],
    keywords: null,
    profileOptions: null,
    missingSheets: [],
    problems: [...parsed.problems],
    warnings: [],
  };
  if (parsed.problems.length) return plan;

  if (parsed.scope === 'senior') {
    if (parsed.ignoredSheets.length) {
      plan.warnings.push({ row: null, message: `선배 FAQ 시트만 반영해요. (${parsed.ignoredSheets.join(', ')} 시트는 읽지 않았어요)` });
    }
    if (parsed.senior) {
      plan.senior = buildSeniorPlan(parsed.senior, data.seniorFaqs, opts);
      plan.problems.push(...plan.senior.problems);
      plan.warnings.push(...plan.senior.warnings);
    }
    return plan;
  }

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

  if (parsed.keywords) {
    plan.keywords = buildKeywordPlan(parsed.keywords, data.keywordRules ?? [], {
      faqs: data.faqs,
      deletedFaqIds: new Set(plan.faq?.deleted.map((d) => d.id) ?? []),
      sources: opts.sources ?? null,
    });
    plan.problems.push(...plan.keywords.problems);
    plan.warnings.push(...plan.keywords.warnings);
  } else plan.missingSheets.push(KEYWORD_SHEET);

  if (parsed.profileOptions) {
    plan.profileOptions = buildProfilePlan(parsed.profileOptions, data.profileOptions ?? []);
    plan.problems.push(...plan.profileOptions.problems);
    plan.warnings.push(...plan.profileOptions.warnings);
  } else plan.missingSheets.push(PROFILE_SHEET);

  return plan;
}

const sheetChanges = (x: { created: unknown[]; updated: unknown[]; deleted: unknown[] } | null) =>
  x ? x.created.length + x.updated.length + x.deleted.length : 0;

export const planChangeCount = (p: HobitPlan) =>
  sheetChanges(p.faq) + sheetChanges(p.senior) + p.managers.length + p.emails.length + sheetChanges(p.keywords) + sheetChanges(p.profileOptions);
