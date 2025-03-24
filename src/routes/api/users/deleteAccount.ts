import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection,  ResultSetHeader } from "mysql2/promise";
import { DeleteAccountReqeust, DeleteAccountResponse } from "../../../types/user";
import env from '../../../../config/env';
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

const router = express.Router();

// @route DELETE api/users/:user_id
// @desc Delete user by user_id
// @access Private
router.delete("/:user_id", auth, async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { user_id } = req.params;
  const { manageKey } : DeleteAccountReqeust['body'] = req.body;
  console.log(user_id)

  if (!env.MANAGER_KEY.includes(manageKey)) {
    const response = {
      statusCode: 403,
      message: "Invalid Manage key. Access denied."
    }
    console.log(response);
    return res.status(403).json(response);
  }

  try {
    await connection.execute<ResultSetHeader>(
      `DELETE FROM hobit.users WHERE id = ?`,
      [user_id]
    );
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