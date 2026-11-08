/**
 * '프로필 항목' 시트 (profile_options) — 학생이 고르는 학과·전공 유형·학적 상태·대학원 학과, 항목 하나가 한 줄
 *   번호 | 종류 | 이름 | 영어 이름 | 다른 이름 (쉼표로 구분) | 첫 입학 학번 (학과만) | 숨김 | 순서 | 삭제
 *   순서: 같은 종류 안에서 보여 주는 순서 (1부터, DB sort_order = 순서 - 1). 비우면 기존 순서 그대로, 새 항목은 맨 뒤
 * 관리자 사이트 프로필 항목 화면(src/routes/api/profileOptions/profileOptionsIndex.ts)과 같은 규칙으로 확인해요
 *   - 이름은 한국어, 100자까지 / 영어 이름 꼭, 100자까지 / 다른 이름 하나에 50자, 20개까지
 *   - 첫 입학 학번은 학과만 (2자리·4자리 모두 받음, 1990 ~ 내년)
 *   - 이름을 바꾸면 예전 이름을 다른 이름에 자동으로 남김
 *   - 같은 종류 안에서 이름·다른 이름이 겹치면 안 됨 / 종류마다 최소 1개
 * 호빗 RAG가 1분마다 읽어서, 바꾼 내용은 1분쯤 뒤에 학생 화면에 보여요
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
  readIdCell,
  SimplePlan,
  splitList,
} from './sheetHelpers';

export const PROFILE_SHEET = '프로필 항목';
const SHEET = PROFILE_SHEET;
export const PROFILE_FIELDS = ['department', 'major_type', 'student_status', 'grad_department'] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];
export const PROFILE_FIELD_LABEL: Record<ProfileField, string> = {
  department: '학과',
  major_type: '전공 유형',
  student_status: '학적 상태',
  grad_department: '대학원 학과',
};
export const HIDDEN_MARK = '숨김';
const MAX_ALIASES = 20;

export interface ProfileOptionDbRow {
  id: number;
  field: string;
  value: string;
  label_en: string;
  aliases: unknown;
  first_cohort: number | null;
  sort_order: number;
  active: number | boolean;
  [key: string]: any;
}

export interface ProfileView {
  field: ProfileField;
  value: string;
  label_en: string;
  aliases: string[];
  first_cohort: number | null;
  active: boolean;
  sort_order: number | null; // null = 새 항목, 적용할 때 맨 뒤
}

export interface ParsedProfile {
  row: number;
  id: number | null;
  badId: boolean;
  del: boolean;
  field: ProfileField | null;
  value: string;
  label_en: string;
  aliases: string[];
  cohortText: string;
  hiddenText: string;
  orderText: string;
}

export type ProfilePlan = SimplePlan<ProfileView>;

type Key = 'id' | 'field' | 'value' | 'label_en' | 'aliases' | 'first_cohort' | 'hidden' | 'order' | 'delete';
export const PROFILE_COLUMNS: { key: Key; header: string; match: string; width: number; numeric?: boolean }[] = [
  { key: 'id', header: '번호', match: '번호', width: 7, numeric: true },
  { key: 'field', header: '종류', match: '종류', width: 12 },
  { key: 'value', header: '이름', match: '이름', width: 20 },
  { key: 'label_en', header: '영어 이름', match: '영어이름', width: 26 },
  { key: 'aliases', header: '다른 이름 (쉼표로 구분)', match: '다른이름', width: 32 },
  { key: 'first_cohort', header: '첫 입학 학번 (학과만)', match: '첫입학', width: 14, numeric: true },
  { key: 'hidden', header: '숨김', match: '숨김', width: 8 },
  { key: 'order', header: '순서', match: '순서', width: 7, numeric: true },
  { key: 'delete', header: '삭제', match: '삭제', width: 8 },
];

const fieldFromText = (t: string): ProfileField | null => {
  const k = nameKey(t);
  for (const f of PROFILE_FIELDS) if (nameKey(PROFILE_FIELD_LABEL[f]) === k || f === t) return f;
  return null;
};

// ───────────────────────── DB 줄 ↔ 엑셀 모양 ─────────────────────────

export function profileRowToView(r: ProfileOptionDbRow): ProfileView {
  const value = normLine(r.value);
  return {
    field: r.field as ProfileField,
    value,
    label_en: normLine(r.label_en),
    aliases: dedupLoose(parseJsonList(r.aliases).map((a) => normLine(a)), [value]),
    first_cohort: r.first_cohort === null || r.first_cohort === undefined ? null : Number(r.first_cohort),
    active: Boolean(Number(r.active ?? 1)),
    sort_order: Number(r.sort_order ?? 0),
  };
}

const fieldRank = (f: string) => {
  const i = PROFILE_FIELDS.indexOf(f as ProfileField);
  return i < 0 ? PROFILE_FIELDS.length : i;
};
export const sortProfileRows = <T extends { id: number; field: string; sort_order?: number | null }>(rows: T[]) =>
  [...rows].sort((a, b) => fieldRank(a.field) - fieldRank(b.field) || Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) || Number(a.id) - Number(b.id));

// ───────────────────────── 엑셀 만들기 ─────────────────────────

export function addProfileSheet(wb: ExcelJS.Workbook, rows: ProfileOptionDbRow[]): ExcelJS.Worksheet {
  const ws = addStyledSheet(wb, SHEET, PROFILE_COLUMNS.map((c) => ({ key: c.key, header: c.header, width: c.width, numeric: c.numeric })));
  for (const r of sortProfileRows(rows)) {
    const v = profileRowToView(r);
    ws.addRow({
      id: Number(r.id),
      field: PROFILE_FIELD_LABEL[v.field] ?? v.field,
      value: v.value,
      label_en: v.label_en,
      aliases: v.aliases.join(', '),
      first_cohort: v.first_cohort ?? '',
      hidden: v.active ? '' : HIDDEN_MARK,
      order: (v.sort_order ?? 0) + 1,
      delete: '',
    });
  }
  ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 1 }];
  const colOf = (k: Key) => PROFILE_COLUMNS.findIndex((c) => c.key === k) + 1;
  addListValidation(ws, colOf('field'), PROFILE_FIELDS.map((f) => PROFILE_FIELD_LABEL[f]), '종류', '학과, 전공 유형, 학적 상태, 대학원 학과 중에서 골라 주세요.');
  addListValidation(ws, colOf('hidden'), [HIDDEN_MARK], '숨김', "학생 선택지에서 숨기려면 '숨김'을 골라 주세요.");
  addListValidation(ws, colOf('delete'), [DELETE_MARK], '삭제', "항목을 지우려면 '삭제'를 골라 주세요.");
  ws.getRow(1).getCell(colOf('first_cohort')).note = '학과에만 적어요. 이 학과가 처음 생긴 학번이에요 (예: 22 또는 2022). 비우면 제한 없어요.';
  ws.getRow(1).getCell(colOf('order')).note = '같은 종류 안에서 보여 주는 순서예요. 작은 숫자가 위에 와요.';
  return ws;
}

// ───────────────────────── 엑셀 읽기 ─────────────────────────

export function parseProfileSheet(ws: ExcelJS.Worksheet | undefined): { items: ParsedProfile[]; problems: Issue[]; warnings: Issue[] } | null {
  if (!ws) return null;
  const problems: Issue[] = [];
  const items: ParsedProfile[] = [];
  const done = () => ({ items, problems: problems.map(inSheet(SHEET)), warnings: [] as Issue[] });

  const colOf = findLooseColumns(ws, PROFILE_COLUMNS);
  const missing = PROFILE_COLUMNS.filter((c) => c.key !== 'delete' && !colOf[c.key]).map((c) => c.header);
  if (missing.length) {
    problems.push({ row: 1, message: missingHeaderMessage(missing) });
    return done();
  }
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const text = (k: Key) => (colOf[k] ? normLine(cellText(row.getCell(colOf[k]!).value)) : '');
    if (PROFILE_COLUMNS.every((c) => text(c.key) === '')) continue;

    const idText = text('id');
    const { id, badId } = readIdCell(idText);
    if (badId) problems.push({ row: r, message: `번호 칸('${idText}')을 읽지 못했어요. 번호 칸은 고치지 말고, 새 항목은 번호를 비워 주세요.` });
    const delText = text('delete');
    let del = false;
    if (delText === DELETE_MARK) del = true;
    else if (delText) problems.push({ row: r, message: `삭제 칸에는 '삭제'만 쓸 수 있어요. (지금: '${delText}')` });
    const fieldText = text('field');
    const field = fieldFromText(fieldText);
    if (!del && !field) {
      problems.push({
        row: r,
        message: fieldText
          ? `종류에는 학과, 전공 유형, 학적 상태, 대학원 학과만 쓸 수 있어요. (지금: '${fieldText}')`
          : '종류가 비어 있어요. 학과, 전공 유형, 학적 상태, 대학원 학과 중에서 골라 주세요.',
      });
      continue;
    }
    items.push({
      row: r,
      id,
      badId,
      del,
      field,
      value: text('value'),
      label_en: text('label_en'),
      aliases: splitList(colOf.aliases ? cellText(row.getCell(colOf.aliases).value) : ''),
      cohortText: text('first_cohort'),
      hiddenText: text('hidden'),
      orderText: text('order'),
    });
  }
  return done();
}

// ───────────────────────── 비교 ─────────────────────────

const LABEL: Record<string, string> = {
  value: '이름',
  label_en: '영어 이름',
  aliases: '다른 이름',
  first_cohort: '첫 입학 학번',
  active: '숨김',
  sort_order: '순서',
};

const showProfile = (f: keyof ProfileView, v: ProfileView): string => {
  switch (f) {
    case 'aliases':
      return v.aliases.join(', ');
    case 'first_cohort':
      return v.first_cohort === null ? '' : String(v.first_cohort);
    case 'active':
      return v.active ? '보임' : '숨김';
    case 'sort_order':
      return v.sort_order === null ? '맨 뒤' : String(v.sort_order + 1);
    default:
      return String(v[f] ?? '');
  }
};

export function diffProfile(before: ProfileView, after: ProfileView): Change[] {
  const out: Change[] = [];
  for (const f of ['value', 'label_en', 'aliases', 'first_cohort', 'active', 'sort_order'] as (keyof ProfileView)[]) {
    const b = showProfile(f, before);
    const a = showProfile(f, after);
    if (b !== a) out.push({ field: f, label: LABEL[f], before: b, after: a });
  }
  return out;
}

/** 첫 입학 학번 글자 → 연도 (22 → 2022, 98 → 1998, 2022 → 2022). 못 읽으면 NaN */
export function parseCohort(text: string, thisYear = new Date().getFullYear()): number {
  const t = text.replace(/학번|년/g, '').trim();
  if (/^\d{2}$/.test(t)) {
    const n = Number(t);
    return n <= (thisYear + 1) % 100 ? 2000 + n : 1900 + n;
  }
  if (/^\d{4}$/.test(t)) return Number(t);
  return NaN;
}

