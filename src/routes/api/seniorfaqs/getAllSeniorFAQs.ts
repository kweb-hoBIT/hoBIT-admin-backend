import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { GetAllSeniorFAQResponse } from '../../../types/seniorfaq';

const router = express.Router();

// @route   Get api/seniorfaqs/
// @desc    Get all Senior FAQs
// @access  Private
router.get("/", async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();

  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT * FROM senior_faqs ORDER BY created_at DESC'
    );

    const seniorFaqs: GetAllSeniorFAQResponse['data']['seniorFaqs'] = rows.map((seniorFaq) => {
      return {
        senior_faq_id: seniorFaq.id,
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
      };
    });

    const response: GetAllSeniorFAQResponse = {
      statusCode: 200,
      message: "Senior FAQs retrieved successfully",
      data: {
        seniorFaqs
      }
    };
    console.log(response);
    res.status(200).json(response);
  } catch (err: any) {
    console.error(err.message);
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
    return JSON.parse(data) as T;
  } catch (error) {
    console.error('Invalid JSON string:', error);
    return undefined;
  }
}

export default router;
