import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { FindUserRequest, FindUserResponse } from "../../../types/user";
import env from '../../../../config/env';

const router = express.Router();

// @route   POST api/user/find
// @desc    Find user given their email, username, and phone_num
// @access  Public
router.post("/find", async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { email, username, phone_num, manageKey } : FindUserRequest['body'] = req.body;
  if (!env.MANAGER_KEY.includes(manageKey)) {
    const response = {
      statusCode: 403,
      message: "Invalid Manage key. Access denied."
    }
    console.log(response);
    return res.status(403).json(response);
  }
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT users.id FROM hobit.users WHERE email = ? and username = ? and phone_num = ?`,
      [email, username, phone_num]
    );

    const user_id = rows[0]?.id as number;

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
        user_id : user_id
      }
    }
    console.log(response);
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