/**
 * hoBIT 데이터 엑셀 받기·올리기·되돌리기 (FAQ · 선배 FAQ · 담당자 · 이메일 · 키워드 규칙 · 프로필 항목 시트)
 *   GET  /api/faqs/excel                 지금 데이터를 엑셀로
 *   POST /api/faqs/excel/preview         엑셀 올리기 → 바뀔 내용 미리보기 (아직 저장 안 함, 30분 동안 기억)
 *   POST /api/faqs/excel/apply           미리보기 그대로 적용 { plan_id } — 적용 전에 지금 상태를 faq_backups에 저장
 *   GET  /api/faqs/excel/backups         저장해 둔 이전 상태 목록
 *   POST /api/faqs/excel/restore         이전 상태로 되돌리기 { backup_id }
 *   모두 ?scope=senior 를 붙이면 선배 FAQ만 (사용 방법 + 선배 FAQ 시트, 백업·되돌리기도 senior_faqs만)
 *
 * 계정 역할 (chat_agents, src/routes/api/chat/chatIndex.ts roleOf)
 *   행정실·개발자: scope 상관없이 모두 / 근로장학생: scope=senior만 (아니면 403), 백업도 선배 FAQ 범위만 보고 되돌림
 *
 * 엑셀 모양·읽기·비교는 src/utils/hobitWorkbook.ts, faqExcel.ts, seniorFaqExcel.ts, keywordRuleExcel.ts, profileOptionExcel.ts
 * - 파일에 없는 FAQ는 지우지 않음 (삭제 칸에 '삭제'를 고른 것만 지움), 없는 시트는 바뀐 것 없음
 * - 적용은 한 트랜잭션: FAQ → 선배 FAQ → 담당자 이름 바꾸기 → 이메일 바꾸기 → 키워드 규칙 → 프로필 항목
 * - FAQ·선배 FAQ 변경은 하나씩 고칠 때와 같은 모양으로 faq_logs / senior_faq_logs(변경 기록)에 남김
 *   (담당자·이메일 일괄 바꾸기, 키워드 규칙·프로필 항목은 기존 API처럼 기록을 남기지 않음)
 * - 백업(faq_backups.data): { scope, faqs, senior_faqs, keyword_rules, profile_options } — scope가 맨 앞이라
 *   목록에서 JSON 전체를 읽지 않고 범위를 구분함. 예전 백업(scope·키워드·프로필 없음)은 있는 표만 되돌림
 * - 되돌리기는 번호(id)를 그대로 살림. related_faqs는 faqs를 지우면 같이 지워지고(CASCADE),
 *   question_logs·faq_logs·user_feedbacks·senior_faq_logs는 번호가 비워지므로(SET NULL)
 *   표를 통째로 지우고 다시 넣지 않고, 바뀐 줄만 고치고 없는 줄만 넣고 백업에 없는 줄만 지움
 */
import express, { NextFunction, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { LRUCache } from 'lru-cache';
import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { Pool } from '../../../../config/connectDB';
import env from '../../../../config/env';
import auth from '../../../middleware/auth';
import Request from '../../../types/Request';
import { AnswerCard, DbFaqRow, FaqView, makeOrderAssigner, normLine, parseCards, viewToAnswers } from '../../../utils/faqExcel';
import {
  makeSeniorOrderAssigner,
  parseSeniorCards,
  SeniorAnswerCard,
  SeniorDbRow,
  SeniorView,
  seniorViewToAnswers,
} from '../../../utils/seniorFaqExcel';
import {
  buildHobitPlan,
  buildHobitXlsx,
  ExcelScope,
  HobitData,
  HobitPlan,
  parseHobitXlsx,
  planChangeCount,
  replaceEmailInField,
} from '../../../utils/hobitWorkbook';
import { KeywordRuleDbRow, keywordSummary, SearchSource } from '../../../utils/keywordRuleExcel';
import { PROFILE_FIELD_LABEL, ProfileOptionDbRow, profileSummary } from '../../../utils/profileOptionExcel';
import { Role, roleOf } from '../chat/chatIndex';
import { AUDIENCE_LABEL, DEFAULT_AUDIENCE } from '../../../utils/faqAudience';
import { translateTexts } from '../translate/translate';
import { generateRelatedFAQs } from './createRelateFAQ';

const router = express.Router();

const KEEP_BACKUPS = 20;
const AUTO_TRANSLATE = !!env.DEEPL_KEY;

type StoredPlan = { userId: number; scope: ExcelScope; fingerprint: string; plan: HobitPlan; fileName: string };
const plans = new LRUCache<string, StoredPlan>({ max: 50, ttl: 30 * 60 * 1000 });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/\.xlsx$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('XLSX_ONLY'));
  },
});

// ───────────────────────── 도움 함수 ─────────────────────────

const fail = (res: Response, status: number, message: string) => res.status(status).json({ statusCode: status, message });

type ExcelRequest = Request & { excelScope?: ExcelScope; excelRole?: Role };

/**
 * 범위·역할 확인 — ?scope=senior 이면 선배 FAQ만, 아니면 전체
 *   근로장학생 계정은 선배 FAQ 범위만 쓸 수 있어요 (전체 범위는 403)
 */
async function scopeGuard(req: ExcelRequest, res: Response, next: NextFunction) {
  const scope: ExcelScope = req.query?.scope === 'senior' ? 'senior' : 'all';
  let role: Role;
  try {
    role = await roleOf(Number(req.user_id));
  } catch {
    return fail(res, 503, '권한을 확인하지 못했어요. 잠시 후 다시 해 주세요.');
  }
  if (role === 'senior' && scope !== 'senior') {
    return fail(res, 403, '근로장학생 계정은 선배 FAQ 엑셀만 쓸 수 있어요.');
  }
  req.excelScope = scope;
  req.excelRole = role;
  next();
}

/** 지금 데이터 — 선배 FAQ 범위면 senior_faqs만 (나머지는 빈 목록) */
async function loadData(conn: PoolConnection, scope: ExcelScope, lock = false): Promise<HobitData> {
  const forUpdate = lock ? ' FOR UPDATE' : '';
  const [seniors] = await conn.query<RowDataPacket[]>(`SELECT * FROM senior_faqs ORDER BY id${forUpdate}`);
  if (scope === 'senior') return { faqs: [], seniorFaqs: seniors as unknown as SeniorDbRow[], keywordRules: [], profileOptions: [] };
  const [faqs] = await conn.query<RowDataPacket[]>(`SELECT * FROM faqs ORDER BY id${forUpdate}`);
  const [rules] = await conn.query<RowDataPacket[]>(`SELECT * FROM keyword_rules ORDER BY id${forUpdate}`);
  const [options] = await conn.query<RowDataPacket[]>(`SELECT * FROM profile_options ORDER BY id${forUpdate}`);
  return {
    faqs: faqs as unknown as DbFaqRow[],
    seniorFaqs: seniors as unknown as SeniorDbRow[],
    keywordRules: rules as unknown as KeywordRuleDbRow[],
    profileOptions: options as unknown as ProfileOptionDbRow[],
  };
}

