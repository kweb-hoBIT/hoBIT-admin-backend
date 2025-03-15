import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { GetSeniorFAQRequest, GetSeniorFAQResponse } from '../../../types/seniorfaq';
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

const router = express.Router();

interface SeniorFAQ {
  senior_faq_id: number;
  maincategory_ko: string;
  maincategory_en: string;
  subcategory_ko: string;
  subcategory_en: string;
  detailcategory_ko: string;
  detailcategory_en: string;
  answer_ko: string;
  answer_en: string;
  manager: string;
  created_at: string;
  updated_at: string;
}

// @route   GET api/seniorfaqs/:faq_id
// @desc    Get a Senior FAQ by ID
// @access  Private
router.get("/:senior_faq_id", auth, async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { senior_faq_id } = req.params;
  console.log(senior_faq_id);

  try {
    const [row] = await connection.execute<RowDataPacket[]>(
      'SELECT id as senior_faq_id, maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, detailcategory_ko, detailcategory_en, answer_ko, answer_en, manager, created_at, updated_at FROM hobit.senior_faqs WHERE id = ?',
      [Number(senior_faq_id)]
    );

    const seniorFaq = row[0] as SeniorFAQ;

    const response: GetSeniorFAQResponse = {
      statusCode: 200,
      message: "Senior FAQ retrieved successfully",
      data: {
        seniorFaq: {
          senior_faq_id: seniorFaq.senior_faq_id,
          maincategory_ko: seniorFaq.maincategory_ko,
          maincategory_en: seniorFaq.maincategory_en,
          subcategory_ko: seniorFaq.subcategory_ko,
          subcategory_en: seniorFaq.subcategory_en,
          detailcategory_ko: seniorFaq.detailcategory_ko,
          detailcategory_en: seniorFaq.detailcategory_en,
          answer_ko: safetyParse(seniorFaq.answer_ko),
          answer_en: safetyParse(seniorFaq.answer_en),
          manager: seniorFaq.manager,
          created_at: seniorFaq.created_at,
          updated_at: seniorFaq.updated_at
        }
      }
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

function safetyParse<T>(data: string): T | undefined {
  try {
    return typeof data === 'string' ? JSON.parse(data) as T : data;
  } catch (error) {
    console.error('Invalid JSON string:', error);
    return undefined;
  }
}

export default router;
