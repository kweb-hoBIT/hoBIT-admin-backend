import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { GetAllQuestionLogResponse } from "../../../types/questionLog";
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

const router = express.Router();

// @route   Get api/questionlogs/
// @desc    Get all question_logs
// @access  Private
router.get('/', auth, async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();

  try {
    const rows = await connection.execute<RowDataPacket[]>(
      `SELECT 
        ql.id AS question_log_id,
        ql.user_question,
        ql.feedback_score,
        ql.feedback,
        ql.created_at,
        f.id AS faq_id,
        IF (ql.language = 'ko', f.question_ko, f.question_en) AS faq_question
      FROM hobit.question_logs ql
      LEFT JOIN hobit.faqs f ON ql.faq_id = f.id
      ORDER BY ql.created_at DESC`
    );
    const questionLogs = rows[0] as GetAllQuestionLogResponse['data']['questionLogs'];

    const response : GetAllQuestionLogResponse = {
      statusCode: 200,
      message: "Question logs retrieved successfully",
      data : {
        questionLogs
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