/** 표 전체의 지문 — 미리보기와 적용 사이에 누가 고쳤는지 확인 (범위 안의 표만) */
function fingerprint(d: HobitData, scope: ExcelScope): string {
  const parts = scope === 'senior' ? [d.seniorFaqs] : [d.faqs, d.seniorFaqs, d.keywordRules ?? [], d.profileOptions ?? []];
  return crypto.createHash('sha1').update(JSON.stringify(parts)).digest('hex');
}

/** 키워드 규칙 '먼저 찾아볼 곳' 선택지 — GET api/keywords/sources와 같은 RAG 목록 (못 받으면 null) */
async function fetchSearchSources(): Promise<SearchSource[] | null> {
  try {
    const r = await fetch(`${env.RAG_URL}/search/sources`, { signal: AbortSignal.timeout(2000) });
    const body: any = await r.json();
    if (!r.ok || !Array.isArray(body?.sources)) return null;
    return body.sources
      .filter((x: any) => x && typeof x.id === 'string')
      .map((x: any) => ({ id: String(x.id), label: String(x.label ?? x.id), group: x.group ? String(x.group) : undefined }));
  } catch {
    return null;
  }
}

async function usernameOf(conn: PoolConnection, userId: number): Promise<string> {
  const [rows] = await conn.query<RowDataPacket[]>(`SELECT username FROM users WHERE id = ?`, [userId]);
  return rows[0]?.username ?? '알 수 없음';
}

// 변경 기록 모양 (createFAQ·updateFAQ·deleteFAQ / 선배 FAQ 핸들러와 같음)
const EMPTY_LOG_FAQ = {
  maincategory_ko: '', maincategory_en: '', subcategory_ko: '', subcategory_en: '', question_ko: '', question_en: '',
  answer_ko: [] as AnswerCard[], answer_en: [] as AnswerCard[], manager: '', audience: '',
};
const EMPTY_LOG_SENIOR = {
  maincategory_ko: '', maincategory_en: '', subcategory_ko: '', subcategory_en: '', detailcategory_ko: '', detailcategory_en: '',
  answer_ko: [] as SeniorAnswerCard[], answer_en: [] as SeniorAnswerCard[], manager: '',
};

const logFaqFromRow = (row: DbFaqRow) => ({
  maincategory_ko: row.maincategory_ko,
  maincategory_en: row.maincategory_en,
  subcategory_ko: row.subcategory_ko,
  subcategory_en: row.subcategory_en,
  question_ko: row.question_ko,
  question_en: row.question_en,
  answer_ko: parseCards(row.answer_ko),
  answer_en: parseCards(row.answer_en),
  manager: row.manager,
  audience: row.audience ?? DEFAULT_AUDIENCE,
});
const logFaqFromView = (v: FaqView) => ({
  maincategory_ko: v.maincategory_ko,
  maincategory_en: v.maincategory_en,
  subcategory_ko: v.subcategory_ko,
  subcategory_en: v.subcategory_en,
  question_ko: v.question_ko,
  question_en: v.question_en,
  ...viewToAnswers(v),
  manager: v.manager,
  audience: v.audience,
});
const logSeniorFromRow = (row: SeniorDbRow) => ({
  maincategory_ko: row.maincategory_ko,
  maincategory_en: row.maincategory_en,
  subcategory_ko: row.subcategory_ko,
  subcategory_en: row.subcategory_en,
  detailcategory_ko: row.detailcategory_ko,
  detailcategory_en: row.detailcategory_en,
  answer_ko: parseSeniorCards(row.answer_ko),
  answer_en: parseSeniorCards(row.answer_en),
  manager: row.manager,
});
const logSeniorFromView = (v: SeniorView) => ({
  maincategory_ko: v.maincategory_ko,
  maincategory_en: v.maincategory_en,
  subcategory_ko: v.subcategory_ko,
  subcategory_en: v.subcategory_en,
  detailcategory_ko: v.detailcategory_ko,
  detailcategory_en: v.detailcategory_en,
  ...seniorViewToAnswers(v),
  manager: v.manager,
});

type Action = '추가' | '수정' | '삭제';
async function writeFaqLog(conn: PoolConnection, username: string, id: number, prev: object, next: object, action: Action) {
  await conn.execute(`INSERT INTO faq_logs (username, faq_id, action_type, prev_faq, new_faq) VALUES (?, ?, ?, ?, ?)`, [
    username, id, action, JSON.stringify(prev), JSON.stringify(next),
  ]);
}
async function writeSeniorLog(conn: PoolConnection, username: string, id: number, prev: object, next: object, action: Action) {
  await conn.execute(
    `INSERT INTO senior_faq_logs (username, senior_faq_id, action_type, prev_senior_faq, new_senior_faq) VALUES (?, ?, ?, ?, ?)`,
    [username, id, action, JSON.stringify(prev), JSON.stringify(next)]
  );
}

// 백업 범위 — data JSON이 이 글자로 시작하면 선배 FAQ만 저장한 백업 (scope를 맨 앞에 씀)
const SENIOR_BACKUP_PREFIX = '{"scope":"senior"';
const scopeWhere = (scope: ExcelScope) => (scope === 'senior' ? `data LIKE '${SENIOR_BACKUP_PREFIX}%'` : `data NOT LIKE '${SENIOR_BACKUP_PREFIX}%'`);

/** 범위 안의 표를 faq_backups에 저장하고, 같은 범위의 최근 KEEP_BACKUPS개만 남김 */
async function saveBackup(conn: PoolConnection, d: HobitData, userId: number, note: string, scope: ExcelScope): Promise<number> {
  const body =
    scope === 'senior'
      ? { scope, senior_faqs: d.seniorFaqs }
      : { scope, faqs: d.faqs, senior_faqs: d.seniorFaqs, keyword_rules: d.keywordRules ?? [], profile_options: d.profileOptions ?? [] };
  const [r] = await conn.execute<ResultSetHeader>(
    `INSERT INTO faq_backups (user_id, note, row_count, senior_row_count, data) VALUES (?, ?, ?, ?, ?)`,
    [userId, note.slice(0, 300), scope === 'senior' ? 0 : d.faqs.length, d.seniorFaqs.length, JSON.stringify(body)]
  );
  const [cut] = await conn.query<RowDataPacket[]>(
    `SELECT id FROM faq_backups WHERE ${scopeWhere(scope)} ORDER BY id DESC LIMIT 1 OFFSET ${KEEP_BACKUPS - 1}`
  );
  if (cut.length) await conn.execute(`DELETE FROM faq_backups WHERE id < ? AND ${scopeWhere(scope)}`, [cut[0].id]);
  return r.insertId;
}

