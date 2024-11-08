import express, { Request, Response } from "express";
import { Pool } from "../../../config/connectDB";


const router = express.Router();

// FAQ 생성
router.post("/", async (req: Request, res: Response) => {
  const connection = await Pool.getConnection();
  try {
    const {
      mainCategory_ko,
      mainCategory_en,
      subCategory_ko,
      subCategory_en,
      question_ko,
      question_en,
      answer_ko,
      answer_en,
      createdBy,
    } = req.body;
    

    res.status(201).json();
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});


export default router;
