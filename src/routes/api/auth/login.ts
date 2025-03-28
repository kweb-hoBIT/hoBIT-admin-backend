import express, { Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Payload from "../../../types/Payload";
import Request from "../../../types/Request";
import { Pool } from "../../../../config/connectDB";
import { RowDataPacket } from "mysql2/promise";
import { LoginRequest, LoginResponse } from "../../../types/user";
import env from "../../../../config/env";

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

// @route   POST api/auth
// @desc    Login user and get token
// @access  Public
router.post("/", async (req: Request, res: Response) => {
  const connection = await Pool.getConnection();
  const { email, password }: LoginRequest["body"] = req.body;

  try {
    const [rows] = await connection.execute<RowDataPacket[]>(`SELECT * FROM hobit.users WHERE email = ?`, [email]);
    const user = rows[0] as User;

    if (!user) {
      return res.status(404).json({
        statusCode: 404,
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        statusCode: 401,
        message: "Invalid password",
      });
    }

    const username = user.username;
    const user_id = user.id;
    const payload: Payload = { user_id };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRATION,
    });

    const refreshToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRATION,
    });

    res.cookie("accessToken", accessToken, {
      httpOnly: true, // 클라이언트에서 쿠키를 확인하지 못하도록 설정
      secure: true, // HTTPS에서만 작동
      sameSite: "none", // SameSite 설정
      maxAge: Number(env.JWT_EXPIRATION) * 1000, // 쿠키 유효 기간 설정
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none", // SameSite 설정
      maxAge: Number(env.JWT_REFRESH_EXPIRATION) * 1000,
    });

    const response: LoginResponse = {
      statusCode: 200,
      message: "Authentication successful",
      data: {
        user_id,
        username,
      },
    };

    res.json(response);
  } catch (err: any) {
    const response = {
      statusCode: 500,
      message: err.message,
    };
    res.status(500).json(response);
  } finally {
    connection.release();
  }
});

export default router;
