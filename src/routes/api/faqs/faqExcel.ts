/**
 * FAQ 엑셀 받기·올리기·되돌리기
 *   GET  /api/faqs/excel                 지금 FAQ 전체를 엑셀로
 *   POST /api/faqs/excel/preview         엑셀 올리기 → 바뀔 내용 미리보기 (아직 저장 안 함, 30분 동안 기억)
 *   POST /api/faqs/excel/apply           미리보기 그대로 적용 { plan_id } — 적용 전에 faqs 전체를 faq_backups에 저장
 *   GET  /api/faqs/excel/backups         저장해 둔 이전 상태 목록
 *   POST /api/faqs/excel/restore         이전 상태로 되돌리기 { backup_id }
 *
 * 엑셀 모양·읽기·비교는 src/utils/faqExcel.ts
 * - 파일에 없는 FAQ는 지우지 않음 (삭제 칸에 '삭제'를 고른 FAQ만 지움)
 * - 바뀐 내용은 FAQ 하나씩 고칠 때와 같은 모양으로 faq_logs(변경 기록)에 남김
 * - 되돌리기는 번호(id)를 그대로 살림. related_faqs는 faqs를 지우면 같이 지워지고(CASCADE),
 *   question_logs·faq_logs·user_feedbacks는 faq_id가 비워지므로(SET NULL) 표를 통째로 지우고 다시 넣지 않고
 *   바뀐 줄만 고치고, 없는 줄만 넣고, 백업에 없는 줄만 지움
 */
