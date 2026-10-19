import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { FindUserRequest, FindUserResponse } from "../../../types/user";
import { roleForKey, signResetToken } from "../../../middleware/manageKey";
import { roleOf } from "../chat/chatIndex";

const router = express.Router();

// @route   POST api/user/find
// @desc    Find user given their email, username, and phone_num
// @access  Public
router.post("/find", async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { email, username, phone_num, manageKey } : FindUserRequest['body'] = req.body;
  const keyRole = roleForKey(manageKey);
  if (!keyRole) {
    const response = {
      statusCode: 403,
      message: "Invalid Manage key. Access denied."
    }
    console.log(response);
    return res.status(403).json(response);
  }
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT users.id FROM users WHERE email = ? and username = ? and phone_num = ?`,
      [email, username, phone_num]
    );

    const user_id = rows[0]?.id as number;

    // 키보다 높은 역할의 계정은 못 찾음 — 근장 키 → 근로장학생만, 관리자 키 → 개발자 제외 (다른 경우와 같은 응답)
    const RANK = { senior: 0, staff: 1, developer: 2 } as const;
    if (user_id && RANK[await roleOf(user_id)] > RANK[keyRole]) {
      return res.status(400).json({ statusCode: 400, message: "User not found" });
    }

    if (!user_id) {
      const response = {
        statusCode: 400,
        message: "User not found"
      }
      console.log(response);
      return res.status(400).json(response);
    }

    const response : FindUserResponse = {
      statusCode: 200,
      message: "Successfully found user",
      data: {
        user_id : user_id,
        resetToken: signResetToken(user_id),
      }
    }
    console.log({ statusCode: 200, message: response.message, user_id });
    res.status(200).json(response);
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