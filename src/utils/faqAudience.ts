/**
 * FAQ 대상 (audience) — 학부 / 대학원 / 공통
 *   undergraduate: 학부 모드에서만 보임 (기본값)
 *   graduate:      대학원 모드에서만 보임
 *   all:           둘 다 보임
 * DB(faqs.audience)에는 영어 값, 화면·엑셀에는 한국어 이름을 씀
 */
export const AUDIENCES = ['undergraduate', 'graduate', 'all'] as const;
export type Audience = typeof AUDIENCES[number];
export const DEFAULT_AUDIENCE: Audience = 'undergraduate';

export const AUDIENCE_LABEL: Record<Audience, string> = {
  undergraduate: '학부',
  graduate: '대학원',
  all: '공통',
};

export function isAudience(v: unknown): v is Audience {
  return typeof v === 'string' && (AUDIENCES as readonly string[]).includes(v);
}

/** 엑셀 칸의 글자(학부/대학원/공통, 영어 값도 허용) → 값. 모르는 글자면 null */
export function audienceFromLabel(text: string): Audience | null {
  const t = text.replace(/\s+/g, '').toLowerCase();
  for (const a of AUDIENCES) {
    if (t === AUDIENCE_LABEL[a] || t === a) return a;
  }
  return null;
}

// 처음 칸을 만들 때 한 번만 쓰는 규칙
//   대분류 '대학원' → 대학원
//   정보대학 행정실·교수님, ETC의 학부·대학원 공통 업무, 그리고 FAQ 140·198 → 공통
//   나머지 → 학부
const ALL_SUBCATEGORIES: [string, string][] = [
  ['정보대학', '정보대학 행정실'],
  ['정보대학', '교수님'],
  ['ETC', '예비군'],
  ['ETC', '실험실 안전교육'],
  ['ETC', '제증명 발급'],
  ['ETC', '포스터 게시'],
  ['ETC', '공간예약'],
  ['ETC', '학생증 발급'],
  ['ETC', '외국인 상담'],
];
const ALL_FAQ_IDS = [140, 198]; // "누구한테 물어봐야 돼?", "행정실(학과) 이메일/전화번호가 궁금해!"

export function initialAudience(row: { id: number; maincategory_ko: string; subcategory_ko: string }): Audience {
  const main = (row.maincategory_ko ?? '').trim();
  const sub = (row.subcategory_ko ?? '').trim();
  if (main === '대학원') return 'graduate';
  if (ALL_FAQ_IDS.includes(Number(row.id))) return 'all';
  if (ALL_SUBCATEGORIES.some(([m, s]) => m === main && s === sub)) return 'all';
  return 'undergraduate';
}
