import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { CompareFAQLogRequest, CompareFAQLogResponse } from '../../../types/adminLog';
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";


const router = express.Router();

interface FAQLog {
  prev_faq: string;
  new_faq: string;
}

// @route   Post api/adminlogs/faqlogs/compare/:faq_log_id
// @desc    Get a comparison of the faq_log
// @access  Private
router.get('/faqlogs/compare/:faq_log_id', auth, async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const {faq_log_id} = req.params;

  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT 
        faq_logs.prev_faq,
        faq_logs.new_faq
      FROM faq_logs
      WHERE faq_logs.id = ?
      `, [faq_log_id]
    );

    const faqLog =  rows[0] as FAQLog;
    
    const prevFaq : CompareFAQLogResponse['data']['prev_faq'] = safetyParse(faqLog.prev_faq);
    const newFaq : CompareFAQLogResponse['data']['new_faq'] = safetyParse(faqLog.new_faq);

    const response : CompareFAQLogResponse = {
      statusCode: 200,
      message: "FAQ log comparison retrieved successfully",
      data: {
        prev_faq: prevFaq,
        new_faq: newFaq
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