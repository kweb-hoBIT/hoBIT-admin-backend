import express, { Response } from "express";
import bcrypt from "bcryptjs";
import config from "config";
import jwt from "jsonwebtoken";
import Payload from "../../../types/Payload";
import Request from "../../../types/Request";
import { Pool } from "../../../../config/connectDB";
import { RowDataPacket } from "mysql2/promise";
import { LoginRequest, LoginResponse } from "../../../types/user";

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
  const { email, password }: LoginRequest['body'] = req.body;

  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT * FROM hobit.users WHERE email = ?`,
      [email]
    );
    const user = rows[0] as User;

    if (!user) {
      return res.status(404).json({
        statusCode: 404,
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        statusCode: 400,
        message: "Invalid password",
      });
    }

    const username = user.username;
    const user_id = user.id;
    const payload: Payload = { user_id };

    const accessToken = jwt.sign(payload, config.get("jwtSecret"), {
      expiresIn: config.get("jwtExpiration"),
    });
  
    const refreshToken = jwt.sign(payload, config.get("jwtSecret"), {
      expiresIn: config.get("jwtRefreshExpiration"),
    });

    const response: LoginResponse = {
      statusCode: 200,
      message: "Authentication successful",
      data: {
        accessToken,
        refreshToken,
        user_id,
        username
      },
    };
    res.json(response);
  } catch (err: any) {
    const response = {
      statusCode: 500,
      message: err.message,
    }
    res.status(500).json(response);
  } finally {
    connection.release();
  }
});

export default router;