import express, { Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { LRUCache } from 'lru-cache';
import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { Pool } from '../../../../config/connectDB';
import env from '../../../../config/env';
import auth from '../../../middleware/auth';
import Request from '../../../types/Request';
import {
  AnswerCard,
  buildFaqXlsx,
  buildImportPlan,
  DbFaqRow,
  FaqView,
  ImportPlan,
  makeOrderAssigner,
  normLine,
  parseCards,
  parseFaqXlsx,
  viewToAnswers,
} from '../../../utils/faqExcel';
import { AUDIENCE_LABEL, DEFAULT_AUDIENCE } from '../../../utils/faqAudience';
import { translateTexts } from '../translate/translate';
import { generateRelatedFAQs } from './createRelateFAQ';

const router = express.Router();

const KEEP_BACKUPS = 20;
const AUTO_TRANSLATE = !!env.DEEPL_KEY;

type StoredPlan = { userId: number; fingerprint: string; plan: ImportPlan; fileName: string };
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

async function loadRows(conn: PoolConnection, lock = false): Promise<DbFaqRow[]> {
  const [rows] = await conn.query<RowDataPacket[]>(`SELECT * FROM faqs ORDER BY id${lock ? ' FOR UPDATE' : ''}`);
  return rows as unknown as DbFaqRow[];
}

/** faqs 표 전체의 지문 — 미리보기와 적용 사이에 누가 FAQ를 고쳤는지 확인 */
function fingerprint(rows: DbFaqRow[]): string {
  return crypto.createHash('sha1').update(JSON.stringify(rows)).digest('hex');
}

async function usernameOf(conn: PoolConnection, userId: number): Promise<string> {
  const [rows] = await conn.query<RowDataPacket[]>(`SELECT username FROM users WHERE id = ?`, [userId]);
  return rows[0]?.username ?? '알 수 없음';
}

const EMPTY_LOG_FAQ = {
  maincategory_ko: '',
  maincategory_en: '',
  subcategory_ko: '',
  subcategory_en: '',
  question_ko: '',
  question_en: '',
  answer_ko: [] as AnswerCard[],
  answer_en: [] as AnswerCard[],
  manager: '',
  audience: '',
};

/** 변경 기록에 남길 FAQ 모양 (createFAQ·updateFAQ·deleteFAQ와 같음, 대상 추가) */
function logFaqFromRow(row: DbFaqRow) {
  return {
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
  };
}

function logFaqFromView(v: FaqView) {
  const { answer_ko, answer_en } = viewToAnswers(v);
  return {
    maincategory_ko: v.maincategory_ko,
    maincategory_en: v.maincategory_en,
    subcategory_ko: v.subcategory_ko,
    subcategory_en: v.subcategory_en,
    question_ko: v.question_ko,
    question_en: v.question_en,
    answer_ko,
    answer_en,
    manager: v.manager,
    audience: v.audience,
  };
}

async function writeLog(conn: PoolConnection, username: string, faqId: number, prev: object, next: object, action: '추가' | '수정' | '삭제') {
  await conn.execute(
    `INSERT INTO faq_logs (username, faq_id, action_type, prev_faq, new_faq) VALUES (?, ?, ?, ?, ?)`,
    [username, faqId, action, JSON.stringify(prev), JSON.stringify(next)]
  );
}

/** faqs 전체를 faq_backups에 저장하고 최근 KEEP_BACKUPS개만 남김 */
async function saveBackup(conn: PoolConnection, rows: DbFaqRow[], userId: number, note: string): Promise<number> {
  const [r] = await conn.execute<ResultSetHeader>(
    `INSERT INTO faq_backups (user_id, note, row_count, data) VALUES (?, ?, ?, ?)`,
    [userId, note.slice(0, 300), rows.length, JSON.stringify(rows)]
  );
  const [cut] = await conn.query<RowDataPacket[]>(
    `SELECT id FROM faq_backups ORDER BY id DESC LIMIT 1 OFFSET ${KEEP_BACKUPS - 1}`
  );
  if (cut.length) await conn.execute(`DELETE FROM faq_backups WHERE id < ?`, [cut[0].id]);
  return r.insertId;
}

/** 비어 있는 영어 칸을 DeepL로 채움 (바로 고침). 번역하지 못한 칸 수를 돌려줌 */
async function fillEnglish(views: FaqView[]): Promise<number> {
  type Slot = { text: string; set: (en: string) => void };
  const slots: Slot[] = [];
  for (const v of views) {
    if (!v.maincategory_en && v.maincategory_ko) slots.push({ text: v.maincategory_ko, set: (en) => (v.maincategory_en = en.slice(0, 300)) });
    if (!v.subcategory_en && v.subcategory_ko) slots.push({ text: v.subcategory_ko, set: (en) => (v.subcategory_en = en.slice(0, 300)) });
    if (!v.question_en && v.question_ko) slots.push({ text: v.question_ko, set: (en) => (v.question_en = normLine(en).slice(0, 300)) });
    for (const c of v.cards) {
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
    console.error('[faq excel] 영어 번역 실패:', e?.message);
    return slots.length;
  }
}

/** 관련 질문 만들기 — 뒤에서 하나씩 (실패해도 엑셀 적용은 그대로) */
function relatedInBackground(items: { id: number; question: string }[]) {
  if (!items.length) return;
  (async () => {
    for (const it of items) {
      try {
        await generateRelatedFAQs(it.id, it.question);
      } catch (e: any) {
        console.error(`[faq excel] 관련 질문 만들기 실패 (FAQ ${it.id}):`, e?.message);
      }
    }
  })();
}

const todayKST = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());

// ───────────────────────── 엑셀로 받기 ─────────────────────────

// @route   GET api/faqs/excel
// @desc    FAQ 전체를 엑셀(.xlsx)로
// @access  Private
router.get('/excel', auth, async (_req: Request, res: Response) => {
  const conn = await Pool.getConnection();
  try {
    const rows = await loadRows(conn);
    const buf = await buildFaqXlsx(rows);
    const name = `hoBIT_FAQ_${todayKST()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  } catch (err: any) {
    console.error('[faq excel] 받기 실패:', err?.message);
    fail(res, 500, '엑셀 파일을 만들지 못했어요. 잠시 후 다시 해 주세요.');
  } finally {
    conn.release();
  }
});

// ───────────────────────── 올리기: 미리보기 ─────────────────────────

// @route   POST api/faqs/excel/preview  (multipart: file)
// @desc    올린 엑셀과 지금 FAQ를 비교 — 저장하지 않음
// @access  Private
router.post(
  '/excel/preview',
  auth,
  (req: Request, res: Response, next) => {
    upload.single('file')(req, res, (err: any) => {
      if (!err) return next();
      if (err?.code === 'LIMIT_FILE_SIZE') return fail(res, 400, '파일이 너무 커요. 5MB까지 올릴 수 있어요.');
      if (err?.message === 'XLSX_ONLY') return fail(res, 400, '엑셀(.xlsx) 파일만 올릴 수 있어요.');
      return fail(res, 400, '파일을 받지 못했어요. 다시 올려 주세요.');
    });
  },
  async (req: Request, res: Response) => {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return fail(res, 400, '올릴 엑셀 파일을 골라 주세요.');

    const conn = await Pool.getConnection();
    try {
      const parsed = await parseFaqXlsx(file.buffer);
      const rows = await loadRows(conn);
      const plan = buildImportPlan(parsed, rows, { autoTranslate: AUTO_TRANSLATE });
      const total = plan.created.length + plan.updated.length + plan.deleted.length;

      let plan_id: string | null = null;
      if (!plan.problems.length && total > 0) {
        plan_id = crypto.randomUUID();
        plans.set(plan_id, { userId: Number(req.user_id), fingerprint: fingerprint(rows), plan, fileName: file.originalname });
      }

      res.status(200).json({
        statusCode: 200,
        message: 'FAQ excel preview',
        data: {
          plan_id,
          auto_translate: AUTO_TRANSLATE,
          translate_count: plan.translateCount,
          summary: {
            created: plan.created.length,
            updated: plan.updated.length,
            deleted: plan.deleted.length,
            unchanged: plan.unchanged,
            missing_from_file: plan.missingFromFile.length,
          },
          created: plan.created.map((c) => ({
            row: c.row,
            question: c.view.question_ko,
            maincategory: c.view.maincategory_ko,
            subcategory: c.view.subcategory_ko,
            audience: AUDIENCE_LABEL[c.view.audience],
            answers: c.view.cards.map((x) => x.answer),
          })),
          updated: plan.updated.map((u) => ({ id: u.id, row: u.row, question: u.after.question_ko, changes: u.changes })),
          deleted: plan.deleted.map((d) => ({ id: d.id, row: d.row, question: d.before.question_ko })),
          problems: plan.problems,
          warnings: plan.warnings,
        },
      });
    } catch (err: any) {
      console.error('[faq excel] 미리보기 실패:', err?.message);
      fail(res, 500, '엑셀 파일을 읽지 못했어요. 잠시 후 다시 해 주세요.');
    } finally {
      conn.release();
    }
  }
);

// ───────────────────────── 올리기: 적용 ─────────────────────────

// @route   POST api/faqs/excel/apply  { plan_id }
// @desc    미리보기 내용을 한 번에 저장 (하나라도 실패하면 아무것도 안 바뀜)
// @access  Private
router.post('/excel/apply', auth, async (req: Request, res: Response) => {
  const userId = Number(req.user_id);
  const planId = String(req.body?.plan_id ?? '');
  const stored = plans.get(planId);
  if (!stored || stored.userId !== userId) {
    return fail(res, 404, '미리보기가 오래돼서 사라졌어요. 파일을 다시 올려 주세요.');
  }
  if (stored.plan.problems.length) return fail(res, 400, '고쳐야 할 부분이 있어서 적용할 수 없어요.');

  // 실패해도 다시 시도할 수 있게 복사본에 번역을 채움
  const plan: ImportPlan = JSON.parse(JSON.stringify(stored.plan));
  const changedMessage = '미리보기 이후에 FAQ가 바뀌었어요. 다시 올려 주세요.';
  const conn = await Pool.getConnection();
  let inTx = false;
  try {
    if (fingerprint(await loadRows(conn)) !== stored.fingerprint) {
      return fail(res, 409, changedMessage);
    }

    const untranslated = await fillEnglish([...plan.created.map((c) => c.view), ...plan.updated.map((u) => u.after)]);

    await conn.beginTransaction();
    inTx = true;
    const rows = await loadRows(conn, true);
    if (fingerprint(rows) !== stored.fingerprint) {
      await conn.rollback();
      inTx = false;
      return fail(res, 409, changedMessage);
    }

    const username = await usernameOf(conn, userId);
    const byId = new Map(rows.map((r) => [Number(r.id), r]));
    const s = { created: plan.created.length, updated: plan.updated.length, deleted: plan.deleted.length };
    const backupId = await saveBackup(
      conn,
      rows,
      userId,
      `엑셀 올리기 전 (새로 ${s.created} · 바뀜 ${s.updated} · 삭제 ${s.deleted}) ${stored.fileName}`
    );
    const orderOf = makeOrderAssigner(rows);

    // 삭제 — 기록을 먼저 남기고 지움 (deleteFAQ.ts와 같은 순서, faq_logs.faq_id는 지운 뒤 비워짐)
    for (const d of plan.deleted) {
      const row = byId.get(d.id)!;
      await writeLog(conn, username, d.id, logFaqFromRow(row), EMPTY_LOG_FAQ, '삭제');
      await conn.execute(`DELETE FROM faqs WHERE id = ?`, [d.id]);
    }

    const related: { id: number; question: string }[] = [];

    // 수정
    for (const u of plan.updated) {
      const row = byId.get(u.id)!;
      const v = u.after;
      const sameCategory = normLine(row.maincategory_ko) === v.maincategory_ko && normLine(row.subcategory_ko) === v.subcategory_ko;
      const order = sameCategory
        ? { category_order: row.category_order, subcategory_order: row.subcategory_order }
        : orderOf(v.maincategory_ko, v.subcategory_ko);
      const { answer_ko, answer_en } = viewToAnswers(v);
      await conn.execute(
        `UPDATE faqs SET
          maincategory_ko = ?, maincategory_en = ?, subcategory_ko = ?, subcategory_en = ?,
          question_ko = ?, question_en = ?, answer_ko = ?, answer_en = ?, manager = ?, audience = ?,
          category_order = ?, subcategory_order = ?, updated_by = ?
        WHERE id = ?`,
        [
          v.maincategory_ko, v.maincategory_en, v.subcategory_ko, v.subcategory_en,
          v.question_ko, v.question_en, JSON.stringify(answer_ko), JSON.stringify(answer_en), v.manager, v.audience,
          order.category_order, order.subcategory_order, userId, u.id,
        ]
      );
      await writeLog(conn, username, u.id, logFaqFromRow(row), logFaqFromView(v), '수정');
      if (u.before.question_ko !== v.question_ko) related.push({ id: u.id, question: v.question_ko });
    }

    // 새로 추가
    for (const c of plan.created) {
      const v = c.view;
      const order = orderOf(v.maincategory_ko, v.subcategory_ko);
      const { answer_ko, answer_en } = viewToAnswers(v);
      const [r] = await conn.execute<ResultSetHeader>(
        `INSERT INTO faqs (
          maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, question_ko, question_en,
          answer_ko, answer_en, manager, audience, category_order, subcategory_order, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          v.maincategory_ko, v.maincategory_en, v.subcategory_ko, v.subcategory_en, v.question_ko, v.question_en,
          JSON.stringify(answer_ko), JSON.stringify(answer_en), v.manager, v.audience,
          order.category_order, order.subcategory_order, userId, userId,
        ]
      );
      await writeLog(conn, username, r.insertId, EMPTY_LOG_FAQ, logFaqFromView(v), '추가');
      related.push({ id: r.insertId, question: v.question_ko });
    }

    await conn.commit();
    inTx = false;
    plans.delete(planId);
    relatedInBackground(related);

    res.status(200).json({
      statusCode: 200,
      message: 'FAQ excel applied',
      data: { ...s, backup_id: backupId, untranslated },
    });
  } catch (err: any) {
    if (inTx) await conn.rollback().catch(() => undefined);
    console.error('[faq excel] 적용 실패:', err?.message);
    fail(res, 500, '적용하지 못했어요. 아무것도 바뀌지 않았어요. 잠시 후 다시 해 주세요.');
  } finally {
    conn.release();
  }
});

