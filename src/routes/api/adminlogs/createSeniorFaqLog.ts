import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection } from "mysql2/promise";
import { CreateSeniorFAQLogRequest, CreateSeniorFAQLogResponse } from '../../../types/adminLog';
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

const router = express.Router();

// @route   Post api/adminlogs/seniorfaqlogs
// @desc    Create a senior_faq_log
// @access  Private
router.post("/seniorfaqlogs", auth, async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const {
    username,
    senior_faq_id,
    prev_senior_faq,
    new_senior_faq,
    action_type
  } : CreateSeniorFAQLogRequest['body'] = req.body;
  try { 
    await connection.execute(
      `INSERT INTO senior_faq_logs (
        username, senior_faq_id, action_type, prev_senior_faq, new_senior_faq) 
        VALUES (?, ?, ?, ?, ?)`,
      [
        username,
        senior_faq_id,
        action_type,
        JSON.stringify(prev_senior_faq),
        JSON.stringify(new_senior_faq)
      ]
    );
    const response : CreateSeniorFAQLogResponse= {
      statusCode: 201,
      message: "Senior FAQ log created successfully"
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