/** 비어 있는 영어 칸을 DeepL로 채움 (바로 고침). 번역하지 못한 칸 수를 돌려줌 */
async function fillEnglish(faqViews: FaqView[], seniorViews: SeniorView[]): Promise<number> {
  type Slot = { text: string; set: (en: string) => void };
  const slots: Slot[] = [];
  const line = (en: string) => normLine(en).slice(0, 300);
  for (const v of faqViews) {
    if (!v.maincategory_en && v.maincategory_ko) slots.push({ text: v.maincategory_ko, set: (en) => (v.maincategory_en = line(en)) });
    if (!v.subcategory_en && v.subcategory_ko) slots.push({ text: v.subcategory_ko, set: (en) => (v.subcategory_en = line(en)) });
    if (!v.question_en && v.question_ko) slots.push({ text: v.question_ko, set: (en) => (v.question_en = line(en)) });
    for (const c of v.cards) if (!c.answer_en && c.answer) slots.push({ text: c.answer, set: (en) => (c.answer_en = en.trim()) });
  }
  for (const v of seniorViews) {
    if (!v.maincategory_en && v.maincategory_ko) slots.push({ text: v.maincategory_ko, set: (en) => (v.maincategory_en = line(en)) });
    if (!v.subcategory_en && v.subcategory_ko) slots.push({ text: v.subcategory_ko, set: (en) => (v.subcategory_en = line(en)) });
    if (!v.detailcategory_en && v.detailcategory_ko) slots.push({ text: v.detailcategory_ko, set: (en) => (v.detailcategory_en = line(en)) });
    for (const c of v.cards) {
      if (!c.title_en && c.title) slots.push({ text: c.title, set: (en) => (c.title_en = normLine(en)) });
      if (!c.answer_en && c.answer) slots.push({ text: c.answer, set: (en) => (c.answer_en = en.trim()) });
    }
  }
  if (!slots.length || !AUTO_TRANSLATE) return slots.length;
  const unique = [...new Set(slots.map((s) => s.text))];
  try {
    const translated = await translateTexts(unique);
    const map = new Map(unique.map((t, i) => [t, translated[i]]));
    slots.forEach((s) => s.set(map.get(s.text) ?? ''));
    return slots.filter((s) => !map.get(s.text)).length;
  } catch (e: any) {
    console.error('[hobit excel] 영어 번역 실패:', e?.message);
    return slots.length;
  }
}

/** 관련 질문 만들기 — 뒤에서 하나씩 (실패해도 적용은 그대로) */
function relatedInBackground(items: { id: number; question: string }[]) {
  if (!items.length) return;
  (async () => {
    for (const it of items) {
      try {
        await generateRelatedFAQs(it.id, it.question);
      } catch (e: any) {
        console.error(`[hobit excel] 관련 질문 만들기 실패 (FAQ ${it.id}):`, e?.message);
      }
    }
  })();
}

const todayKST = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());

// ───────────────────────── 엑셀로 받기 ─────────────────────────