// ───────────────────────── 되돌리기 ─────────────────────────

// @route   GET api/faqs/excel/backups
// @desc    저장해 둔 이전 상태 (최근 20개)
// @access  Private
router.get('/excel/backups', auth, async (_req: Request, res: Response) => {
  try {
    const [rows] = await Pool.query<RowDataPacket[]>(
      `SELECT b.id, b.created_at, b.note, b.row_count, u.username
       FROM faq_backups b LEFT JOIN users u ON u.id = b.user_id
       ORDER BY b.id DESC LIMIT ${KEEP_BACKUPS}`
    );
    res.status(200).json({ statusCode: 200, message: 'FAQ backups', data: { backups: rows } });
  } catch (err: any) {
    console.error('[faq excel] 백업 목록 실패:', err?.message);
    fail(res, 500, '이전 상태 목록을 불러오지 못했어요.');
  }
});

// faqs에서 되돌릴 칸 (번호·만든 사람·만든 때는 따로)
const CONTENT_COLUMNS = [
  'maincategory_ko', 'maincategory_en', 'subcategory_ko', 'subcategory_en', 'question_ko', 'question_en',
  'answer_ko', 'answer_en', 'manager', 'audience', 'category_order', 'subcategory_order',
] as const;

const contentValue = (row: DbFaqRow, col: typeof CONTENT_COLUMNS[number]) => {
  const v = row[col];
  if (col === 'audience') return v ?? DEFAULT_AUDIENCE;
  if (col === 'answer_ko' || col === 'answer_en') return typeof v === 'string' ? v : JSON.stringify(v ?? []);
  return v ?? null;
};

