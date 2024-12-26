import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, ResultSetHeader } from "mysql2/promise";
import fetch from "node-fetch";
import { CreateFAQRequest, CreateFAQResponse } from '../../../types/faq';

const router = express.Router();

// @route   Post api/faqs/
// @desc    Create a new FAQ
// @access  Private
router.post("/", async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
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
  } : CreateFAQRequest['body'] = req.body;
  console.log(req.body);

  try {
    const [faq] = await connection.execute<ResultSetHeader>(
      `INSERT INTO faqs (
        maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, question_ko, question_en, answer_ko, answer_en, manager, created_by, updated_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        user_id,
        user_id
      ]
    );

    const faq_id = faq.insertId;
    const prev_faq = {
      maincategory_ko: "",
      maincategory_en: "",
      subcategory_ko: "",
      subcategory_en: "",
      question_ko: "",
      question_en: "",
      answer_ko: {},
      answer_en: {},
      manager: ""
    };
    const new_faq = {
      maincategory_ko: maincategory_ko,
      maincategory_en: maincategory_en,
      subcategory_ko: subcategory_ko,
      subcategory_en: subcategory_en,
      question_ko: question_ko,
      question_en: question_en,
      answer_ko: answer_ko,
      answer_en: answer_en,
      manager: manager,
    };

    const data = {
      user_id: user_id,
      faq_id: faq_id,
      prev_faq: prev_faq,
      new_faq: new_faq,
      action_type: '추가'
    };

    // faq_logs 테이블에 로그를 남기기 위해 API 호출
    const logResponse = await fetch('http://localhost:5000/api/faqlogs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if (!logResponse.ok) {
      const errorData = await logResponse.json();
      return res.status(logResponse.status).json({ 
        statusCode: logResponse.status, 
        message: errorData.message 
      });
    }

    const response : CreateFAQResponse = {
      statusCode: 201,
      message: "FAQ created successfully"
    };
    res.status(201).json(response);
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

export default router;