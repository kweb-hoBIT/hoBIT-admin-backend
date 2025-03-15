import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { UpdateUserFeedbackRequest, UpdateUserFeedbackResponse } from '../../../types/feedback';
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

const router = express.Router();

// @route   Put api/feedbacks/user/:user_feedback_id
// @desc    Update user feedback resolved status
// @access  Private
router.put("/user/:user_feedback_id", auth, async (req: Request, res: Response) => {
  const connection : PoolConnection= await Pool.getConnection();
  const { user_feedback_id } = req.params;
  console.log(user_feedback_id);

  try {
    await connection.execute<RowDataPacket[]>(
      'UPDATE hobit.user_feedbacks SET resolved = CASE WHEN resolved = 1 THEN 0 ELSE 1 END WHERE id = ?',
      [Number(user_feedback_id)]
    );
  
    const response :  UpdateUserFeedbackResponse = {
      statusCode: 200,
      message: "User feedback resolved status updated successfully",
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