export function buildProfilePlan(
  parsed: { items: ParsedProfile[]; problems: Issue[]; warnings: Issue[] },
  rows: ProfileOptionDbRow[],
  opts: { thisYear?: number } = {}
): ProfilePlan {
  const thisYear = opts.thisYear ?? new Date().getFullYear();
  const problems: Issue[] = [...parsed.problems];
  const warnings: Issue[] = [...parsed.warnings];
  const dbViews = new Map<number, ProfileView>();
  for (const r of rows) dbViews.set(Number(r.id), profileRowToView(r));

  const plan: ProfilePlan = { created: [], updated: [], deleted: [], unchanged: 0, missingFromFile: [], problems, warnings };
  const seen = new Map<number, number>();
  const finalOf = new Map<number, { row: number; view: ProfileView }>();

  for (const it of parsed.items) {
    if (it.badId) continue;
    if (it.id !== null) {
      if (!dbViews.has(it.id)) {
        problems.push({ row: it.row, message: `번호 ${it.id}인 프로필 항목이 없어요. 번호는 고치지 말고, 새 항목은 번호를 비워 주세요.` });
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

    const prev = it.id !== null ? dbViews.get(it.id)! : null;
    const field = it.field!;
    const before = problems.length;
    const p = (message: string) => problems.push({ row: it.row, message });
    if (prev && prev.field !== field) p(`종류는 바꿀 수 없어요. ('${PROFILE_FIELD_LABEL[prev.field]}' 그대로 둬 주세요. 다른 종류로 옮기려면 새 줄로 만들어 주세요)`);
    const value = it.value;
    if (!value) p('이름이 비어 있어요.');
    else if (value.length > 100) p(`이름이 너무 길어요. 100자까지 쓸 수 있어요. (지금 ${value.length}자)`);
    else if (!/[가-힣]/.test(value)) p('이름은 한국어로 적어 주세요. (문서·질문이 한국어 기준이에요)');
    if (!it.label_en) p('영어 이름이 비어 있어요.');
    else if (it.label_en.length > 100) p(`영어 이름이 너무 길어요. 100자까지 쓸 수 있어요. (지금 ${it.label_en.length}자)`);
    const long = it.aliases.filter((a) => a.length > 50);
    if (long.length) p(`다른 이름은 하나에 50자까지 쓸 수 있어요. ('${long[0].slice(0, 20)}…')`);
    const aliases = dedupLoose(it.aliases, [value]);
    // 이름을 바꾸면 예전 이름을 다른 이름에 남김 (예전 이름으로 정리된 문서·저장된 학생 정보도 계속 맞게)
    if (prev && value && nameKey(prev.value) !== nameKey(value) && !aliases.some((a) => nameKey(a) === nameKey(prev.value))) {
      aliases.push(prev.value);
      warnings.push({ row: it.row, message: `이름을 바꿔서 예전 이름 '${prev.value}'을(를) 다른 이름에 남겨 둘게요.` });
    }
    if (aliases.length > MAX_ALIASES) p(`다른 이름은 ${MAX_ALIASES}개까지 적을 수 있어요. (지금 ${aliases.length}개)`);

    let firstCohort: number | null = null;
    if (it.cohortText) {
      if (field !== 'department') p(`첫 입학 학번은 학과에만 적어요. (${PROFILE_FIELD_LABEL[field]}은(는) 비워 주세요)`);
      else {
        const y = parseCohort(it.cohortText, thisYear);
        if (!Number.isInteger(y) || y < 1990 || y > thisYear + 1) p(`첫 입학 학번은 22 또는 2022처럼 적어 주세요. (1990~${thisYear + 1}, 지금: '${it.cohortText}')`);
        else firstCohort = y;
      }
    }
    let active = true;
    if (it.hiddenText === HIDDEN_MARK) active = false;
    else if (it.hiddenText) p(`숨김 칸에는 '숨김'만 쓸 수 있어요. (지금: '${it.hiddenText}')`);
    let sortOrder: number | null = prev ? prev.sort_order : null;
    if (it.orderText) {
      if (!/^\d+$/.test(it.orderText) || Number(it.orderText) < 1 || Number(it.orderText) > 9999) p(`순서는 1 이상의 숫자로 적어 주세요. (지금: '${it.orderText}')`);
      else sortOrder = Number(it.orderText) - 1;
    }
    if (problems.length !== before) continue;

    const view: ProfileView = { field, value, label_en: it.label_en, aliases, first_cohort: firstCohort, active, sort_order: sortOrder };
    if (!prev) plan.created.push({ row: it.row, view });
    else {
      finalOf.set(it.id!, { row: it.row, view });
      const changes = diffProfile(prev, view);
      if (changes.length) plan.updated.push({ id: it.id!, row: it.row, before: prev, after: view, changes });
      else plan.unchanged++;
    }
  }
  plan.missingFromFile = [...dbViews.keys()].filter((id) => !seen.has(id));

  // 같은 종류 안에서 이름·다른 이름이 겹침 — 새로 넣거나 이름·다른 이름을 바꾼 항목만
  const deletedIds = new Set(plan.deleted.map((d) => d.id));
  const touchedIds = new Set(plan.updated.filter((u) => u.changes.some((c) => c.field === 'value' || c.field === 'aliases')).map((u) => u.id));
  type Entry = { label: string; value: string; row: number | null; touched: boolean; names: string[] };
  const byField = new Map<ProfileField, Entry[]>();
  const add = (v: ProfileView, e: Omit<Entry, 'names' | 'value'>) => {
    if (!byField.has(v.field)) byField.set(v.field, []);
    byField.get(v.field)!.push({ ...e, value: v.value, names: [v.value, ...v.aliases] });
  };
  for (const [id, prev] of dbViews) {
    if (deletedIds.has(id)) continue;
    const f = finalOf.get(id);
    add(f?.view ?? prev, { label: `번호 ${id}`, row: f?.row ?? seen.get(id) ?? null, touched: touchedIds.has(id) });
  }
  for (const c of plan.created) add(c.view, { label: `${c.row}번째 줄`, row: c.row, touched: true });
  const badRows = new Set<number>();
  for (const entries of byField.values()) {
    for (const e of entries) {
      if (!e.touched || e.row === null) continue;
      const mine = new Map(e.names.map((n) => [nameKey(n), n]));
      for (const o of entries) {
        if (o === e) continue;
        const dup = o.names.find((n) => mine.has(nameKey(n)));
        if (!dup) continue;
        problems.push({ row: e.row, message: `'${mine.get(nameKey(dup))}'은(는) 이미 '${o.value}'(${o.label})의 이름(또는 다른 이름)으로 쓰이고 있어요. 겹치면 학생 질문에서 어느 항목인지 정할 수 없어요.` });
        badRows.add(e.row);
        break;
      }
    }
  }
  plan.created = plan.created.filter((c) => !badRows.has(c.row));
  plan.updated = plan.updated.filter((u) => !badRows.has(u.row));

  // 종류마다 최소 1개
  for (const f of PROFILE_FIELDS) {
    const before = [...dbViews.values()].filter((v) => v.field === f).length;
    if (!before) continue;
    const left = (byField.get(f) ?? []).length;
    if (left === 0) {
      for (const d of plan.deleted.filter((x) => x.before.field === f)) {
        problems.push({ row: d.row, message: `${PROFILE_FIELD_LABEL[f]}은(는) 최소 1개는 남아 있어야 해요. 다 지울 수 없어요.` });
      }
    }
  }
  for (const d of plan.deleted) {
    if (d.before.field === 'department' || d.before.field === 'grad_department') {
      warnings.push({ row: d.row, message: `'${d.before.value}'을(를) 지우면 이 학과로 저장된 학생 정보·문서와 이어지지 않아요. 잠시 안 쓰는 거라면 지우기보다 '숨김'을 권해요.` });
    }
  }

  plan.problems = problems.map(inSheet(SHEET)).sort(byRow);
  plan.warnings = warnings.map(inSheet(SHEET)).sort(byRow);
  return plan;
}

/** 미리보기용 짧은 설명 */
export function profileSummary(v: ProfileView): string[] {
  const out = [`${PROFILE_FIELD_LABEL[v.field]} · ${v.label_en}`];
  if (v.aliases.length) out.push(`다른 이름: ${v.aliases.join(', ')}`);
  if (v.first_cohort !== null) out.push(`첫 입학 학번: ${v.first_cohort}`);
  if (!v.active) out.push('숨김');
  return out;
}
