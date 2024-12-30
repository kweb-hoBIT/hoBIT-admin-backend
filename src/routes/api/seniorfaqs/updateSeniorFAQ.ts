import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { UpdateSeniorFAQRequest, UpdateSeniorFAQResponse } from '../../../types/seniorfaq';

const router = express.Router();

// @route   Put api/seniorfaqs/:senior_faq_id
// @desc    Update a Senior FAQ
// @access  Private
router.put("/:senior_faq_id", async (req: Request<{ senior_faq_id: UpdateSeniorFAQRequest['params'] }>, res: Response) => {
  const connection : PoolConnection = await Pool.getConnection();
  const { senior_faq_id } = req.params;
  const {
    user_id,
    maincategory_ko,
    maincategory_en,
    subcategory_ko,
    subcategory_en,
    detailcategory_ko,
    detailcategory_en,
    answer_ko,
    answer_en,
    manager
  } : UpdateSeniorFAQRequest['body'] = req.body;
  console.log(senior_faq_id, req.body);

  try {
    await connection.execute(
      `UPDATE hobit.senior_faqs SET 
        maincategory_ko = ?, 
        maincategory_en = ?, 
        subcategory_ko = ?, 
        subcategory_en = ?, 
        detailcategory_ko = ?, 
        detailcategory_en = ?, 
        answer_ko = ?, 
        answer_en = ?, 
        manager = ?, 
        updated_by = ? 
      WHERE id = ?`,
      [ 
        maincategory_ko,
        maincategory_en,
        subcategory_ko,
        subcategory_en,
        detailcategory_ko,
        detailcategory_en,
        answer_ko,
        answer_en,
        manager,
        user_id,
        senior_faq_id
      ]
    );

    const response : UpdateSeniorFAQResponse = {
      statusCode: 200,
      message: "Senior FAQ updated successfully"
    };

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
