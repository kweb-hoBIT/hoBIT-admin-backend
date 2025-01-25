import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection } from "mysql2/promise";
import { CreateFAQLogRequest, CreateFAQLogResponse } from '../../../types/adminLog';

const router = express.Router();

// @route   Post api/adminlogs/faqlogs
// @desc    Create a faq_log
// @access  Private
router.post("/faqlogs", async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const {
    username,
    faq_id,
    prev_faq,
    new_faq,
    action_type
  } : CreateFAQLogRequest['body'] = req.body;
  try {
    await connection.execute(
      `INSERT INTO faq_logs (
        username, faq_id, action_type, prev_faq, new_faq) 
        VALUES (?, ?, ?, ?, ?)`,
      [
        username,
        faq_id,
        action_type,
        JSON.stringify(prev_faq),
        JSON.stringify(new_faq)
      ]
    );
    const response : CreateFAQLogResponse= {
      statusCode: 201,
      message: "FAQ log created successfully"
    };
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