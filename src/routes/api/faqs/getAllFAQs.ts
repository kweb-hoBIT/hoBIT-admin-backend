import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { GetAllFAQResponse } from '../../../types/faq';
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

const router = express.Router();

// @route   Get api/faqs/
// @desc    Get all FAQs
// @access  Private
router.get("/", auth, async (req: Request, res: Response) => {
  const connection : PoolConnection= await Pool.getConnection();

  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT * FROM faqs order by created_at desc',
    )

    const faqs : GetAllFAQResponse['data']['faqs'] = rows.map((faq) => {
      return {
        faq_id: faq.id,
        maincategory_ko: faq.maincategory_ko,
        maincategory_en: faq.maincategory_en,
        subcategory_ko: faq.subcategory_ko,
        subcategory_en: faq.subcategory_en,
        question_ko: faq.question_ko,
        question_en: faq.question_en,
        answer_ko: safetyParse(faq.answer_ko),
        answer_en: safetyParse(faq.answer_en),
        manager: faq.manager,
        created_at: faq.created_at,
        updated_at: faq.updated_at
      };
    });
    const response :  GetAllFAQResponse = {
      statusCode: 200,
      message: "FAQs retrieved successfully",
      data : {
        faqs
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

function safetyParse<T>(data: string): T | undefined {
  try {
    return JSON.parse(data) as T;
  } catch (error) {
    console.error('Invalid JSON string:', error);
    return undefined;
  }
}

export default router;