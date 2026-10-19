import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { UpdatePasswordRequest, UpdatePasswordResponse } from "../../../types/user";
import { verifyResetToken } from "../../../middleware/manageKey";

const router = express.Router();

// @route   Put api/user/newpassword/:user_id
// @desc    Set new password for user
// @access  /users/find에서 받은 재설정 토큰(10분)이 있어야 함
router.put("/newpassword/:user_id", async (req: Request<{ user_id: UpdatePasswordRequest['params'] }>, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { user_id } = req.params;
  const { password, resetToken } : UpdatePasswordRequest['body'] = req.body;

  // 예전에는 인증 없이 아무 user_id의 비밀번호나 바꿀 수 있었음
  const tokenUser = verifyResetToken(resetToken);
  if (tokenUser === null || String(tokenUser) !== String(user_id)) {
    connection.release();
    return res.status(403).json({ statusCode: 403, message: "Invalid or expired reset token" });
  }
  if (typeof password !== "string" || password.length < 6) {
    connection.release();
    return res.status(400).json({ statusCode: 400, message: "Password must be at least 6 characters" });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    await connection.execute<ResultSetHeader>(
      `UPDATE users SET password = ? WHERE id = ?`,
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