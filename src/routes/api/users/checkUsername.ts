import express, { Request, Response } from "express";
import { RowDataPacket } from "mysql2/promise";
import { Pool } from "../../../../config/connectDB";

const router = express.Router();

// @route   GET api/users/check-username?username=
// @desc    회원가입 — 사용자명(이름) 중복 확인
// @access  Public
router.get("/check-username", async (req: Request, res: Response) => {
  const username = String(req.query.username ?? "").trim();
  if (!username || username.length > 45) {
    return res.status(400).json({ statusCode: 400, message: "Invalid username", data: { available: false } });
  }
  try {
    const [rows] = await Pool.query<RowDataPacket[]>(`SELECT 1 FROM users WHERE username = ? LIMIT 1`, [username]);
    return res.status(200).json({ statusCode: 200, message: "ok", data: { available: rows.length === 0 } });
  } catch {
    return res.status(500).json({ statusCode: 500, message: "Failed to check username" });
  }
});

export default router;
