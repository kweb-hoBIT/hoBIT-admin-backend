import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { UpdateFAQRequest, UpdateFAQResponse } from '../../../types/faq';
import env from "../../../../config/env";
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

const router = express.Router();

interface FAQ {
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

// @route   Put api/faqs/:faq_id
// @desc    Update a FAQ
// @access  Private
router.put("/:faq_id", auth, async (req: Request, res: Response) => {
  const connection : PoolConnection= await Pool.getConnection();
  const { faq_id } = req.params;
  const {
    user_id,
    maincategory_ko,
    maincategory_en,
    subcategory_ko,
    subcategory_en,
    question_ko,
    question_en,
    answer_ko,
    answer_en,
    manager
  } : UpdateFAQRequest['body'] = req.body;
  console.log(faq_id, req.body);
  const existed_accessToken = req.cookies?.accessToken;

  try {
    const [userName] = await connection.execute<RowDataPacket[]>(
      `SELECT username FROM hobit.users WHERE id = ?`,
      [user_id]
    )

    const username = userName[0].username as string;

    const [[faq]] = await connection.execute<RowDataPacket[]>(
      `SELECT maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, question_ko, question_en, answer_ko, answer_en, manager, category_order
       FROM hobit.faqs 
       WHERE id = ?`,
      [Number(faq_id)]
    );

    let category_order = faq.category_order as number;

    if (faq.maincategory_ko !== maincategory_ko) {
      const [categoryOrderRow] = await connection.execute<RowDataPacket[]>(
        `SELECT category_order FROM hobit.faqs WHERE maincategory_ko = ? LIMIT 1`,
        [maincategory_ko]
      );

      category_order = categoryOrderRow.length > 0
      ? categoryOrderRow[0].category_order
      : await connection.execute<RowDataPacket[]>(
          `SELECT MAX(category_order) AS max_order FROM hobit.faqs`
        ).then(([rows]) => {
          return (rows[0].max_order ?? 0) + 1;
        });
    }
    

    const prev_faq : FAQ = {
      maincategory_ko: faq.maincategory_ko,
      maincategory_en: faq.maincategory_en,
      subcategory_ko: faq.subcategory_ko,
      subcategory_en: faq.subcategory_en,
      question_ko: faq.question_ko,
      question_en: faq.question_en,
      answer_ko: safetyParse(faq.answer_ko),
      answer_en: safetyParse(faq.answer_en),
      manager: faq.manager
    }

    const new_faq : FAQ = {
      maincategory_ko: maincategory_ko,
      maincategory_en: maincategory_en,
      subcategory_ko: subcategory_ko,
      subcategory_en: subcategory_en,
      question_ko: question_ko,
      question_en: question_en,
      answer_ko: answer_ko,
      answer_en: answer_en,
      manager: manager
    }

    if(prev_faq.question_ko !== new_faq.question_ko) {
      const gptbody = {
        faq_id: Number(faq_id),
        question: question_ko,
      }
  
      const GPTResponse = await fetch(`${env.API_URL}/faqs/related`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "Cookie": `accessToken=${existed_accessToken}`
        },
        body: JSON.stringify(gptbody),
      });
  
      if (!GPTResponse.ok) {
        const errorData = await GPTResponse.json();
        return res.status(GPTResponse.status).json({ 
          statusCode: GPTResponse.status, 
          message: errorData.message 
        });
      }
    }

    const data = {
      username: username,
      faq_id: faq_id,
      prev_faq: prev_faq,
      new_faq: new_faq,
      action_type: '수정'
    }

    // faq_logs 테이블에 로그를 남기기 위해 API 호출
    const logResponse = await fetch(`${env.API_URL}/adminlogs/faqlogs`, {
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
      `UPDATE hobit.faqs SET 
        maincategory_ko = ?, 
        maincategory_en = ?, 
        subcategory_ko = ?, 
        subcategory_en = ?, 
        question_ko = ?, 
        question_en = ?, 
        answer_ko = ?, 
        answer_en = ?, 
        manager = ?,
        category_order = ?,
        updated_by = ? 
      WHERE id = ?`,
      [ 
        maincategory_ko,
        maincategory_en,
        subcategory_ko,
        subcategory_en,
        question_ko,
        question_en,
        JSON.stringify(answer_ko),
        JSON.stringify(answer_en),
        manager,
        category_order,
        user_id,
        Number(faq_id)
      ]
    );

    const response : UpdateFAQResponse = {
      statusCode: 200,
      message: "FAQ updated successfully"
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

function safetyParse<T>(data: string): T | undefined {
  try {
    return JSON.parse(data) as T;
  } catch (error) {
    console.error('Invalid JSON string:', error);
    return undefined;
  }
}

export default router;