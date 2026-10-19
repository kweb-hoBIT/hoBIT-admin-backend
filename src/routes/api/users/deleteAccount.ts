import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection,  ResultSetHeader } from "mysql2/promise";
import { DeleteAccountReqeust, DeleteAccountResponse } from "../../../types/user";
import { isValidManageKey } from "../../../middleware/manageKey";
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";
import { getChatPool } from "../chat/chatIndex";

const router = express.Router();

// @route DELETE api/users/:user_id
// @desc Delete user by user_id
// @access Private
router.delete("/:user_id", auth, async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { user_id } = req.params;
  const { manageKey } : DeleteAccountReqeust['body'] = req.body;
  console.log(user_id)

  // 본인 계정만 탈퇴 (예전엔 로그인한 누구나 다른 계정 id로 지울 수 있었음)
  if (String(user_id) !== String(req.user_id)) {
    return res.status(403).json({ statusCode: 403, message: "You can only delete your own account." });
  }
  if (!isValidManageKey(manageKey)) {
    const response = {
      statusCode: 403,
      message: "Invalid Manage key. Access denied."
    }
    console.log(response);
    return res.status(403).json(response);
  }

  try {
    await connection.execute<ResultSetHeader>(
      `DELETE FROM users WHERE id = ?`,
      [user_id]
    );
    // 채팅 역할 기록도 지움 (같은 id가 다시 쓰여도 예전 역할이 붙지 않게)
    await getChatPool()
      .then((pool) => pool.query(`DELETE FROM chat_agents WHERE user_id = ?`, [user_id]))
      .catch((e) => console.error("[chat] 역할 기록 삭제 실패:", (e as Error).message));
    const response : DeleteAccountResponse = {
      statusCode: 200,
      message: "User deleted successfully",
    };
    console.log(response);
    res.status(200).json(response);
  } catch (err: any) {
    const response = {
      statusCode: 500,
      message: err.message,
    };
    console.log(response);
    res.status(500).json(response);
  } finally {
    connection.release();
  }

});



export default router;