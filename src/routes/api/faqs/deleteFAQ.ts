import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { DeleteFAQRequest, DeleteFAQResponse } from '../../../types/faq';

const router = express.Router();

interface FAQ {
  maincategory_ko: string;
  maincategory_en: string;
  subcategory_ko: string;
  subcategory_en: string;
  question_ko: string;
  question_en: string;
  answer_ko: { answer: string; url: string; email: string; phone: string; }[];  // 객체 배열로 변경
  answer_en: { answer: string; url: string; email: string; phone: string; }[];  // 객체 배열로 변경
  manager: string;
}


// @route   Delete api/faqs/:faq_id
// @desc    Delete a FAQ
// @access  Private
router.delete("/:faq_id", async (req: Request<{ faq_id: DeleteFAQRequest['params'] }>, res: Response) => {
  const connection : PoolConnection = await Pool.getConnection();
  const { faq_id }  = req.params;
  const { user_id } : DeleteFAQRequest['body'] = req.body;
  console.log(faq_id, user_id);

  try {
    const [[faq]] = await connection.execute<RowDataPacket[]>(
      `SELECT maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, question_ko, question_en, answer_ko, answer_en, manager
       FROM hobit.faqs 
       WHERE id = ?`,
      [Number(faq_id)]
    );

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
      maincategory_ko: "",
      maincategory_en: "",
      subcategory_ko: "",
      subcategory_en: "",
      question_ko: "",
      question_en: "",
      answer_ko: [],
      answer_en: [],
      manager: "",
    }
    
    const data = {
      user_id: user_id,
      faq_id: faq_id,
      prev_faq: prev_faq,
      new_faq: new_faq,
      action_type: '삭제'
    }

    // faq_logs 테이블에 로그를 남기기 위해 API 호출
    const logResponse = await fetch('http://localhost:5000/api/faqlogs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if(!logResponse.ok) {
      const errorData = await logResponse.json();
      return res.status(logResponse.status).json({ error: errorData.message });
    }

    await connection.execute(
      'DELETE FROM hobit.faqs WHERE id = ?',
      [faq_id]
    );
    const response : DeleteFAQResponse = {
      statusCode: 200,
      message: "FAQ deleted successfully"
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