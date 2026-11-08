/**
 * 키워드 규칙 · 프로필 항목 시트가 같이 쓰는 작은 도움 함수
 *   (행정실 FAQ·선배 FAQ 시트 도움 함수는 faqExcel.ts)
 */
import ExcelJS from 'exceljs';
import { cellText, Change, Issue, normLine } from './faqExcel';

/** 칸 제목 비교용 — 띄어쓰기·괄호 설명을 빼고 앞부분으로 찾음 ('연관 단어 (쉼표로 구분)' → '연관단어') */
const looseHeader = (s: string) => s.normalize('NFKC').replace(/[\s*]/g, '').toLowerCase();

/** 첫 줄 제목으로 칸 위치 찾기 — 제목이 match로 시작하면 그 칸 (괄호 안 설명이 달라도 읽음) */
export function findLooseColumns<K extends string>(ws: ExcelJS.Worksheet, columns: { key: K; match: string }[]): Partial<Record<K, number>> {
  const colOf: Partial<Record<K, number>> = {};
  // 긴 match부터 (예: '고정FAQ번호'와 '번호'가 섞이지 않게)
  const defs = [...columns].sort((a, b) => b.match.length - a.match.length);
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const h = looseHeader(cellText(cell.value));
    const def = defs.find((c) => h.startsWith(looseHeader(c.match)) && !colOf[c.key]);
    if (def) colOf[def.key] = colNumber;
  });
  return colOf;
}

/** 쉼표·줄바꿈·세미콜론으로 나눈 목록 (빈 값 없앰, 순서 그대로) */
export const splitList = (text: string): string[] =>
  String(text ?? '')
    .split(/[,，、;\n]/)
    .map((s) => normLine(s))
    .filter(Boolean);

/** 같은 이름인지 비교할 때 — 띄어쓰기·대소문자 무시 */
export const nameKey = (s: string) => String(s ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();

/** 띄어쓰기·대소문자만 다른 것도 같은 값으로 보고 앞의 것만 남김 */
export function dedupLoose(list: string[], except: string[] = []): string[] {
  const seen = new Set(except.map(nameKey));
  const out: string[] = [];
  for (const s of list) {
    const k = nameKey(s);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

/** DB의 JSON 칸 (글자 또는 이미 읽은 배열) → 배열 */
export function parseJsonList(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v !== 'string' || !v) return [];
  try {
    const p = JSON.parse(v);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export const READONLY_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FF7A7F87' } };

/** 번호 칸 읽기 */
export function readIdCell(idText: string): { id: number | null; badId: boolean } {
  if (!idText) return { id: null, badId: false };
  return /^\d+$/.test(idText) ? { id: Number(idText), badId: false } : { id: null, badId: true };
}

/** 키워드 규칙·프로필 항목 비교 결과 (행정실 FAQ·선배 FAQ와 같은 모양) */
export interface SimplePlan<V> {
  created: { row: number; view: V }[];
  updated: { id: number; row: number; before: V; after: V; changes: Change[] }[];
  deleted: { id: number; row: number; before: V }[];
  unchanged: number;
  missingFromFile: number[];
  problems: Issue[];
  warnings: Issue[];
}

export const missingHeaderMessage = (headers: string[]) =>
  `칸 제목 ${headers.map((h) => `'${h}'`).join(', ')}을(를) 찾지 못했어요. 받은 엑셀의 첫 줄(칸 제목)은 그대로 둬 주세요.`;

export const byRow = (a: Issue, b: Issue) => (a.row ?? 0) - (b.row ?? 0);
