import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { UpdateSeniorFAQRequest, UpdateSeniorFAQResponse } from '../../../types/seniorfaq';
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

// @route   Put api/seniorfaqs/:senior_faq_id
// @desc    Update a Senior FAQ
// @access  Private
router.put("/:senior_faq_id", auth, async (req: Request, res: Response) => {
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
  const existed_accessToken = req.cookies?.accessToken;

  try {
    const [userName] = await connection.execute<RowDataPacket[]>(
      `SELECT username FROM hobit.users WHERE id = ?`,
      [user_id]
    )

    const username = userName[0].username as string;

    const [[senior_faq]] = await connection.execute<RowDataPacket[]>(
      `SELECT maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, detailcategory_ko, detailcategory_en, answer_ko, answer_en, manager
        FROM hobit.senior_faqs 
        WHERE id = ?`,
      [Number(senior_faq_id)]
    );
    

    const prev_senior_faq : SeniorFAQ = {
      maincategory_ko: senior_faq.maincategory_ko,
      maincategory_en: senior_faq.maincategory_en,
      subcategory_ko: senior_faq.subcategory_ko,
      subcategory_en: senior_faq.subcategory_en,
      detailcategory_ko: senior_faq.detailcategory_ko,
      detailcategory_en: senior_faq.detailcategory_en,
      answer_ko: safetyParse(senior_faq.answer_ko),
      answer_en: safetyParse(senior_faq.answer_en),
      manager: senior_faq.manager
    }

    const new_senior_faq : SeniorFAQ = {
      maincategory_ko: maincategory_ko,
      maincategory_en: maincategory_en,
      subcategory_ko: subcategory_ko,
      subcategory_en: subcategory_en,
      detailcategory_ko: detailcategory_ko,
      detailcategory_en: detailcategory_en,
      answer_ko: answer_ko,
      answer_en: answer_en,
      manager: manager
    }

    const data = {
      username: username,
      senior_faq_id: senior_faq_id,
      prev_senior_faq: prev_senior_faq,
      new_senior_faq: new_senior_faq,
      action_type: '수정'
    }

    const logResponse = await fetch(`${env.API_URL}/adminlogs/seniorfaqlogs`, {
      method: 'POST',
      headers: {
       'Content-Type': 'application/json',
       "Cookie": `accessToken=${existed_accessToken}`
      },
      body: JSON.stringify(data),
    });

    if(!logResponse.ok) {
      const errorData = await logResponse.json();
      return res.status(logResponse.status).json({ 
        statusCode: logResponse.status,
        message: errorData.message 
      });
    }

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
        JSON.stringify(answer_ko),
        JSON.stringify(answer_en),
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

function safetyParse<T>(data: string): T | undefined {
  try {
    return JSON.parse(data) as T;
  } catch (error) {
    console.error('Invalid JSON string:', error);
    return undefined;
  }
}


export default router;