// @route   POST api/faqs/excel/restore  { backup_id }
// @desc    faqs를 저장해 둔 상태로 (번호 그대로). 되돌리기 전 상태도 먼저 저장해 둠
// @access  Private
router.post('/excel/restore', auth, async (req: Request, res: Response) => {
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
    const target: DbFaqRow[] = JSON.parse(b[0].data);
    const current = await loadRows(conn, true);
    const username = await usernameOf(conn, userId);
    await saveBackup(conn, current, userId, '되돌리기 전');

    const [userRows] = await conn.query<RowDataPacket[]>(`SELECT id FROM users`);
    const userIds = new Set(userRows.map((u) => Number(u.id)));
    const curById = new Map(current.map((r) => [Number(r.id), r]));
    const targetById = new Map(target.map((r) => [Number(r.id), r]));
    const result = { created: 0, updated: 0, deleted: 0 };
    const related: { id: number; question: string }[] = [];

    // 백업 뒤에 새로 생긴 FAQ → 지움
    for (const row of current) {
      if (targetById.has(Number(row.id))) continue;
      await writeLog(conn, username, Number(row.id), logFaqFromRow(row), EMPTY_LOG_FAQ, '삭제');
      await conn.execute(`DELETE FROM faqs WHERE id = ?`, [row.id]);
      result.deleted++;
    }

    for (const row of target) {
      const id = Number(row.id);
      const cur = curById.get(id);
      const values = CONTENT_COLUMNS.map((c) => contentValue(row, c));
      if (!cur) {
        // 지워졌던 FAQ → 같은 번호로 다시 넣음
        const createdBy = userIds.has(Number(row.created_by)) ? Number(row.created_by) : null;
        const createdAt = row.created_at ? new Date(row.created_at) : new Date();
        await conn.execute(
          `INSERT INTO faqs (id, ${CONTENT_COLUMNS.join(', ')}, created_by, updated_by, created_at)
           VALUES (?, ${CONTENT_COLUMNS.map(() => '?').join(', ')}, ?, ?, ?)`,
          [id, ...values, createdBy, userId, createdAt]
        );
        await writeLog(conn, username, id, EMPTY_LOG_FAQ, logFaqFromRow(row), '추가');
        related.push({ id, question: row.question_ko });
        result.created++;
        continue;
      }
      const differs = CONTENT_COLUMNS.some((c) => String(contentValue(cur, c)) !== String(contentValue(row, c)));
      if (!differs) continue;
      await conn.execute(
        `UPDATE faqs SET ${CONTENT_COLUMNS.map((c) => `${c} = ?`).join(', ')}, updated_by = ? WHERE id = ?`,
        [...values, userId, id]
      );
      await writeLog(conn, username, id, logFaqFromRow(cur), logFaqFromRow(row), '수정');
      if (cur.question_ko !== row.question_ko) related.push({ id, question: row.question_ko });
      result.updated++;
    }

    await conn.commit();
    inTx = false;
    relatedInBackground(related);
    res.status(200).json({ statusCode: 200, message: 'FAQ restored', data: result });
  } catch (err: any) {
    if (inTx) await conn.rollback().catch(() => undefined);
    console.error('[faq excel] 되돌리기 실패:', err?.message);
    fail(res, 500, '되돌리지 못했어요. 아무것도 바뀌지 않았어요. 잠시 후 다시 해 주세요.');
  } finally {
    conn.release();
  }
});

export default router;
