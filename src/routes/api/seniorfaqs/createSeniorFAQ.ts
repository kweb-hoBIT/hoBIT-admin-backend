import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { CreateSeniorFAQRequest, CreateSeniorFAQResponse } from '../../../types/seniorfaq';

const router = express.Router();

// @route   Post api/seniorfaqs/
// @desc    Create a new Senior FAQ
// @access  Private
router.post("/", async (req: Request, res: Response) => {
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

  try {
    await connection.execute<ResultSetHeader>(
      `INSERT INTO senior_faqs (
        maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, detailcategory_ko, detailcategory_en, answer_ko, answer_en, manager, created_by, updated_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        maincategory_ko,
        maincategory_en,
        subcategory_ko,
        subcategory_en,
        detailcategory_ko,
        detailcategory_en,
        JSON.stringify(answer_ko), // answer_ko를 JSON으로 변환해서 저장
        JSON.stringify(answer_en), // answer_en을 JSON으로 변환해서 저장
        manager,
        user_id,
        user_id
      ]
    );

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
