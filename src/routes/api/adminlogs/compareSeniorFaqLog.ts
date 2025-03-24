import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { CompareSeniorFAQLogRequest, CompareSeniorFAQLogResponse } from '../../../types/adminLog';
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

const router = express.Router();

interface SeniorFAQLog {
  prev_senior_faq: string;
  new_senior_faq: string;
}

// @route   Post api/adminlogs/seniorfaqlogs/compare/:senior_faq_log_id
// @desc    Get a comparison of the senior_faq_log
// @access  Private
router.get('/seniorfaqlogs/compare/:senior_faq_log_id', auth, async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const {senior_faq_log_id} = req.params;

  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT 
        senior_faq_logs.prev_senior_faq,
        senior_faq_logs.new_senior_faq
      FROM senior_faq_logs
      WHERE senior_faq_logs.id = ?
      `, [senior_faq_log_id]
    );

    const faqLog =  rows[0] as SeniorFAQLog;
    
    const prevSeniorFaq : CompareSeniorFAQLogResponse['data']['prev_senior_faq'] = safetyParse(faqLog.prev_senior_faq);
    const newSeniorFaq : CompareSeniorFAQLogResponse['data']['new_senior_faq'] = safetyParse(faqLog.new_senior_faq);

    const response : CompareSeniorFAQLogResponse = {
      statusCode: 200,
      message: "Senior FAQ log comparison retrieved successfully",
      data: {
        prev_senior_faq: prevSeniorFaq,
        new_senior_faq: newSeniorFaq
      }
    };
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

function safetyParse<T>(data: string): T | undefined {
  try {
    return JSON.parse(data) as T;
  } catch (error) {
    console.error('Invalid JSON string:', error);
    return undefined;
  }
}

export default router;