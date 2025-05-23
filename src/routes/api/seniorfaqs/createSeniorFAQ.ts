import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { CreateSeniorFAQRequest, CreateSeniorFAQResponse } from '../../../types/seniorfaq';
import env from "../../../../config/env";
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

const router = express.Router();

// @route   Post api/seniorfaqs/
// @desc    Create a new Senior FAQ
// @access  Private
router.post("/", auth, async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
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
  } : CreateSeniorFAQRequest['body'] = req.body;
  console.log(req.body);
  const existed_accessToken = req.cookies?.accessToken;

  try {
    const [userName] = await connection.execute<RowDataPacket[]>(
      `SELECT username FROM hobit.users WHERE id = ?`,
      [user_id]
    )
    const username = userName[0].username as string;

    const [categoryOrderRow] = await connection.execute<RowDataPacket[]>(
      `SELECT category_order FROM hobit.senior_faqs WHERE maincategory_ko = ? LIMIT 1`,
      [maincategory_ko]
    );

    const category_order = categoryOrderRow.length > 0
    ? categoryOrderRow[0].category_order
    : await connection.execute<RowDataPacket[]>(
        `SELECT MAX(category_order) AS max_order FROM hobit.senior_faqs`
      ).then(([rows]) => {
        return (rows[0].max_order ?? 0) + 1;
      });

    const [senior_faq] = await connection.execute<ResultSetHeader>(
      `INSERT INTO senior_faqs (
        maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, detailcategory_ko, detailcategory_en, answer_ko, answer_en, manager, category_order, created_by, updated_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        category_order,
        user_id,
        user_id
      ]
    );

    const senior_faq_id = senior_faq.insertId;

    const prev_senior_faq = {
      maincategory_ko: "",
      maincategory_en: "",
      subcategory_ko: "",
      subcategory_en: "",
      detailcategory_ko: "",
      detailcategory_en: "",
      answer_ko: {},
      answer_en: {},
      manager: ""
    };

    const new_senior_faq = {
      maincategory_ko: maincategory_ko,
      maincategory_en: maincategory_en,
      subcategory_ko: subcategory_ko,
      subcategory_en: subcategory_en,
      detailcategory_ko: detailcategory_ko,
      detailcategory_en: detailcategory_en,
      answer_ko: answer_ko,
      answer_en: answer_en,
      manager: manager,
    };

    const data = {
      username: username,
      senior_faq_id: senior_faq_id,
      prev_senior_faq: prev_senior_faq,
      new_senior_faq: new_senior_faq,
      action_type: '추가'
    };

    // senior_faq_logs 테이블에 로그를 남기기 위해 API 호출
    const logResponse = await fetch(`${env.API_URL}/adminlogs/seniorfaqlogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        "Cookie": `accessToken=${existed_accessToken}`
      },
      body: JSON.stringify(data),
    });

    if (!logResponse.ok) {
      const errorData = await logResponse.json();
      return res.status(logResponse.status).json({ 
        statusCode: logResponse.status, 
        message: errorData.message 
      });
    }

    // 성공 응답
    const response: CreateSeniorFAQResponse = {
      statusCode: 201,
      message: "Senior FAQ created successfully"
    };
    res.status(201).json(response);
  } catch (err: any) {
    // 에러 발생 시 응답
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
