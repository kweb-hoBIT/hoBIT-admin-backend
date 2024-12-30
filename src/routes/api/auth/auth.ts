import express, { Response } from "express";
import auth from "../../../middleware/auth";
import Request from "../../../types/Request";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";

const router = express.Router();

// @route   GET api/auth
// @desc    Get authenticated user given the token
// @access  Private
router.get("/", auth, async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { user_id }: { user_id: number } = req;
  try {
    const [[user]] = await connection.execute<RowDataPacket[]>(
      `SELECT id, email, username, phone_num, created_at, updated_at FROM hobit.users WHERE id = ?`,
      [user_id]
    );

    if (!user) {
      return res.status(404).json({
        statusCode: 404,
        message: "User not found",
      });
    }

    const response = {
      statusCode: 200,
      message: "User data retrieved successfully",
      data: {
        user,
      },
    };

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
