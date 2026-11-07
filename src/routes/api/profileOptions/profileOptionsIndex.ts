import express, { Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { Pool } from "../../../../config/connectDB";
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

/**
 * 프로필 항목 — 학생이 고르는 학과·전공 유형·학적 상태 (profile_options 테이블, config/createDB.ts)
 *   호빗 RAG가 1분마다 읽어 화면 선택지·질문 속 학과 인식·문서 대상 태그·검색 필터에 씀
 *   학과를 새로 만들거나 이름을 바꾸면, 다음 데이터 수집 때 그 이름이 나오는 문서만 다시 정리됨
 * 학년(1~4)은 고정, 학번 선택지는 올해 기준 자동 (여기서 관리하지 않음)
 */
const router = express.Router();

export const PROFILE_FIELDS = ["department", "major_type", "student_status"] as const;
type Field = (typeof PROFILE_FIELDS)[number];
const MAX_ALIASES = 20;

type Option = {
  field: Field;
  value: string;
  label_en: string;
  aliases: string[];
  first_cohort: number | null;
  active: boolean;
};

const parseList = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String);
  try {
    const parsed = typeof v === "string" ? JSON.parse(v) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

/** 입력 정리 — 앞뒤 공백, 빈 값·중복·공식 이름과 같은 별칭 제거 */
function clean(body: any): { option?: Option; error?: string } {
  const field = String(body?.field ?? "") as Field;
  if (!PROFILE_FIELDS.includes(field)) return { error: "항목 종류가 올바르지 않습니다." };
  const value = String(body?.value ?? "").trim();
  if (!value) return { error: "이름을 입력해주세요." };
  if (value.length > 100) return { error: "이름은 100자 이하로 입력해주세요." };
  if (!/[가-힣]/.test(value)) return { error: "이름은 한국어로 입력해주세요. (문서·질문이 한국어 기준)" };
  const labelEn = String(body?.label_en ?? "").trim();
  if (!labelEn) return { error: "영어 이름을 입력해주세요." };
  if (labelEn.length > 100) return { error: "영어 이름은 100자 이하로 입력해주세요." };
  const raw: unknown[] = Array.isArray(body?.aliases) ? body.aliases : [];
  const aliases = Array.from(new Set(raw.map((a) => String(a).trim()).filter((a) => a && a.length <= 50 && a !== value)));
  if (aliases.length > MAX_ALIASES) return { error: `다른 이름은 ${MAX_ALIASES}개까지 등록할 수 있습니다.` };
  let firstCohort: number | null = null;
  if (field === "department" && body?.first_cohort !== null && body?.first_cohort !== undefined && body?.first_cohort !== "") {
    firstCohort = Number(body.first_cohort);
    const thisYear = new Date().getFullYear();
    if (!Number.isInteger(firstCohort) || firstCohort < 1990 || firstCohort > thisYear + 1) {
      return { error: `첫 입학 연도는 1990~${thisYear + 1} 사이의 4자리 연도로 입력해주세요.` };
    }
  }
  return { option: { field, value, label_en: labelEn, aliases, first_cohort: firstCohort, active: body?.active !== false } };
}

/** 다른 항목의 이름·다른 이름과 겹치는지 — 겹치면 학생 질문에서 어느 학과인지 정할 수 없음 */
async function nameConflict(option: Option, exceptId?: number): Promise<string | null> {
  const [rows] = await Pool.query<RowDataPacket[]>(
    `SELECT id, value, aliases FROM profile_options WHERE field = ? AND id <> ?`,
    [option.field, exceptId ?? 0]
  );
  const mine = new Set([option.value, ...option.aliases]);
  for (const r of rows) {
    const theirs = [String(r.value), ...parseList(r.aliases)];
    const dup = theirs.find((n) => mine.has(n));
    if (dup) return `'${dup}'은(는) 이미 '${r.value}'의 이름(또는 다른 이름)으로 쓰이고 있습니다.`;
  }
  return null;
}

const toOption = (r: RowDataPacket) => ({
  id: Number(r.id),
  field: r.field as Field,
  value: String(r.value),
  label_en: String(r.label_en),
  aliases: parseList(r.aliases),
  first_cohort: r.first_cohort === null ? null : Number(r.first_cohort),
  sort_order: Number(r.sort_order),
  active: Boolean(r.active),
  updated_at: r.updated_at,
});

// @route   GET api/profile-options
// @desc    프로필 항목 전체 (종류별, 표시 순서대로)
// @access  Private
router.get("/", auth, async (_req: Request, res: Response) => {
  try {
    const [rows] = await Pool.query<RowDataPacket[]>(
      `SELECT id, field, value, label_en, aliases, first_cohort, sort_order, active, updated_at
         FROM profile_options ORDER BY field, sort_order, id`
    );
    res.status(200).json({ statusCode: 200, message: "Profile options retrieved", data: { options: rows.map(toOption) } });
  } catch (err: any) {
    console.error(err.message);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  }
});

// @route   POST api/profile-options
// @access  Private
router.post("/", auth, async (req: Request, res: Response) => {
  const { option, error } = clean(req.body);
  if (!option) return res.status(400).json({ statusCode: 400, message: error });
  try {
    const conflict = await nameConflict(option);
    if (conflict) return res.status(409).json({ statusCode: 409, message: conflict });
    const [result] = await Pool.query<ResultSetHeader>(
      `INSERT INTO profile_options (field, value, label_en, aliases, first_cohort, active, sort_order, updated_by)
       SELECT ?, ?, ?, ?, ?, ?, COALESCE(MAX(sort_order), -1) + 1, ? FROM profile_options WHERE field = ?`,
      [option.field, option.value, option.label_en, JSON.stringify(option.aliases), option.first_cohort,
        option.active ? 1 : 0, req.user_id ?? null, option.field]
    );
    res.status(200).json({ statusCode: 200, message: "Profile option created", data: { id: result.insertId } });
  } catch (err: any) {
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ statusCode: 409, message: "이미 있는 이름입니다." });
    console.error(err.message);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  }
});

