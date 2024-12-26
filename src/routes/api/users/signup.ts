import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket,  ResultSetHeader } from "mysql2/promise";
import { SignupRequest, SignupResponse } from "../../../types/user";

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

const VALID_INVITATION_KEYS = ["YOUR_SECRET_KEY_1", "YOUR_SECRET_KEY_2"];

// @route   POST api/user
// @desc    Register user given their email and password, returns the token upon successful registration
// @access  Public
router.post("/", async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { email, password, username, phone_num, invitationKey } : SignupRequest['body'] = req.body;
  if (!VALID_INVITATION_KEYS.includes(invitationKey)) {
    const response = {
      statusCode: 403,
      message: "Invalid invitation key. Access denied."
    }
    console.log(response);
    return res.status(403).json(response);
  }
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT * FROM hobit.users WHERE email = ?`,
      [email]
    );
    const user_existed = rows[0] as User;

    if (user_existed) {
      const response = {
        statusCode : 400,
        message: "User already exists"
      }
      console.log(response); 
      return res.status(400).json(response);
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    await connection.execute<ResultSetHeader>(
      `INSERT INTO hobit.users (email, password, username, phone_num) VALUES (?, ?, ? ,?)`,
      [email, hashed, username, phone_num]
    );

    const response : SignupResponse = {
      statusCode: 201,
      message: "User registered successfully",
    }
    console.log(response);
    res.status(201).json(response);
  } catch (err: any) {
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