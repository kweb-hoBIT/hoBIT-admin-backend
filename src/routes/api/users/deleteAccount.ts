import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection,  ResultSetHeader } from "mysql2/promise";
import { DeleteAccountReqeust, DeleteAccountResponse } from "../../../types/user";
import config from 'config';

const managerKey = config.get<string>("managerKey");

const router = express.Router();

// @route DELETE api/users/:user_id
// @desc Delete user by user_id
// @access Private
router.delete("/:user_id", async (req: Request<DeleteAccountReqeust['params']>, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { user_id } = req.params;
  const { deleteKey } : DeleteAccountReqeust['body'] = req.body;
  console.log(user_id)

  if (!managerKey.includes(deleteKey)) {
    const response = {
      statusCode: 403,
      message: "Invalid invitation key. Access denied."
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