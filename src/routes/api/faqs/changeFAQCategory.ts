import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { changeFAQCategoryResponse, changeFAQCategoryRequest } from "faq";
import auth from "../../../middleware/auth";
import Request from "../../../types/Request";

const router = express.Router();

interface FAQ {
  faq_id: number;
  maincategory_ko: string;
  maincategory_en: string;
  subcategory_ko: string;
  subcategory_en: string;
  question_ko: string;
  question_en: string;
  answer_ko: { answer: string; url: string; email: string; phone: string; }[];
  answer_en: { answer: string; url: string; email: string; phone: string; }[];
  manager: string;
}

// @route   PUT api/faqs/category
// @desc    change FAQ category
// @access  Private
router.put("/category", auth, async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { user_id, category_field, prev_category, new_category }: changeFAQCategoryRequest['body'] = req.body;

  console.log(req.body);

  try {
    const [userName] = await connection.execute<RowDataPacket[]>(
      `SELECT username FROM hobit.users WHERE id = ?`,
      [user_id]
    );

    const username = userName[0]?.username as string;

    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT id as faq_id, maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, question_ko, question_en, answer_ko, answer_en, manager
       FROM hobit.faqs
       WHERE ${category_field} = ?`,
      [prev_category]
    );

    const prev_faqs = rows as FAQ[];

    const new_faqs = prev_faqs.map((faq: FAQ) => {
      return {
        ...faq,
        category_field: new_category,
      };
    });
    console.log('hi')
    await connection.execute(
      `UPDATE hobit.faqs SET ${category_field} = ? WHERE ${category_field} = ?`,
      [new_category, prev_category]
    )
    console.log('hi')
    const logData = []

    for (let i = 0; i < prev_faqs.length; i++) {
      logData.push([
        username,
        prev_faqs[i].faq_id,
        JSON.stringify(prev_faqs[i]),
        JSON.stringify(new_faqs[i]),
        '수정',
      ])
    }
    await connection.query(
      `INSERT INTO hobit.faq_logs (username, faq_id, prev_faq, new_faq, action_type) VALUES ?`,
      [logData]
    )
    
 
    const response: changeFAQCategoryResponse = {
      statusCode: 200,
      message: "FAQ category changed successfully",
    };
    console.log(response);
    res.status(200).json(response);

  } catch (err: any) {
    const response = {
      statusCode: 500,
      message: err.message,
    };
    console.error(response);
    res.status(500).json(response);
  } finally {
    connection.release();
  }
});

export default router;
