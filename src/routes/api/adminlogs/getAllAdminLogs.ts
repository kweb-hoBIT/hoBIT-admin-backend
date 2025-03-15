import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { GetAllAdminLogResponse } from '../../../types/adminLog';
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

const router = express.Router();

// @route   Get api/adminlogs/
// @desc    Get all admin_logs
// @access  Private
router.get('/', auth, async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();

  try {
    const row = await connection.execute<RowDataPacket[]>(
      `SELECT * 
      FROM (
        SELECT 
          faq_logs.id AS log_id,
          faq_logs.username,
          faq_logs.faq_id AS category_id,
          faqs.maincategory_ko AS maincategory,
          faqs.subcategory_ko AS subcategory,
          NULL AS detailcategory,
          faqs.question_ko AS question,
          faq_logs.action_type,
          faq_logs.created_at,
          'faq_log' AS log_type
        FROM hobit.faq_logs
        LEFT JOIN hobit.faqs ON faq_logs.faq_id = faqs.id
        UNION ALL
        SELECT
          senior_faq_logs.id AS log_id,
          senior_faq_logs.username,
          senior_faq_logs.senior_faq_id AS category_id,
          senior_faqs.maincategory_ko AS maincategory,
          senior_faqs.subcategory_ko AS subcategory,
          senior_faqs.detailcategory_ko AS detailcategory,
          NULL AS question,
          senior_faq_logs.action_type,
          senior_faq_logs.created_at,
          'senior_faq_log' AS log_type
        FROM hobit.senior_faq_logs
        LEFT JOIN hobit.senior_faqs ON senior_faq_logs.senior_faq_id = senior_faqs.id
      ) AS admin_logs
      ORDER BY admin_logs.created_at DESC;
      `
    );
    const adminLogs = row[0] as GetAllAdminLogResponse['data']['adminLogs'];
    const response : GetAllAdminLogResponse = {
      statusCode: 200,
      message: "Adimn logs retrieved successfully",
      data: {
        adminLogs
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