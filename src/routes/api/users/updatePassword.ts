import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { UpdatePasswordRequest, UpdatePasswordResponse } from "../../../types/user";

const router = express.Router();

// @route   Put api/user/newpassword/:user_id
// @desc    Set new password for user
// @access  Public
router.put("/newpassword/:user_id", async (req: Request<{ user_id: UpdatePasswordRequest['params'] }>, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { user_id } = req.params;
  const { password } : UpdatePasswordRequest['body'] = req.body;

  try {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    await connection.execute<ResultSetHeader>(
      `UPDATE hobit.users SET password = ? WHERE id = ?`,
      [hashed, user_id]
    );

    const response : UpdatePasswordResponse = {
      statusCode: 200,
      message: "Successfully set new password",
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