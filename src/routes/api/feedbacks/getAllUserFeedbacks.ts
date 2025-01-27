import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { GetAllUserFeedbackResponse } from '../../../types/feedback';

const router = express.Router();

// @route   Get api/feedbacks/user
// @desc    Get all user feedbacks
// @access  Private
router.get("/user", async (req: Request, res: Response) => {
  const connection : PoolConnection= await Pool.getConnection();

  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT user_feedbacks.id, faqs.question_ko, user_feedbacks.feedback_reason, user_feedbacks.feedback_detail, user_feedbacks.resolved, user_feedbacks.created_at
      FROM hobit.user_feedbacks
      LEFT JOIN hobit.faqs ON user_feedbacks.faq_id = faqs.id 
      order by user_feedbacks.created_at desc`,
    )

    const userFeedbacks : GetAllUserFeedbackResponse['data']['userFeedbacks'] = rows.map((userFeedback) => {
      return {
        user_feedback_id: userFeedback.id,
        question_ko: userFeedback.question_ko,
        feedback_reason: userFeedback.feedback_reason,
        feedback_detail: userFeedback.feedback_detail,
        resolved: userFeedback.resolved,
        created_at: userFeedback.created_at
      };
    });
    const response :  GetAllUserFeedbackResponse = {
      statusCode: 200,
      message: "User feedbacks retrieved successfully",
      data : {
        userFeedbacks
      }
    };
    console.log(response);
    res.status(200).json(response);
  } catch (err: any) {
    console.error(err.message);
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