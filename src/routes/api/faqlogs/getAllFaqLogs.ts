import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { GetAllFAQLogResponse } from '../../../types/faqLog';

const router = express.Router();

// @route   Get api/faqlogs/
// @desc    Get all faq_logs
// @access  Private
router.get('/', async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();

  try {
    const row = await connection.execute<RowDataPacket[]>(
      `SELECT 
        faq_logs.id AS faq_log_id,
        faq_logs.user_id,
        users.username,
        faq_logs.faq_id,
        faqs.maincategory_ko AS faq_maincategory,
        faqs.subcategory_ko AS faq_subcategory,
        faqs.question_ko AS faq_question,
        faq_logs.action_type,
        faq_logs.created_at
      FROM hobit.faq_logs
      LEFT JOIN hobit.users ON faq_logs.user_id = users.id
      LEFT JOIN hobit.faqs ON faq_logs.faq_id = faqs.id
      ORDER BY faq_logs.created_at DESC`
    );
    const faqLogs = row[0] as GetAllFAQLogResponse['data']['faqLogs'];
    const response : GetAllFAQLogResponse = {
      statusCode: 200,
      message: "FAQ logs retrieved successfully",
      data: {
        faqLogs
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