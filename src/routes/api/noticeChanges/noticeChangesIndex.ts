import express, { Response } from "express";
import { RowDataPacket } from "mysql2/promise";
import { Pool } from "../../../../config/connectDB";
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

/**
 * 공지로 바뀐 내용 (notice_changes, config/createDB.ts) — 새 공지가 행정실 FAQ·홈페이지 안내의 내용을 바꾸는 경우
 *   호빗 RAG가 데이터 수집 때 찾아 넣음. 관리자는 FAQ를 고친 뒤 '확인함', 잘못 찾은 것은 '무시'
 */
const router = express.Router();
const STATUSES = ["new", "done", "ignored"] as const;

// @route   GET api/notice-changes?status=new
// @access  Private
router.get("/", auth, async (req: Request, res: Response) => {
  const status = String(req.query.status ?? "new");
  try {
    const [rows] = await Pool.query<RowDataPacket[]>(
      `SELECT id, notice_title, notice_link, DATE_FORMAT(notice_date, '%Y-%m-%d') AS notice_date, target_kind,
              target_title, faq_id, what, before_value, after_value, applies_to, status, created_at
         FROM notice_changes ${STATUSES.includes(status as any) ? "WHERE status = ?" : ""}
        ORDER BY notice_date DESC, id DESC LIMIT 100`,
      STATUSES.includes(status as any) ? [status] : []
    );
    res.status(200).json({ statusCode: 200, message: "Notice changes retrieved", data: { changes: rows } });
  } catch (err: any) {
    if (err.code === "ER_NO_SUCH_TABLE") {
      return res.status(200).json({ statusCode: 200, message: "Notice changes retrieved", data: { changes: [] } });
    }
    console.error(err.message);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  }
});

// @route   PUT api/notice-changes/:id  { status: done | ignored | new }
// @access  Private
router.put("/:id", auth, async (req: Request, res: Response) => {
  const status = String(req.body?.status ?? "");
  if (!STATUSES.includes(status as any)) {
    return res.status(400).json({ statusCode: 400, message: "상태가 올바르지 않습니다." });
  }
  try {
    await Pool.query(`UPDATE notice_changes SET status = ?, handled_by = ? WHERE id = ?`,
      [status, req.user_id ?? null, Number(req.params.id)]);
    res.status(200).json({ statusCode: 200, message: "Notice change updated" });
  } catch (err: any) {
    console.error(err.message);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  }
});

export default router;
