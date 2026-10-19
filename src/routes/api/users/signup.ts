import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket,  ResultSetHeader } from "mysql2/promise";
import { SignupRequest, SignupResponse } from "../../../types/user";
import { roleForKey } from "../../../middleware/manageKey";
import { setAgentRole } from "../chat/chatIndex";

const router = express.Router();

interface User {
  id: number;
  username: string;
  email: string;
  password: string;
  phone_num: string;
  created_at: string;
  updated_at: string;
}



// @route   POST api/user
// @desc    Register user given their email and password, returns the token upon successful registration
// @access  Public
router.post("/", async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { email, password, username, phone_num, manageKey } : SignupRequest['body'] = req.body;
  // 가입 키로 역할 결정: 관리자 키 = 행정실, 근장 키 = 근로장학생
  const role = roleForKey(manageKey);
  if (!role) {
    const response = {
      statusCode: 403,
      message: "Invalid Manage key. Access denied.",
      field: "manageKey", // 화면이 문제 칸을 표시
    }
    console.log(response);
    return res.status(403).json(response);
  }
  // users 테이블 칸이 VARCHAR(45) — 넘기면 DB 오류(500) 대신 안내
  const tooLong = ([["email", email], ["username", username], ["phone_num", phone_num]] as const).find(([, v]) => typeof v === "string" && v.length > 45);
  if (!email || !password || !username || tooLong) {
    const response = {
      statusCode: 400,
      message: tooLong ? `${tooLong[0]} must be 45 characters or fewer` : "Missing required fields",
      field: tooLong?.[0],
    }
    console.log(response);
    return res.status(400).json(response);
  }
  try {
    // 이메일·전화번호 둘 다 중복 확인 (전화번호는 DB에 UNIQUE — 예전엔 겹치면 DB 오류로 500)
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT email, phone_num, username FROM users WHERE email = ? OR phone_num = ? OR username = ?`,
      [email, phone_num, username]
    );
    const existed = rows as Pick<User, "email" | "phone_num" | "username">[];

    if (existed.some((u) => u.email === email)) {
      const response = {
        statusCode : 400,
        message: "User already exists",
        field: "email",
      }
      console.log(response); 
      return res.status(400).json(response);
    }
    if (existed.some((u) => u.username === username)) {
      const response = { statusCode: 400, message: "Username already exists", field: "username" };
      console.log(response);
      return res.status(400).json(response);
    }
    if (existed.some((u) => u.phone_num === phone_num)) {
      const response = {
        statusCode : 400,
        message: "Phone number already registered",
        field: "phone_num",
      }
      console.log(response);
      return res.status(400).json(response);
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const [inserted] = await connection.execute<ResultSetHeader>(
      `INSERT INTO users (email, password, username, phone_num) VALUES (?, ?, ? ,?)`,
      [email, hashed, username, phone_num]
    );
    // 역할 기록 — 실패하면 계정을 지움 (기록 없는 계정은 행정실 권한이 되므로, 근장 키 가입이 행정실로 남지 않게)
    try {
      await setAgentRole(inserted.insertId, username, role);
    } catch (e) {
      await connection.execute(`DELETE FROM users WHERE id = ?`, [inserted.insertId]);
      throw e;
    }

    const response : SignupResponse = {
      statusCode: 201,
      message: "User registered successfully",
      role,
    }
    console.log(response);
    res.status(201).json(response);
  } catch (err: any) {
    // 동시에 같은 값으로 가입한 경우 (위 확인과 저장 사이)
    if (err?.code === "ER_DUP_ENTRY") {
      const phone = /phone_num/.test(err.message);
      const response = { statusCode: 400, message: phone ? "Phone number already registered" : "User already exists", field: phone ? "phone_num" : "email" };
      console.log(response);
      return res.status(400).json(response);
    }
    const response = {
      statusCode: 500,
      message: err.message,
    }
    console.log(response);
    res.status(500).json(response);
  } finally {
    connection.release();
  }
});


export default router;