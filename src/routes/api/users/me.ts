import express, { Response } from "express";
import { RowDataPacket } from "mysql2/promise";
import { Pool } from "../../../../config/connectDB";
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";
import { roleOf } from "../chat/chatIndex";

const router = express.Router();

// @route   GET api/users/me
// @desc    마이페이지 — 내 계정 정보와 권한 (행정실 / 근로장학생)
// @access  Private
router.get("/me", auth, async (req: Request, res: Response) => {
  const uid = Number(req.user_id);
  try {
    const [rows] = await Pool.query<RowDataPacket[]>(
      `SELECT id, email, username, phone_num, created_at FROM users WHERE id = ?`,
      [uid]
    );
    const u = rows[0];
    if (!u) return res.status(404).json({ statusCode: 404, message: "User not found" });
    const role = await roleOf(uid);
    return res.status(200).json({
      statusCode: 200,
      message: "ok",
      data: { user_id: u.id, email: u.email, username: u.username, phone_num: u.phone_num, created_at: u.created_at, role },
    });
  } catch {
    return res.status(500).json({ statusCode: 500, message: "Failed to load account" });
  }
});

export default router;