// @route   PUT api/profile-options/order
// @desc    표시 순서 — { field, ids: [순서대로] }
// @access  Private
router.put("/order", auth, async (req: Request, res: Response) => {
  const field = String(req.body?.field ?? "") as Field;
  const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
  if (!PROFILE_FIELDS.includes(field) || !ids.length) {
    return res.status(400).json({ statusCode: 400, message: "순서 정보가 올바르지 않습니다." });
  }
  const conn = await Pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const [i, id] of ids.entries()) {
      await conn.query(`UPDATE profile_options SET sort_order = ? WHERE id = ? AND field = ?`, [i, id, field]);
    }
    await conn.commit();
    res.status(200).json({ statusCode: 200, message: "Order updated" });
  } catch (err: any) {
    await conn.rollback();
    console.error(err.message);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  } finally {
    conn.release();
  }
});

// @route   PUT api/profile-options/:id
// @desc    수정 — 이름을 바꾸면 예전 이름을 다른 이름에 자동으로 남김 (예전 이름으로 정리된 문서·저장된 학생 정보도 계속 맞게)
// @access  Private
router.put("/:id", auth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { option, error } = clean(req.body);
  if (!option) return res.status(400).json({ statusCode: 400, message: error });
  try {
    const [rows] = await Pool.query<RowDataPacket[]>(`SELECT field, value FROM profile_options WHERE id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ statusCode: 404, message: "Profile option not found" });
    if (rows[0].field !== option.field) return res.status(400).json({ statusCode: 400, message: "항목 종류는 바꿀 수 없습니다." });
    const oldValue = String(rows[0].value);
    if (oldValue !== option.value && !option.aliases.includes(oldValue)) option.aliases.push(oldValue);
    const conflict = await nameConflict(option, id);
    if (conflict) return res.status(409).json({ statusCode: 409, message: conflict });
    await Pool.query(
      `UPDATE profile_options SET value = ?, label_en = ?, aliases = ?, first_cohort = ?, active = ?, updated_by = ? WHERE id = ?`,
      [option.value, option.label_en, JSON.stringify(option.aliases), option.first_cohort, option.active ? 1 : 0,
        req.user_id ?? null, id]
    );
    res.status(200).json({ statusCode: 200, message: "Profile option updated", data: { aliases: option.aliases } });
  } catch (err: any) {
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ statusCode: 409, message: "이미 있는 이름입니다." });
    console.error(err.message);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  }
});

// @route   DELETE api/profile-options/:id
// @desc    삭제 — 종류마다 최소 1개는 남김. 기존 학생·문서가 있는 학과는 삭제보다 '숨김'을 권장 (화면에서 안내)
// @access  Private
router.delete("/:id", auth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  try {
    const [rows] = await Pool.query<RowDataPacket[]>(
      `SELECT field, (SELECT COUNT(*) FROM profile_options p2 WHERE p2.field = p.field) AS n FROM profile_options p WHERE id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ statusCode: 404, message: "Profile option not found" });
    if (Number(rows[0].n) <= 1) return res.status(400).json({ statusCode: 400, message: "종류마다 최소 1개는 남아 있어야 합니다." });
    await Pool.query(`DELETE FROM profile_options WHERE id = ?`, [id]);
    res.status(200).json({ statusCode: 200, message: "Profile option deleted" });
  } catch (err: any) {
    console.error(err.message);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  }
});

export default router;
