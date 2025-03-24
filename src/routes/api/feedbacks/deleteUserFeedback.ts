import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection } from "mysql2/promise";
import { DeleteUserFeedbackResponse } from '../../../types/feedback';
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

const router = express.Router();

// @route   Delete api/feedbacks/user/:user_feedback_id
// @desc    Delete a user feedback
// @access  Private
router.delete("/user/:user_feedback_id", auth, async (req: Request, res: Response) => {
  const connection : PoolConnection = await Pool.getConnection();
  const { user_feedback_id }  = req.params;
  console.log(user_feedback_id);

  try {
    await connection.execute(
      'DELETE FROM hobit.user_feedbacks WHERE id = ?',
      [user_feedback_id]
    );
    
    const response : DeleteUserFeedbackResponse = {
      statusCode: 200,
      message: "User feedback deleted successfully",
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