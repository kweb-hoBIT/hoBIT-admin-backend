import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { DeleteSeniorFAQRequest, DeleteSeniorFAQResponse } from "../../../types/seniorfaq";
import env from "../../../../config/env";
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

const router = express.Router();

interface SeniorFAQ {
  maincategory_ko: string;
  maincategory_en: string;
  subcategory_ko: string;
  subcategory_en: string;
  detailcategory_ko: string;
  detailcategory_en: string;
  answer_ko: { title: string, answer: string; url: string; map: { latitude: string, longitude: string;} }[];
  answer_en: { title: string, answer: string; url: string; map: { latitude: string, longitude: string;} }[];
  manager: string;
}

// @route   DELETE api/seniorfaqs/:faq_id
// @desc    Delete a Senior FAQ
// @access  Private
router.delete("/:senior_faq_id", auth, async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { senior_faq_id } = req.params;
  const { user_id }: DeleteSeniorFAQRequest['body'] = req.body;
  const existed_accessToken = req.cookies?.accessToken;
  console.log(senior_faq_id);

  try {
    const [userName] = await connection.execute<RowDataPacket[]>(
      `SELECT username FROM hobit.users WHERE id = ?`,
      [user_id]
    )
    const username = userName[0].username as string;

    const [[seniorfaq]] = await connection.execute<RowDataPacket[]>(
      `SELECT maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, detailcategory_ko, detailcategory_en, answer_ko, answer_en, manager
       FROM hobit.senior_faqs 
       WHERE id = ?`,
      [Number(senior_faq_id)]
    );

    const prev_senior_faq : SeniorFAQ = {
      maincategory_ko: seniorfaq.maincategory_ko,
      maincategory_en: seniorfaq.maincategory_en,
      subcategory_ko: seniorfaq.subcategory_ko,
      subcategory_en: seniorfaq.subcategory_en,
      detailcategory_ko: seniorfaq.detailcategory_ko,
      detailcategory_en: seniorfaq.detailcategory_en,
      answer_ko: safetyParse(seniorfaq.answer_ko),
      answer_en: safetyParse(seniorfaq.answer_en),
      manager: seniorfaq.manager
    }

    const new_senior_faq : SeniorFAQ = {
      maincategory_ko: "",
      maincategory_en: "",
      subcategory_ko: "",
      subcategory_en: "",
      detailcategory_ko: "",
      detailcategory_en: "",
      answer_ko: [],
      answer_en: [],
      manager: "",
    }
    
    const data = {
      username: username,
      senior_faq_id: senior_faq_id,
      prev_senior_faq: prev_senior_faq,
      new_senior_faq: new_senior_faq,
      action_type: '삭제'
    }

    // senior_faq_logs 테이블에 로그를 남기기 위해 API 호출
    const logResponse = await fetch(`${env.API_URL}/adminlogs/seniorfaqlogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        "Cookie": `accessToken=${existed_accessToken}`
      },
      body: JSON.stringify(data)
    });

    if(!logResponse.ok) {
      const errorData = await logResponse.json();
      console.log(errorData)
      return res.status(logResponse.status).json({ error: errorData.message });
    }

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

function safetyParse<T>(data: string): T | undefined {
  try {
    return JSON.parse(data) as T;
  } catch (error) {
    console.error('Invalid JSON string:', error);
    return undefined;
  }
}

export default router;
