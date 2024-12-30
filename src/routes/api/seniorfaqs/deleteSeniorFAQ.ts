import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection } from "mysql2/promise";
import { DeleteSeniorFAQRequest, DeleteSeniorFAQResponse } from "../../../types/seniorfaq";

const router = express.Router();

// @route   DELETE api/seniorfaqs/:faq_id
// @desc    Delete a Senior FAQ
// @access  Private
router.delete("/:senior_faq_id", async (req: Request<{ senior_faq_id: DeleteSeniorFAQRequest['params'] }>, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { senior_faq_id } = req.params;
  console.log(senior_faq_id);

  try {
    await connection.execute(
      'DELETE FROM hobit.senior_faqs WHERE id = ?',
      [senior_faq_id]
    );

    const response: DeleteSeniorFAQResponse = {
      statusCode: 200,
      message: "Senior FAQ deleted successfully"
    };
    console.log(response);
    res.status(200).json(response);
  } catch (err: any) {
    const response = {
      statusCode: 500,
      message: err.message,
    };
    console.log(response);
    res.status(500).json(response);
  } finally {
    connection.release();
  }
});

export default router;