// @route   GET api/faqs/excel[?scope=senior]
// @desc    FAQ·선배 FAQ·담당자·이메일·키워드 규칙·프로필 항목을 엑셀(.xlsx) 하나로 (scope=senior: 선배 FAQ만)
// @access  Private (근로장학생은 scope=senior만)
router.get('/excel', auth, scopeGuard, async (req: ExcelRequest, res: Response) => {
  const scope = req.excelScope!;
  const conn = await Pool.getConnection();
  try {
    const [data, sources] = await Promise.all([loadData(conn, scope), scope === 'senior' ? null : fetchSearchSources()]);
    const buf = await buildHobitXlsx(data, { scope, sources });
    const [ko, en] = scope === 'senior' ? ['hoBIT_선배FAQ', 'hoBIT_senior_faq'] : ['hoBIT_데이터', 'hoBIT_data'];
    const name = `${ko}_${todayKST()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${en}_${todayKST()}.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  } catch (err: any) {
    console.error('[hobit excel] 받기 실패:', err?.message);
    fail(res, 500, '엑셀 파일을 만들지 못했어요. 잠시 후 다시 해 주세요.');
  } finally {
    conn.release();
  }
});

// ───────────────────────── 올리기: 미리보기 ─────────────────────────

const sheetSummary = (p: { created: unknown[]; updated: unknown[]; deleted: unknown[]; unchanged: number; missingFromFile: number[] }) => ({
  created: p.created.length,
  updated: p.updated.length,
  deleted: p.deleted.length,
  unchanged: p.unchanged,
  missing_from_file: p.missingFromFile.length,
});

const simpleSummary = sheetSummary;

// @route   POST api/faqs/excel/preview[?scope=senior]  (multipart: file)
// @desc    올린 엑셀과 지금 데이터를 비교 — 저장하지 않음
// @access  Private (근로장학생은 scope=senior만)
router.post(
  '/excel/preview',
  auth,
  scopeGuard,
  (req: Request, res: Response, next) => {
    upload.single('file')(req, res, (err: any) => {
      if (!err) return next();
      if (err?.code === 'LIMIT_FILE_SIZE') return fail(res, 400, '파일이 너무 커요. 5MB까지 올릴 수 있어요.');
      if (err?.message === 'XLSX_ONLY') return fail(res, 400, '엑셀(.xlsx) 파일만 올릴 수 있어요.');
      return fail(res, 400, '파일을 받지 못했어요. 다시 올려 주세요.');
    });
  },
  async (req: ExcelRequest, res: Response) => {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return fail(res, 400, '올릴 엑셀 파일을 골라 주세요.');
    const scope = req.excelScope!;

    const conn = await Pool.getConnection();
    try {
      const parsed = await parseHobitXlsx(file.buffer, { scope });
      const [data, sources] = await Promise.all([loadData(conn, scope), parsed.keywords ? fetchSearchSources() : null]);
      const plan = buildHobitPlan(parsed, data, { autoTranslate: AUTO_TRANSLATE, sources });

      let plan_id: string | null = null;
      if (!plan.problems.length && planChangeCount(plan) > 0) {
        plan_id = crypto.randomUUID();
        plans.set(plan_id, { userId: Number(req.user_id), scope, fingerprint: fingerprint(data, scope), plan, fileName: file.originalname });
      }

      const f = plan.faq;
      const s = plan.senior;
      const k = plan.keywords;
      const po = plan.profileOptions;
      const faqQuestion = new Map(data.faqs.map((x) => [Number(x.id), normLine(x.question_ko)]));
      const optionTitle = (v: { field: keyof typeof PROFILE_FIELD_LABEL; value: string }) => `${PROFILE_FIELD_LABEL[v.field] ?? v.field} · ${v.value}`;
      res.status(200).json({
        statusCode: 200,
        message: 'hoBIT excel preview',
        data: {
          scope,
          plan_id,
          auto_translate: AUTO_TRANSLATE,
          translate_count: (f?.translateCount ?? 0) + (s?.translateCount ?? 0),
          missing_sheets: plan.missingSheets,
          // 예전 응답 모양 (FAQ 시트) 그대로
          summary: f ? sheetSummary(f) : null,
          faq: f && {
            summary: sheetSummary(f),
            created: f.created.map((c) => ({
              row: c.row,
              sheet: c.sheet,
              question: c.view.question_ko,
              maincategory: c.view.maincategory_ko,
              subcategory: c.view.subcategory_ko,
              audience: AUDIENCE_LABEL[c.view.audience],
              answers: c.view.cards.map((x) => x.answer),
            })),
            updated: f.updated.map((u) => ({ id: u.id, row: u.row, sheet: u.sheet, question: u.after.question_ko, changes: u.changes })),
            deleted: f.deleted.map((d) => ({ id: d.id, row: d.row, sheet: d.sheet, question: d.before.question_ko })),
          },
          senior: s && {
            summary: sheetSummary(s),
            created: s.created.map((c) => ({
              row: c.row,
              question: c.view.detailcategory_ko,
              maincategory: c.view.maincategory_ko,
              subcategory: c.view.subcategory_ko,
              answers: c.view.cards.map((x) => x.answer),
            })),
            updated: s.updated.map((u) => ({
              id: u.id,
              row: u.row,
              question: `${u.after.maincategory_ko} › ${u.after.subcategory_ko} › ${u.after.detailcategory_ko}`,
              changes: u.changes,
            })),
            deleted: s.deleted.map((d) => ({
              id: d.id,
              row: d.row,
              question: `${d.before.maincategory_ko} › ${d.before.subcategory_ko} › ${d.before.detailcategory_ko}`,
            })),
          },
          managers: plan.managers.map((m) => ({ row: m.row, from: m.from, to: m.to, faq_count: m.faq_count, senior_count: m.senior_count })),
          emails: plan.emails.map((e) => ({ row: e.row, from: e.from, to: e.to, count: e.count })),
          // 키워드 규칙·프로필 항목 — title: 한 줄 이름, details: 새로 생기는 내용 요약, changes: 바뀌는 칸 (전 → 후)
          keywords: k && {
            summary: simpleSummary(k),
            created: k.created.map((c) => ({ row: c.row, title: c.view.keyword, details: keywordSummary(c.view, faqQuestion, sources) })),
            updated: k.updated.map((u) => ({ id: u.id, row: u.row, title: u.after.keyword, changes: u.changes })),
            deleted: k.deleted.map((d) => ({ id: d.id, row: d.row, title: d.before.keyword })),
          },
          profileOptions: po && {
            summary: simpleSummary(po),
            created: po.created.map((c) => ({ row: c.row, title: optionTitle(c.view), details: profileSummary(c.view) })),
            updated: po.updated.map((u) => ({ id: u.id, row: u.row, title: optionTitle(u.after), changes: u.changes })),
            deleted: po.deleted.map((d) => ({ id: d.id, row: d.row, title: optionTitle(d.before) })),
          },
          problems: plan.problems,
          warnings: plan.warnings,
        },
      });
    } catch (err: any) {
      console.error('[hobit excel] 미리보기 실패:', err?.message);
      fail(res, 500, '엑셀 파일을 읽지 못했어요. 잠시 후 다시 해 주세요.');
    } finally {
      conn.release();
    }
  }
);

// ───────────────────────── 올리기: 적용 ─────────────────────────

// @route   POST api/faqs/excel/apply[?scope=senior]  { plan_id }
// @desc    미리보기 내용을 한 번에 저장 (하나라도 실패하면 아무것도 안 바뀜)
// @access  Private (근로장학생은 scope=senior로 만든 미리보기만)
router.post('/excel/apply', auth, scopeGuard, async (req: ExcelRequest, res: Response) => {
  const userId = Number(req.user_id);
  const planId = String(req.body?.plan_id ?? '');
  const stored = plans.get(planId);
  if (!stored || stored.userId !== userId) return fail(res, 404, '미리보기가 오래돼서 사라졌어요. 파일을 다시 올려 주세요.');
  if (stored.plan.problems.length) return fail(res, 400, '고쳐야 할 부분이 있어서 적용할 수 없어요.');
  // 미리보기를 만든 범위로만 적용 (그사이 역할이 바뀐 근로장학생 계정이 전체 미리보기를 적용하지 못하게)
  const scope = stored.scope;
  if (req.excelRole === 'senior' && scope !== 'senior') return fail(res, 403, '근로장학생 계정은 선배 FAQ 엑셀만 쓸 수 있어요.');

  // 실패해도 다시 시도할 수 있게 복사본에 번역을 채움
  const plan: HobitPlan = JSON.parse(JSON.stringify(stored.plan));
  const changedMessage = scope === 'senior' ? '미리보기 이후에 선배 FAQ가 바뀌었어요. 다시 올려 주세요.' : '미리보기 이후에 FAQ가 바뀌었어요. 다시 올려 주세요.';
  const conn = await Pool.getConnection();
  let inTx = false;
  try {
    if (fingerprint(await loadData(conn, scope), scope) !== stored.fingerprint) return fail(res, 409, changedMessage);

    const untranslated = await fillEnglish(
      [...(plan.faq?.created.map((c) => c.view) ?? []), ...(plan.faq?.updated.map((u) => u.after) ?? [])],
      [...(plan.senior?.created.map((c) => c.view) ?? []), ...(plan.senior?.updated.map((u) => u.after) ?? [])]
    );

    await conn.beginTransaction();
    inTx = true;
    const data = await loadData(conn, scope, true);
    if (fingerprint(data, scope) !== stored.fingerprint) {
      await conn.rollback();
      inTx = false;
      return fail(res, 409, changedMessage);
    }

    const username = await usernameOf(conn, userId);
    const result = {
      faq: { created: plan.faq?.created.length ?? 0, updated: plan.faq?.updated.length ?? 0, deleted: plan.faq?.deleted.length ?? 0 },
      senior: { created: plan.senior?.created.length ?? 0, updated: plan.senior?.updated.length ?? 0, deleted: plan.senior?.deleted.length ?? 0 },
      managers: plan.managers.length,
      emails: plan.emails.length,
      keywords: { created: plan.keywords?.created.length ?? 0, updated: plan.keywords?.updated.length ?? 0, deleted: plan.keywords?.deleted.length ?? 0 },
      profileOptions: {
        created: plan.profileOptions?.created.length ?? 0,
        updated: plan.profileOptions?.updated.length ?? 0,
        deleted: plan.profileOptions?.deleted.length ?? 0,
      },
    };
    const counts = (c: { created: number; updated: number; deleted: number }) => c.created + c.updated + c.deleted;
    const noteParts = [
      plan.faq && `FAQ 새로 ${result.faq.created}·바뀜 ${result.faq.updated}·삭제 ${result.faq.deleted}`,
      plan.senior && `선배 FAQ 새로 ${result.senior.created}·바뀜 ${result.senior.updated}·삭제 ${result.senior.deleted}`,
      result.managers && `담당자 ${result.managers}`,
      result.emails && `이메일 ${result.emails}`,
      counts(result.keywords) && `키워드 규칙 ${counts(result.keywords)}`,
      counts(result.profileOptions) && `프로필 항목 ${counts(result.profileOptions)}`,
    ].filter(Boolean);
    const backupId = await saveBackup(conn, data, userId, `엑셀 올리기 전 (${noteParts.join(' · ')}) ${stored.fileName}`, scope);
    const related: { id: number; question: string }[] = [];

    // 1) FAQ
    if (plan.faq) {
      const byId = new Map(data.faqs.map((r) => [Number(r.id), r]));
      const orderOf = makeOrderAssigner(data.faqs);
      for (const d of plan.faq.deleted) {
        // 기록을 먼저 남기고 지움 (deleteFAQ.ts와 같은 순서, faq_logs.faq_id는 지운 뒤 비워짐)
        await writeFaqLog(conn, username, d.id, logFaqFromRow(byId.get(d.id)!), EMPTY_LOG_FAQ, '삭제');
        await conn.execute(`DELETE FROM faqs WHERE id = ?`, [d.id]);
      }
      for (const u of plan.faq.updated) {
        const row = byId.get(u.id)!;
        const v = u.after;
        const same = normLine(row.maincategory_ko) === v.maincategory_ko && normLine(row.subcategory_ko) === v.subcategory_ko;
        const order = same ? { category_order: row.category_order, subcategory_order: row.subcategory_order } : orderOf(v.maincategory_ko, v.subcategory_ko);
        const { answer_ko, answer_en } = viewToAnswers(v);
        await conn.execute(
          `UPDATE faqs SET maincategory_ko = ?, maincategory_en = ?, subcategory_ko = ?, subcategory_en = ?,
             question_ko = ?, question_en = ?, answer_ko = ?, answer_en = ?, manager = ?, audience = ?,
             category_order = ?, subcategory_order = ?, updated_by = ?
           WHERE id = ?`,
          [
            v.maincategory_ko, v.maincategory_en, v.subcategory_ko, v.subcategory_en, v.question_ko, v.question_en,
            JSON.stringify(answer_ko), JSON.stringify(answer_en), v.manager, v.audience,
            order.category_order, order.subcategory_order, userId, u.id,
          ]
        );
        await writeFaqLog(conn, username, u.id, logFaqFromRow(row), logFaqFromView(v), '수정');
        if (u.before.question_ko !== v.question_ko) related.push({ id: u.id, question: v.question_ko });
      }
      for (const c of plan.faq.created) {
        const v = c.view;
        const order = orderOf(v.maincategory_ko, v.subcategory_ko);
        const { answer_ko, answer_en } = viewToAnswers(v);
        const [r] = await conn.execute<ResultSetHeader>(
          `INSERT INTO faqs (maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, question_ko, question_en,
             answer_ko, answer_en, manager, audience, category_order, subcategory_order, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            v.maincategory_ko, v.maincategory_en, v.subcategory_ko, v.subcategory_en, v.question_ko, v.question_en,
            JSON.stringify(answer_ko), JSON.stringify(answer_en), v.manager, v.audience,
            order.category_order, order.subcategory_order, userId, userId,
          ]
        );
        await writeFaqLog(conn, username, r.insertId, EMPTY_LOG_FAQ, logFaqFromView(v), '추가');
        related.push({ id: r.insertId, question: v.question_ko });
      }
    }

    // 2) 선배 FAQ
    if (plan.senior) {
      const byId = new Map(data.seniorFaqs.map((r) => [Number(r.id), r]));
      const orderOf = makeSeniorOrderAssigner(data.seniorFaqs);
      for (const d of plan.senior.deleted) {
        await writeSeniorLog(conn, username, d.id, logSeniorFromRow(byId.get(d.id)!), EMPTY_LOG_SENIOR, '삭제');
        await conn.execute(`DELETE FROM senior_faqs WHERE id = ?`, [d.id]);
      }
      for (const u of plan.senior.updated) {
        const row = byId.get(u.id)!;
        const v = u.after;
        const same =
          normLine(row.maincategory_ko) === v.maincategory_ko &&
          normLine(row.subcategory_ko) === v.subcategory_ko &&
          normLine(row.detailcategory_ko) === v.detailcategory_ko;
        const order = same
          ? { category_order: row.category_order, subcategory_order: row.subcategory_order, detailcategory_order: row.detailcategory_order }
          : orderOf(v.maincategory_ko, v.subcategory_ko, v.detailcategory_ko);
        const { answer_ko, answer_en } = seniorViewToAnswers(v);
        await conn.execute(
          `UPDATE senior_faqs SET maincategory_ko = ?, maincategory_en = ?, subcategory_ko = ?, subcategory_en = ?,
             detailcategory_ko = ?, detailcategory_en = ?, answer_ko = ?, answer_en = ?, manager = ?,
             category_order = ?, subcategory_order = ?, detailcategory_order = ?, updated_by = ?
           WHERE id = ?`,
          [
            v.maincategory_ko, v.maincategory_en, v.subcategory_ko, v.subcategory_en, v.detailcategory_ko, v.detailcategory_en,
            JSON.stringify(answer_ko), JSON.stringify(answer_en), v.manager,
            order.category_order, order.subcategory_order, order.detailcategory_order, userId, u.id,
          ]
        );
        await writeSeniorLog(conn, username, u.id, logSeniorFromRow(row), logSeniorFromView(v), '수정');
      }
      for (const c of plan.senior.created) {
        const v = c.view;
        const order = orderOf(v.maincategory_ko, v.subcategory_ko, v.detailcategory_ko);
        const { answer_ko, answer_en } = seniorViewToAnswers(v);
        const [r] = await conn.execute<ResultSetHeader>(
          `INSERT INTO senior_faqs (maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, detailcategory_ko, detailcategory_en,
             answer_ko, answer_en, manager, category_order, subcategory_order, detailcategory_order, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            v.maincategory_ko, v.maincategory_en, v.subcategory_ko, v.subcategory_en, v.detailcategory_ko, v.detailcategory_en,
            JSON.stringify(answer_ko), JSON.stringify(answer_en), v.manager,
            order.category_order, order.subcategory_order, order.detailcategory_order, userId, userId,
          ]
        );
        await writeSeniorLog(conn, username, r.insertId, EMPTY_LOG_SENIOR, logSeniorFromView(v), '추가');
      }
    }

    // 3) 담당자 이름 바꾸기 (bulkUpdateAdmin처럼 — 행정실 FAQ와 선배 FAQ 모두)
    for (const m of plan.managers) {
      const names = [...new Set([...m.raw, m.from])];
      const marks = names.map(() => '?').join(', ');
      await conn.execute(`UPDATE faqs SET manager = ?, updated_by = ? WHERE manager IN (${marks})`, [m.to, userId, ...names]);
      await conn.execute(`UPDATE senior_faqs SET manager = ?, updated_by = ? WHERE manager IN (${marks})`, [m.to, userId, ...names]);
    }

    // 4) 이메일 바꾸기 (bulkUpdateEmail처럼 — 이메일 칸이 있는 행정실 FAQ 카드)
    if (plan.emails.length) {
      const [rows] = await conn.query<RowDataPacket[]>(`SELECT id, answer_ko, answer_en FROM faqs`);
      for (const row of rows) {
        let changed = false;
        const fix = (raw: string) => {
          let cards: any[];
          try {
            cards = JSON.parse(raw);
          } catch {
            return raw;
          }
          if (!Array.isArray(cards)) return raw;
          const out = cards.map((c) => {
            if (!c || typeof c.email !== 'string') return c;
            let email = c.email;
            for (const e of plan.emails) email = replaceEmailInField(email, e.from, e.to);
            if (email === c.email) return c;
            changed = true;
            return { ...c, email };
          });
          return JSON.stringify(out);
        };
        const ko = fix(row.answer_ko);
        const en = fix(row.answer_en);
        if (changed) {
          await conn.execute(`UPDATE faqs SET answer_ko = ?, answer_en = ?, updated_by = ? WHERE id = ?`, [ko, en, userId, row.id]);
        }
      }
    }

    // 5) 키워드 규칙 (keywordsIndex.ts와 같은 칸). 대표 키워드는 겹치면 안 돼서(UNIQUE) 바꾸는 줄은 먼저 임시 이름으로
    if (plan.keywords) {
      for (const d of plan.keywords.deleted) await conn.execute(`DELETE FROM keyword_rules WHERE id = ?`, [d.id]);
      const renamed = plan.keywords.updated.filter((u) => u.before.keyword !== u.after.keyword);
      for (const u of renamed) await conn.execute(`UPDATE keyword_rules SET keyword = ? WHERE id = ?`, [`#excel-${u.id}`, u.id]);
      for (const u of plan.keywords.updated) {
        const v = u.after;
        await conn.execute(
          `UPDATE keyword_rules SET keyword = ?, keyword_en = ?, synonyms = ?, synonyms_en = ?, pinned_faq_ids = ?, search_sources = ?, updated_by = ? WHERE id = ?`,
          [v.keyword, v.keyword_en || null, JSON.stringify(v.synonyms), JSON.stringify(v.synonyms_en), JSON.stringify(v.pinned),
            JSON.stringify(v.sources), userId, u.id]
        );
      }
      for (const c of plan.keywords.created) {
        const v = c.view;
        await conn.execute(
          `INSERT INTO keyword_rules (keyword, keyword_en, synonyms, synonyms_en, pinned_faq_ids, search_sources, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [v.keyword, v.keyword_en || null, JSON.stringify(v.synonyms), JSON.stringify(v.synonyms_en), JSON.stringify(v.pinned),
            JSON.stringify(v.sources), userId]
        );
      }
    }

    // 6) 프로필 항목 (profileOptionsIndex.ts와 같은 칸). (종류, 이름)이 겹치면 안 돼서(UNIQUE) 이름을 바꾸는 줄은 먼저 임시 이름으로
    if (plan.profileOptions) {
      const po = plan.profileOptions;
      for (const d of po.deleted) await conn.execute(`DELETE FROM profile_options WHERE id = ?`, [d.id]);
      const renamed = po.updated.filter((u) => u.before.value !== u.after.value);
      for (const u of renamed) await conn.execute(`UPDATE profile_options SET value = ? WHERE id = ?`, [`#excel-${u.id}`, u.id]);
      for (const u of po.updated) {
        const v = u.after;
        await conn.execute(
          `UPDATE profile_options SET value = ?, label_en = ?, aliases = ?, first_cohort = ?, active = ?, sort_order = ?, updated_by = ? WHERE id = ?`,
          [v.value, v.label_en, JSON.stringify(v.aliases), v.first_cohort, v.active ? 1 : 0, v.sort_order ?? u.before.sort_order ?? 0, userId, u.id]
        );
      }
      // 새 항목 — 순서를 비웠으면 그 종류의 맨 뒤
      const [maxRows] = await conn.query<RowDataPacket[]>(`SELECT field, MAX(sort_order) AS m FROM profile_options GROUP BY field`);
      const maxOf = new Map(maxRows.map((r) => [String(r.field), Number(r.m ?? -1)]));
      for (const c of po.created) {
        const v = c.view;
        let order = v.sort_order;
        if (order === null) {
          order = (maxOf.get(v.field) ?? -1) + 1;
        }
        maxOf.set(v.field, Math.max(maxOf.get(v.field) ?? -1, order));
        await conn.execute(
          `INSERT INTO profile_options (field, value, label_en, aliases, first_cohort, active, sort_order, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [v.field, v.value, v.label_en, JSON.stringify(v.aliases), v.first_cohort, v.active ? 1 : 0, order, userId]
        );
      }
    }

    await conn.commit();
    inTx = false;
    plans.delete(planId);
    relatedInBackground(related);

    res.status(200).json({ statusCode: 200, message: 'hoBIT excel applied', data: { ...result, backup_id: backupId, untranslated } });
  } catch (err: any) {
    if (inTx) await conn.rollback().catch(() => undefined);
    console.error('[hobit excel] 적용 실패:', err?.message);
    fail(res, 500, '적용하지 못했어요. 아무것도 바뀌지 않았어요. 잠시 후 다시 해 주세요.');
  } finally {
    conn.release();
  }
});

// ───────────────────────── 되돌리기 ─────────────────────────

// @route   GET api/faqs/excel/backups[?scope=senior]
// @desc    저장해 둔 이전 상태 (범위마다 최근 20개). scope=senior면 선배 FAQ만 저장한 상태만
//          행정실·개발자는 scope 없이 부르면 모두 (scope: 'all' | 'senior'로 구분)
// @access  Private (근로장학생은 scope=senior만)
router.get('/excel/backups', auth, scopeGuard, async (req: ExcelRequest, res: Response) => {
  const scope = req.excelScope!;
  try {
    const [rows] = await Pool.query<RowDataPacket[]>(
      `SELECT b.id, b.created_at, b.note, b.row_count, b.senior_row_count, u.username,
              CASE WHEN b.${scopeWhere('senior')} THEN 'senior' ELSE 'all' END AS scope
       FROM faq_backups b LEFT JOIN users u ON u.id = b.user_id
       ${scope === 'senior' ? `WHERE b.${scopeWhere('senior')}` : ''}
       ORDER BY b.id DESC LIMIT ${KEEP_BACKUPS * 2}`
    );
    res.status(200).json({ statusCode: 200, message: 'FAQ backups', data: { backups: rows } });
  } catch (err: any) {
    console.error('[hobit excel] 백업 목록 실패:', err?.message);
    fail(res, 500, '이전 상태 목록을 불러오지 못했어요.');
  }
});

type TableSpec = {
  table: 'faqs' | 'senior_faqs' | 'keyword_rules' | 'profile_options';
  columns: readonly string[]; // 되돌릴 칸 (번호·만든 사람·만든 때는 따로)
  defaults: Record<string, unknown>;
  jsonColumns?: readonly string[]; // 배열·객체로 읽혔으면 JSON 글자로
  hasCreatedBy?: boolean; // created_by 칸이 있는 표 (faqs·senior_faqs)
  unique?: string; // 겹치면 안 되는 칸 — 바꾸는 줄은 먼저 임시 값으로 (서로 이름을 맞바꾼 경우)
  log?: (conn: PoolConnection, username: string, id: number, prev: object, next: object, action: Action) => Promise<void>;
  toLog?: (row: any) => object;
  empty?: object;
};

const FAQ_SPEC: TableSpec = {
  table: 'faqs',
  columns: [
    'maincategory_ko', 'maincategory_en', 'subcategory_ko', 'subcategory_en', 'question_ko', 'question_en',
    'answer_ko', 'answer_en', 'manager', 'audience', 'category_order', 'subcategory_order',
  ],
  defaults: { audience: DEFAULT_AUDIENCE, subcategory_order: 1 },
  jsonColumns: ['answer_ko', 'answer_en'],
  hasCreatedBy: true,
  log: writeFaqLog,
  toLog: logFaqFromRow,
  empty: EMPTY_LOG_FAQ,
};
const SENIOR_SPEC: TableSpec = {
  table: 'senior_faqs',
  columns: [
    'maincategory_ko', 'maincategory_en', 'subcategory_ko', 'subcategory_en', 'detailcategory_ko', 'detailcategory_en',
    'answer_ko', 'answer_en', 'manager', 'category_order', 'subcategory_order', 'detailcategory_order',
  ],
  defaults: { subcategory_order: 1, detailcategory_order: 1 },
  jsonColumns: ['answer_ko', 'answer_en'],
  hasCreatedBy: true,
  log: writeSeniorLog,
  toLog: logSeniorFromRow,
  empty: EMPTY_LOG_SENIOR,
};
// 키워드 규칙·프로필 항목은 변경 기록 표가 없어서 기록 없이 되돌림
const KEYWORD_SPEC: TableSpec = {
  table: 'keyword_rules',
  columns: ['keyword', 'keyword_en', 'synonyms', 'synonyms_en', 'pinned_faq_ids', 'search_sources'],
  defaults: { keyword_en: null, synonyms: '[]', synonyms_en: null, pinned_faq_ids: '[]', search_sources: null },
  jsonColumns: ['synonyms', 'synonyms_en', 'pinned_faq_ids', 'search_sources'],
  unique: 'keyword',
};
const PROFILE_SPEC: TableSpec = {
  table: 'profile_options',
  columns: ['field', 'value', 'label_en', 'aliases', 'first_cohort', 'sort_order', 'active'],
  defaults: { aliases: '[]', first_cohort: null, sort_order: 0, active: 1 },
  jsonColumns: ['aliases'],
  unique: 'value',
};

/** 표 하나를 백업 상태로 — 바뀐 줄만 고치고, 없는 줄은 같은 번호로 넣고, 백업에 없는 줄은 지움 */
async function restoreTable(
  conn: PoolConnection,
  spec: TableSpec,
  current: any[],
  target: any[],
  ctx: { userId: number; username: string; userIds: Set<number> }
) {
  const result = { created: 0, updated: 0, deleted: 0, reinserted: [] as any[], questionChanged: [] as any[] };
  const value = (row: any, col: string) => {
    const v = row[col];
    if (v === undefined || v === null) return col in spec.defaults ? spec.defaults[col] : col.endsWith('_order') ? null : '';
    if (spec.jsonColumns?.includes(col) && typeof v !== 'string') return JSON.stringify(v);
    if (typeof v === 'boolean') return v ? 1 : 0;
    return v;
  };
  const log = async (id: number, prev: object | null, next: object | null, action: Action) => {
    if (spec.log && spec.toLog) await spec.log(conn, ctx.username, id, prev ? spec.toLog(prev) : spec.empty!, next ? spec.toLog(next) : spec.empty!, action);
  };
  const curById = new Map(current.map((r) => [Number(r.id), r]));
  const targetIds = new Set(target.map((r) => Number(r.id)));

  for (const row of current) {
    if (targetIds.has(Number(row.id))) continue;
    await log(Number(row.id), row, null, '삭제');
    await conn.execute(`DELETE FROM ${spec.table} WHERE id = ?`, [row.id]);
    result.deleted++;
  }
  // 겹치면 안 되는 칸을 바꾸는 줄은 먼저 임시 값으로 (서로 맞바꾸거나, 지금 다른 줄이 쓰는 값으로 돌아가는 경우)
  if (spec.unique) {
    for (const row of target) {
      const cur = curById.get(Number(row.id));
      if (cur && String(value(cur, spec.unique)) !== String(value(row, spec.unique))) {
        await conn.execute(`UPDATE ${spec.table} SET ${spec.unique} = ? WHERE id = ?`, [`#restore-${row.id}`, row.id]);
        cur[spec.unique] = `#restore-${row.id}`;
      }
    }
  }
  for (const row of target) {
    const id = Number(row.id);
    const cur = curById.get(id);
    const values = spec.columns.map((c) => value(row, c));
    if (!cur) {
      const createdBy = ctx.userIds.has(Number(row.created_by)) ? Number(row.created_by) : null;
      const extra = spec.hasCreatedBy ? ['created_by', 'updated_by', 'created_at'] : ['updated_by', 'created_at'];
      const extraValues = spec.hasCreatedBy ? [createdBy, ctx.userId] : [ctx.userId];
      await conn.execute(
        `INSERT INTO ${spec.table} (id, ${spec.columns.join(', ')}, ${extra.join(', ')})
         VALUES (?, ${[...spec.columns, ...extra].map(() => '?').join(', ')})`,
        [id, ...values, ...extraValues, row.created_at ? new Date(row.created_at) : new Date()]
      );
      await log(id, null, row, '추가');
      result.reinserted.push(row);
      result.created++;
      continue;
    }
    if (!spec.columns.some((c) => String(value(cur, c)) !== String(value(row, c)))) continue;
    await conn.execute(`UPDATE ${spec.table} SET ${spec.columns.map((c) => `${c} = ?`).join(', ')}, updated_by = ? WHERE id = ?`, [
      ...values, ctx.userId, id,
    ]);
    await log(id, cur, row, '수정');
    if (cur.question_ko !== undefined && cur.question_ko !== row.question_ko) result.questionChanged.push(row);
    result.updated++;
  }
  return result;
}

// @route   POST api/faqs/excel/restore[?scope=senior]  { backup_id }
// @desc    저장해 둔 상태로 (번호 그대로). 되돌리기 전 상태도 먼저 저장해 둠
//          전체 백업: faqs·senior_faqs·keyword_rules·profile_options 중 백업에 있는 표만 / 선배 FAQ 백업: senior_faqs만
// @access  Private (근로장학생은 선배 FAQ 백업만)
router.post('/excel/restore', auth, scopeGuard, async (req: ExcelRequest, res: Response) => {
  const userId = Number(req.user_id);
  const backupId = Number(req.body?.backup_id);
  if (!Number.isInteger(backupId)) return fail(res, 400, '되돌릴 상태를 골라 주세요.');

  const conn = await Pool.getConnection();
  let inTx = false;
  try {
    await conn.beginTransaction();
    inTx = true;
    const [b] = await conn.query<RowDataPacket[]>(`SELECT data FROM faq_backups WHERE id = ?`, [backupId]);
    if (!b.length) {
      await conn.rollback();
      inTx = false;
      return fail(res, 404, '저장해 둔 상태를 찾지 못했어요. 목록을 새로 고쳐 주세요.');
    }
    const saved = JSON.parse(b[0].data);
    const target = Array.isArray(saved) ? { faqs: saved, senior_faqs: null } : saved; // 배열 = FAQ만 저장한 모양
    const backupScope: ExcelScope = target.scope === 'senior' ? 'senior' : 'all';
    if (req.excelRole === 'senior' && backupScope !== 'senior') {
      await conn.rollback();
      inTx = false;
      return fail(res, 403, '근로장학생 계정은 선배 FAQ만 저장한 상태로만 되돌릴 수 있어요.');
    }
    const current = await loadData(conn, backupScope, true);
    const username = await usernameOf(conn, userId);
    await saveBackup(conn, current, userId, backupScope === 'senior' ? '되돌리기 전 (선배 FAQ)' : '되돌리기 전', backupScope);

    const [userRows] = await conn.query<RowDataPacket[]>(`SELECT id FROM users`);
    const ctx = { userId, username, userIds: new Set(userRows.map((u) => Number(u.id))) };
    const none = { created: 0, updated: 0, deleted: 0, reinserted: [] as any[], questionChanged: [] as any[] };
    // 백업에 있는 표만 되돌림 (예전 백업에는 키워드 규칙·프로필 항목이 없음)
    const faq = backupScope === 'all' && Array.isArray(target.faqs) ? await restoreTable(conn, FAQ_SPEC, current.faqs, target.faqs, ctx) : none;
    const senior = Array.isArray(target.senior_faqs) ? await restoreTable(conn, SENIOR_SPEC, current.seniorFaqs, target.senior_faqs, ctx) : none;
    const keywords =
      backupScope === 'all' && Array.isArray(target.keyword_rules)
        ? await restoreTable(conn, KEYWORD_SPEC, current.keywordRules ?? [], target.keyword_rules, ctx)
        : none;
    const profileOptions =
      backupScope === 'all' && Array.isArray(target.profile_options)
        ? await restoreTable(conn, PROFILE_SPEC, current.profileOptions ?? [], target.profile_options, ctx)
        : none;

    await conn.commit();
    inTx = false;
    relatedInBackground([...faq.reinserted, ...faq.questionChanged].map((r) => ({ id: Number(r.id), question: r.question_ko })));
    const pick = (r: { created: number; updated: number; deleted: number }) => ({ created: r.created, updated: r.updated, deleted: r.deleted });
    res.status(200).json({
      statusCode: 200,
      message: 'restored',
      data: { scope: backupScope, faq: pick(faq), senior: pick(senior), keywords: pick(keywords), profileOptions: pick(profileOptions) },
    });
  } catch (err: any) {
    if (inTx) await conn.rollback().catch(() => undefined);
    console.error('[hobit excel] 되돌리기 실패:', err?.message);
    fail(res, 500, '되돌리지 못했어요. 아무것도 바뀌지 않았어요. 잠시 후 다시 해 주세요.');
  } finally {
    conn.release();
  }
});

export default router;
