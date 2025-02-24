import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { GetFAQRequest, GetFAQResponse } from '../../../types/faq';

const router = express.Router();

interface FAQ {
  faq_id: number;
  maincategory_ko: string;
  maincategory_en: string;
  subcategory_ko: string;
  subcategory_en: string;
  question_ko: string;
  question_en: string;
  answer_ko: string;
  answer_en: string;
  manager: string;
  created_at: string;
  updated_at: string;
}


// @route   GET api/faqs/:faq_id
// @desc    get a FAQ
// @access  Private
router.get("/:faq_id", async (req: Request<GetFAQRequest['params']>, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { faq_id } = req.params;
  console.log(faq_id);

  try {
    const [row] = await connection.execute<RowDataPacket[]>(
      'SELECT id as faq_id, maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, question_ko, question_en, answer_ko, answer_en, manager, created_at, updated_at FROM hobit.faqs WHERE id = ?',
      [Number(faq_id)]
    );

    const faq = row[0] as FAQ;

    const response: GetFAQResponse = {
      statusCode: 200,
      message: "FAQ retrieved successfully",
      data: {
        faq: {
          faq_id: faq.faq_id,
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
        }
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
    return typeof data === 'string' ? JSON.parse(data) as T : data;
  } catch (error) {
    console.error('Invalid JSON string:', error);
    return undefined;
  }
}

export default router;
